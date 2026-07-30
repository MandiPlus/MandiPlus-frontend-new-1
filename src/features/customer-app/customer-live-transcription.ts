export type CustomerLiveTranscriptionCredential = {
  provider: "assemblyai" | "gemini-live";
  token: string;
  websocketUrl: string;
  expiresInSeconds: number;
  maxSessionDurationSeconds: number;
  model: string;
};

type QuestionnaireVoiceSessionOptions = {
  silenceMillis: number;
  getCredential: () => Promise<CustomerLiveTranscriptionCredential | null>;
  onSpeechStart?: () => void;
  onTurnEnd: () => void;
};

const TARGET_SAMPLE_RATE = 16_000;
const AUDIBLE_RMS = 0.018;
// Four consecutive 50 ms frames reject prompt echo, chair movement, and short
// ambient spikes without delaying a real spoken answer.
const AUDIBLE_FRAMES_TO_START = 4;
const MIN_SPEECH_MILLIS = 220;
const MAX_TURN_MILLIS = 20_000;
const PRE_SPEECH_CHUNKS = 4;
const MAX_QUEUED_CHUNKS = 16;

export class CustomerQuestionnaireVoiceSession {
  private readonly options: QuestionnaireVoiceSessionOptions;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: AudioWorkletNode | null = null;
  private silentGainNode: GainNode | null = null;
  private socket: WebSocket | null = null;
  private queuedAudio: ArrayBuffer[] = [];
  private socketReady = false;
  private stopped = false;
  private turnEnded = false;
  private audibleFrameCount = 0;
  private speechStartedAt = 0;
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private maximumTurnTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: QuestionnaireVoiceSessionOptions) {
    this.options = options;
  }

  async start(stream: MediaStream) {
    if (this.stopped || typeof window === "undefined") return false;
    const AudioContextConstructor =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextConstructor || !window.AudioWorkletNode) return false;

    const credentialPromise = this.options.getCredential();
    const context = new AudioContextConstructor({
      latencyHint: "interactive",
      sampleRate: TARGET_SAMPLE_RATE,
    });
    this.audioContext = context;

    try {
      await context.audioWorklet.addModule(
        "/customer-app/questionnaire-pcm-worklet.js",
      );
      if (this.stopped) return false;
      await context.resume();

      this.sourceNode = context.createMediaStreamSource(stream);
      this.processorNode = new AudioWorkletNode(
        context,
        "questionnaire-pcm-processor",
      );
      this.silentGainNode = context.createGain();
      this.silentGainNode.gain.value = 0;
      this.processorNode.port.onmessage = (event) => {
        this.handleAudioChunk(event.data);
      };
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.silentGainNode);
      this.silentGainNode.connect(context.destination);
      void credentialPromise.then((credential) => {
        if (!this.stopped && credential?.provider === "assemblyai") {
          this.connectAssemblyAi(credential);
        }
      });
      return true;
    } catch {
      await this.stop();
      return false;
    }
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    if (this.maximumTurnTimeout) clearTimeout(this.maximumTurnTimeout);
    this.silenceTimeout = null;
    this.maximumTurnTimeout = null;
    this.queuedAudio = [];

    const socket = this.socket;
    this.socket = null;
    this.socketReady = false;
    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "Terminate" }));
        }
        socket.close(1000, "question-complete");
      } catch {
        // The session may already be closing after an endpoint event.
      }
    }

    this.processorNode?.port.close();
    this.sourceNode?.disconnect();
    this.processorNode?.disconnect();
    this.silentGainNode?.disconnect();
    this.sourceNode = null;
    this.processorNode = null;
    this.silentGainNode = null;

    const context = this.audioContext;
    this.audioContext = null;
    if (context && context.state !== "closed") {
      await context.close().catch(() => {});
    }
  }

  private handleAudioChunk(payload: { pcm?: ArrayBuffer; rms?: number }) {
    if (this.stopped || !(payload?.pcm instanceof ArrayBuffer)) return;
    const rms = Number(payload.rms || 0);
    if (rms >= AUDIBLE_RMS) {
      this.audibleFrameCount += 1;
      if (
        !this.speechStartedAt &&
        this.audibleFrameCount >= AUDIBLE_FRAMES_TO_START
      ) {
        this.markSpeechStarted(
          performance.now() -
            (AUDIBLE_FRAMES_TO_START - 1) * 50,
        );
      }
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
    } else {
      this.audibleFrameCount = 0;
      this.armSilenceEndpoint();
    }

    if (
      this.socket?.readyState === WebSocket.OPEN &&
      this.socketReady
    ) {
      this.socket.send(payload.pcm);
      return;
    }

    this.queuedAudio.push(payload.pcm);
    const queueLimit = this.speechStartedAt
      ? MAX_QUEUED_CHUNKS
      : PRE_SPEECH_CHUNKS;
    while (this.queuedAudio.length > queueLimit) {
      this.queuedAudio.shift();
    }
  }

  private armSilenceEndpoint() {
    if (
      !this.speechStartedAt ||
      this.silenceTimeout ||
      this.turnEnded ||
      this.stopped
    ) {
      return;
    }
    const speechMillis = performance.now() - this.speechStartedAt;
    const delay = Math.max(
      this.options.silenceMillis,
      MIN_SPEECH_MILLIS - speechMillis,
    );
    this.silenceTimeout = setTimeout(() => {
      this.silenceTimeout = null;
      this.finishTurn();
    }, delay);
  }

  private markSpeechStarted(startedAt: number) {
    if (this.speechStartedAt || this.stopped || this.turnEnded) return;
    this.speechStartedAt = startedAt;
    this.options.onSpeechStart?.();
    // Thinking time before the answer is unlimited. The safety timeout starts
    // only after genuine speech has been confirmed.
    this.maximumTurnTimeout = setTimeout(
      () => this.finishTurn(),
      MAX_TURN_MILLIS,
    );
  }

  private connectAssemblyAi(
    credential: CustomerLiveTranscriptionCredential,
  ) {
    if (this.stopped) return;
    const params = new URLSearchParams({
      token: credential.token,
      sample_rate: String(TARGET_SAMPLE_RATE),
      encoding: "pcm_s16le",
      speech_model: credential.model,
      min_turn_silence: "160",
      max_turn_silence: String(
        Math.max(400, this.options.silenceMillis),
      ),
    });
    if (credential.model === "whisper-rt") {
      params.set("language_detection", "true");
      params.set("format_turns", "false");
    } else if (credential.model !== "u3-rt-pro") {
      params.set("format_turns", "false");
    }

    const socket = new WebSocket(
      `${credential.websocketUrl}?${params.toString()}`,
    );
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.onmessage = (event) => {
      if (this.stopped || typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as {
          type?: string;
          transcript?: string;
          end_of_turn?: boolean;
        };
        if (message.type === "Begin") {
          this.socketReady = true;
          const queued = this.queuedAudio.splice(0);
          for (const chunk of queued) {
            if (socket.readyState !== WebSocket.OPEN) break;
            socket.send(chunk);
          }
          return;
        }
        if (
          message.type === "Turn" &&
          String(message.transcript || "").trim() &&
          !this.speechStartedAt
        ) {
          this.markSpeechStarted(performance.now());
        }
        // Provider endpointing is supporting evidence, not permission to skip
        // a question. Local post-speech silence keeps pauses conversational.
        if (message.type === "Turn" && message.end_of_turn) {
          this.armSilenceEndpoint();
        }
      } catch {
        // Ignore provider messages that are not JSON turn events.
      }
    };
    socket.onerror = () => {
      this.socketReady = false;
    };
    socket.onclose = () => {
      this.socketReady = false;
    };
  }

  private finishTurn() {
    if (
      this.stopped ||
      this.turnEnded ||
      !this.speechStartedAt
    ) {
      return;
    }
    this.turnEnded = true;
    this.options.onTurnEnd();
  }
}

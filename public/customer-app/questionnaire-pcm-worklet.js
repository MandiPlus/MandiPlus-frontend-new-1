class QuestionnairePcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.samplesPerChunk = 800;
    this.resampleAccumulator = 0;
    this.chunk = new Int16Array(this.samplesPerChunk);
    this.chunkOffset = 0;
    this.sumSquares = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (let index = 0; index < channel.length; index += 1) {
      this.resampleAccumulator += this.targetSampleRate;
      if (this.resampleAccumulator < sampleRate) continue;
      this.resampleAccumulator -= sampleRate;

      const sample = Math.max(-1, Math.min(1, channel[index] || 0));
      this.chunk[this.chunkOffset] =
        sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.sumSquares += sample * sample;
      this.chunkOffset += 1;

      if (this.chunkOffset === this.samplesPerChunk) {
        const pcm = this.chunk;
        const rms = Math.sqrt(this.sumSquares / this.samplesPerChunk);
        this.port.postMessage({ pcm: pcm.buffer, rms }, [pcm.buffer]);
        this.chunk = new Int16Array(this.samplesPerChunk);
        this.chunkOffset = 0;
        this.sumSquares = 0;
      }
    }

    return true;
  }
}

registerProcessor("questionnaire-pcm-processor", QuestionnairePcmProcessor);

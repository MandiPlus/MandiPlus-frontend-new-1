"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClaimEvidenceUploadProof,
  ClaimLocation,
  ClaimRequest,
  createClaimWithEvidence,
  getClaimEvidenceUploadTarget,
  uploadClaimEvidence,
} from "@/features/insurance/api";
import {
  Boxes,
  FileText,
  Gauge,
  LayoutDashboard,
  PackageOpen,
  Truck,
  Upload,
  Wrench,
} from "lucide-react";

type Capture = {
  id: string;
  file: File;
  preview: string;
  capturedAt: string;
  label: string;
  uploadState: "queued" | "uploading" | "ready" | "failed";
};

export type ClaimCaptureType = "accident" | "engine_seize";

type CaptureStep = {
  label: string;
  hint: string;
  minDurationMs?: number;
  maxDurationMs?: number;
};

const ACCIDENT_PHOTO_STEPS: CaptureStep[] = Array.from(
  { length: 4 },
  (_, index) => ({
    label: `Photo ${index + 1}`,
    hint: "Keep the vehicle clearly visible",
  }),
);
const ACCIDENT_VIDEO_STEPS: CaptureStep[] = Array.from(
  { length: 2 },
  (_, index) => ({
    label: `Video ${index + 1}`,
    hint: "Move slowly and keep the vehicle in frame",
    maxDurationMs: 60_000,
  }),
);
const ENGINE_SEIZE_PHOTO_STEPS: CaptureStep[] = [
  { label: "RC", hint: "Capture the complete RC clearly" },
  { label: "Front", hint: "Keep the full front of the vehicle visible" },
  { label: "Rear", hint: "Keep the full rear of the vehicle visible" },
  { label: "Left", hint: "Capture the complete left side" },
  { label: "Right", hint: "Capture the complete right side" },
  { label: "Engine", hint: "Open the bonnet and capture the engine clearly" },
  { label: "Dashboard", hint: "Capture the complete dashboard" },
  { label: "Odometer", hint: "Keep the odometer reading sharp and readable" },
  { label: "Loading", hint: "Show the vehicle while it is loaded" },
  { label: "Goods", hint: "Show the loaded goods clearly" },
];
const ENGINE_SEIZE_VIDEO_STEPS: CaptureStep[] = [
  {
    label: "Engine video",
    hint: "Record the engine continuously with sound",
    minDurationMs: 60_000,
    maxDurationMs: 90_000,
  },
  {
    label: "Cross-loading video",
    hint: "Record the load being transferred to the other vehicle",
    maxDurationMs: 60_000,
  },
];
const VIDEO_WIDTH = 854;
const VIDEO_HEIGHT = 480;
const VIDEO_FRAME_RATE = 20;
const VIDEO_BITS_PER_SECOND = 500_000;
const AUDIO_BITS_PER_SECOND = 24_000;

type ClaimEvidenceSubmission = Parameters<typeof createClaimWithEvidence>[0] & {
  captureType?: ClaimCaptureType;
  crossLoadingVehicleNumber?: string;
};

type Props<TResult> = {
  truckNumber: string;
  onClose?: () => void;
  onSubmitted: (claim: TResult) => void;
  prepareUpload?: typeof getClaimEvidenceUploadTarget;
  uploadFile?: typeof uploadClaimEvidence;
  sendEvidence?: (payload: ClaimEvidenceSubmission) => Promise<TResult>;
  captureType?: ClaimCaptureType;
};

const getMessage = (error: unknown) => {
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return Array.isArray(message)
      ? message[0]
      : String(message || "Unable to continue");
  }
  return "Unable to continue";
};

const getRecorderMimeType = () => {
  const choices = ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"];
  return choices.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

const createSubmissionId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};

const formatDuration = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const drawGpsOverlay = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  location: ClaimLocation,
) => {
  const padding = Math.max(14, Math.round(width * 0.018));
  const titleSize = Math.max(15, Math.round(width * 0.025));
  const bodySize = Math.max(13, Math.round(width * 0.021));
  const overlayHeight = Math.max(104, Math.round(height * 0.2));
  const capturedAt = new Date(location.capturedAt);

  context.save();
  context.fillStyle = "rgba(8, 12, 18, 0.78)";
  context.fillRect(0, height - overlayHeight, width, overlayHeight);
  context.fillStyle = "#ffffff";
  context.font = `700 ${titleSize}px sans-serif`;
  context.fillText(
    "GPS LOCATION",
    padding,
    height - overlayHeight + padding + titleSize,
  );
  context.font = `600 ${bodySize}px sans-serif`;
  context.fillText(
    `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}  ·  ±${Math.round(location.accuracy)}m`,
    padding,
    height - overlayHeight + padding * 2 + titleSize + bodySize,
  );
  context.font = `500 ${bodySize}px sans-serif`;
  context.fillText(
    capturedAt.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    padding,
    height - padding,
  );
  context.restore();
};

const loadImageFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not open RC image"));
    };
    image.src = objectUrl;
  });

function CaptureGuide({ step }: { step: CaptureStep }) {
  let Icon = Truck;
  if (step.label === "RC") Icon = FileText;
  if (step.label === "Engine") Icon = Wrench;
  if (step.label === "Dashboard") Icon = LayoutDashboard;
  if (step.label === "Odometer") Icon = Gauge;
  if (step.label === "Loading") Icon = Boxes;
  if (step.label === "Goods") Icon = PackageOpen;

  return (
    <div className="pointer-events-none absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col items-center">
      <div className="grid h-40 w-full max-w-xs place-items-center rounded-[28px] border border-dashed border-white/55 bg-black/10">
        <Icon className="h-16 w-16 stroke-[1.35] text-white/80 drop-shadow" />
      </div>
      <p className="mt-3 rounded-full bg-black/65 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur-sm">
        {step.hint}
      </p>
    </div>
  );
}

function UploadBadge({ state }: { state: Capture["uploadState"] }) {
  const ready = state === "ready";
  const failed = state === "failed";

  return (
    <span
      className={`absolute right-1.5 top-1.5 inline-flex min-h-6 items-center gap-1 rounded-full px-2 text-[10px] font-black shadow-sm ${
        ready
          ? "bg-emerald-500 text-white"
          : failed
            ? "bg-amber-400 text-[#172033]"
            : "bg-black/75 text-white"
      }`}
    >
      {!ready && !failed && (
        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white/40 border-t-white" />
      )}
      {ready ? "✓ Ready" : failed ? "Retrying" : "Preparing"}
    </span>
  );
}

export default function ClaimCaptureFlow<TResult = ClaimRequest>({
  truckNumber,
  onClose,
  onSubmitted,
  prepareUpload = getClaimEvidenceUploadTarget,
  uploadFile = uploadClaimEvidence,
  sendEvidence = createClaimWithEvidence as unknown as (
    payload: ClaimEvidenceSubmission,
  ) => Promise<TResult>,
  captureType = "accident",
}: Props<TResult>) {
  const engineSeize = captureType === "engine_seize";
  const photoSteps = engineSeize
    ? ENGINE_SEIZE_PHOTO_STEPS
    : ACCIDENT_PHOTO_STEPS;
  const videoSteps = engineSeize
    ? ENGINE_SEIZE_VIDEO_STEPS
    : ACCIDENT_VIDEO_STEPS;
  const photoTotal = photoSteps.length;
  const videoTotal = videoSteps.length;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const photoCaptureBusyRef = useRef(false);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const locationRef = useRef<ClaimLocation | null>(null);
  const capturesRef = useRef<Capture[]>([]);
  const submissionIdRef = useRef(createSubmissionId());
  const uploadGenerationRef = useRef(0);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const uploadTasksRef = useRef(
    new Map<string, Promise<ClaimEvidenceUploadProof>>(),
  );
  const uploadProofsRef = useRef(new Map<string, ClaimEvidenceUploadProof>());

  const [photos, setPhotos] = useState<Capture[]>([]);
  const [videos, setVideos] = useState<Capture[]>([]);
  const [location, setLocation] = useState<ClaimLocation | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [videoProfileReady, setVideoProfileReady] = useState(false);
  const [photoCaptureBusy, setPhotoCaptureBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [crossLoadingVehicleNumber, setCrossLoadingVehicleNumber] =
    useState("");
  const rcUploadRef = useRef<HTMLInputElement>(null);

  const clearRecordingTimers = useCallback(() => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    if (recordTickRef.current) clearInterval(recordTickRef.current);
    recordTimerRef.current = null;
    recordTickRef.current = null;
  }, []);

  const showCaptureFeedback = useCallback((message: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setCaptureFeedback(message);
    navigator.vibrate?.(35);
    feedbackTimerRef.current = setTimeout(() => {
      setCaptureFeedback(null);
      feedbackTimerRef.current = null;
    }, 1700);
  }, []);

  const updateCaptureUploadState = useCallback(
    (captureId: string, uploadState: Capture["uploadState"]) => {
      const update = (items: Capture[]) =>
        items.map((item) =>
          item.id === captureId ? { ...item, uploadState } : item,
        );
      setPhotos(update);
      setVideos(update);
    },
    [],
  );

  const beginBackgroundUpload = useCallback(
    (capture: Capture) => {
      const existingProof = uploadProofsRef.current.get(capture.id);
      if (existingProof) return Promise.resolve(existingProof);

      const existingTask = uploadTasksRef.current.get(capture.id);
      if (existingTask) return existingTask;

      const generation = uploadGenerationRef.current;
      const submissionId = submissionIdRef.current;
      const task = uploadQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== uploadGenerationRef.current) {
            throw new Error("Capture reset");
          }
          updateCaptureUploadState(capture.id, "uploading");
          const target = await prepareUpload(submissionId);
          const proof = await uploadFile(
            target,
            capture.file,
            capture.capturedAt,
          );
          const labeledProof = { ...proof, label: capture.label };
          if (generation === uploadGenerationRef.current) {
            uploadProofsRef.current.set(capture.id, labeledProof);
            updateCaptureUploadState(capture.id, "ready");
          }
          return labeledProof;
        });

      uploadTasksRef.current.set(capture.id, task);
      uploadQueueRef.current = task.then(
        () => undefined,
        () => undefined,
      );
      void task.catch(() => {
        uploadTasksRef.current.delete(capture.id);
        if (generation === uploadGenerationRef.current) {
          updateCaptureUploadState(capture.id, "failed");
        }
      });
      return task;
    },
    [prepareUpload, updateCaptureUploadState, uploadFile],
  );

  const stopCamera = useCallback(() => {
    clearRecordingTimers();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setVideoProfileReady(false);
    setRecording(false);
    setRecordingElapsed(0);
  }, [clearRecordingTimers]);

  const startLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Location is not supported on this browser");
      return;
    }
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
    }
    setError(null);
    locationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.accuracy > 1000) {
          locationRef.current = null;
          setLocation(null);
          setError("Improving location…");
          return;
        }
        const currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        };
        locationRef.current = currentLocation;
        setLocation(currentLocation);
        setError(null);
      },
      (geoError) => {
        locationRef.current = null;
        setLocation(null);
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location blocked in Chrome. Allow it, then retry"
            : "Could not get location. Retry",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError("Open this page on HTTPS to use the camera");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
        },
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16_000 },
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      });
      const selectedFacingMode = stream
        .getVideoTracks()[0]
        ?.getSettings()
        .facingMode?.toLowerCase();
      if (selectedFacingMode === "user") {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException("Rear camera required", "OverconstrainedError");
      }
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && "contentHint" in videoTrack) {
        videoTrack.contentHint = "detail";
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (cameraError) {
      const name = cameraError instanceof DOMException ? cameraError.name : "";
      setError(
        name === "NotAllowedError"
          ? "Allow camera and microphone access"
          : name === "NotFoundError"
            ? "Camera or microphone not available"
            : name === "OverconstrainedError"
              ? "Rear camera not available"
              : "Camera could not start",
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    if (engineSeize) startLocation();
    return () => {
      uploadGenerationRef.current += 1;
      stopCamera();
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      capturesRef.current.forEach((capture) =>
        URL.revokeObjectURL(capture.preview),
      );
    };
  }, [engineSeize, startCamera, startLocation, stopCamera]);

  useEffect(() => {
    capturesRef.current = [...photos, ...videos];
  }, [photos, videos]);

  useEffect(() => {
    if (photos.length !== photoTotal || !cameraReady) return;

    let cancelled = false;
    const prepareCompactVideo = async () => {
      setVideoProfileReady(false);
      const videoTrack = streamRef.current?.getVideoTracks()[0];
      if (!videoTrack) return;

      if ("contentHint" in videoTrack) videoTrack.contentHint = "motion";
      try {
        await videoTrack.applyConstraints({
          width: { ideal: VIDEO_WIDTH, max: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT, max: VIDEO_HEIGHT },
          frameRate: {
            ideal: VIDEO_FRAME_RATE,
            max: VIDEO_FRAME_RATE,
          },
        });
      } catch {
        try {
          await videoTrack.applyConstraints({
            frameRate: {
              ideal: VIDEO_FRAME_RATE,
              max: VIDEO_FRAME_RATE,
            },
          });
        } catch {
          // The bitrate cap below still keeps the video compact on older phones.
        }
      }
    };

    void prepareCompactVideo().finally(() => {
      if (!cancelled) setVideoProfileReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [cameraReady, photoTotal, photos.length]);

  const savePhotoCanvas = (
    canvas: HTMLCanvasElement,
    label: string,
    capturedAt: string,
  ) => {
    canvas.toBlob(
      (blob) => {
        photoCaptureBusyRef.current = false;
        setPhotoCaptureBusy(false);
        if (!blob) return setError("Photo failed. Try again");
        const photoNumber = photos.length + 1;
        const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const file = new File(
          [blob],
          `${engineSeize ? "engine-seize" : "claim"}-${safeLabel}.jpg`,
          {
            type: "image/jpeg",
            lastModified: Date.now(),
          },
        );
        const capture: Capture = {
          id: `${submissionIdRef.current}-photo-${photoNumber}`,
          file,
          preview: URL.createObjectURL(file),
          capturedAt,
          label,
          uploadState: "queued",
        };
        setPhotos((items) => [...items, capture]);
        showCaptureFeedback(
          photoNumber === photoTotal
            ? "All photos captured"
            : `${label} saved · ${photoTotal - photoNumber} left`,
        );
        void beginBackgroundUpload(capture).catch(() => undefined);
      },
      "image/jpeg",
      0.76,
    );
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const currentLocation = locationRef.current;
    if (
      !video ||
      !cameraReady ||
      photoCaptureBusyRef.current ||
      photos.length >= photoTotal
    ) {
      return;
    }
    if (engineSeize && !currentLocation) {
      setError("Getting GPS location. Please wait");
      return;
    }
    photoCaptureBusyRef.current = true;
    setPhotoCaptureBusy(true);
    const canvas = document.createElement("canvas");
    const width = Math.min(video.videoWidth || 1280, 1280);
    const height = Math.round(
      width * ((video.videoHeight || 720) / (video.videoWidth || 1280)),
    );
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, width, height);
    const capturedAt = new Date().toISOString();
    if (context && engineSeize && currentLocation) {
      drawGpsOverlay(context, width, height, {
        ...currentLocation,
        capturedAt,
      });
    }
    savePhotoCanvas(canvas, photoSteps[photos.length].label, capturedAt);
  };

  const uploadRc = async (file?: File) => {
    const currentLocation = locationRef.current;
    if (!file || photos.length !== 0 || !engineSeize) return;
    if (!file.type.startsWith("image/")) {
      setError("Upload the RC as an image");
      return;
    }
    if (!currentLocation) {
      setError("Getting GPS location. Please wait");
      return;
    }
    photoCaptureBusyRef.current = true;
    setPhotoCaptureBusy(true);
    setError(null);
    try {
      const image = await loadImageFile(file);
      const width = Math.min(image.naturalWidth || 1280, 1280);
      const height = Math.round(
        width * ((image.naturalHeight || 720) / (image.naturalWidth || 1280)),
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0, width, height);
      const capturedAt = new Date().toISOString();
      if (context) {
        drawGpsOverlay(context, width, height, {
          ...currentLocation,
          capturedAt,
        });
      }
      savePhotoCanvas(canvas, ENGINE_SEIZE_PHOTO_STEPS[0].label, capturedAt);
    } catch (uploadError) {
      photoCaptureBusyRef.current = false;
      setPhotoCaptureBusy(false);
      setError(getMessage(uploadError));
    } finally {
      if (rcUploadRef.current) rcUploadRef.current.value = "";
    }
  };

  const stopRecording = (force = false) => {
    const currentStep = videoSteps[videos.length];
    const elapsed = performance.now() - recordingStartedAtRef.current;
    if (
      !force &&
      recorderRef.current?.state === "recording" &&
      currentStep?.minDurationMs &&
      elapsed < currentStep.minDurationMs
    ) {
      showCaptureFeedback(
        `Keep recording until ${formatDuration(currentStep.minDurationMs / 1000)}`,
      );
      return;
    }
    clearRecordingTimers();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = () => {
    if (
      engineSeize &&
      videos.length === 1 &&
      !crossLoadingVehicleNumber.trim()
    ) {
      setError("Enter the cross-loading vehicle number");
      return;
    }
    if (
      !streamRef.current ||
      !videoProfileReady ||
      recording ||
      videos.length >= videoTotal ||
      typeof MediaRecorder === "undefined"
    ) {
      if (typeof MediaRecorder === "undefined")
        setError("Video recording is not supported");
      return;
    }
    const chunks: BlobPart[] = [];
    const mimeType = getRecorderMimeType();
    const recorder = new MediaRecorder(streamRef.current, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const finalType = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type: finalType });
      if (!blob.size) {
        setError("Video failed. Try again");
      } else {
        const videoNumber = videos.length + 1;
        const step = videoSteps[videos.length];
        const capturedAt = new Date().toISOString();
        const extension = finalType.includes("mp4") ? "mp4" : "webm";
        const file = new File(
          [blob],
          `${engineSeize ? "engine-seize" : "claim"}-${step.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extension}`,
          {
            type: finalType.split(";")[0],
            lastModified: Date.now(),
          },
        );
        const capture: Capture = {
          id: `${submissionIdRef.current}-video-${videoNumber}`,
          file,
          preview: URL.createObjectURL(file),
          capturedAt,
          label: step.label,
          uploadState: "queued",
        };
        setVideos((items) => [...items, capture]);
        showCaptureFeedback(
          videoNumber === videoTotal
            ? "All videos captured"
            : `${step.label} saved · ${videoTotal - videoNumber} left`,
        );
        void beginBackgroundUpload(capture).catch(() => undefined);
      }
      setRecording(false);
      setRecordingElapsed(0);
    };
    recorder.start(1000);
    recordingStartedAtRef.current = performance.now();
    setRecordingElapsed(0);
    setRecording(true);
    recordTickRef.current = setInterval(() => {
      const limitMs = videoSteps[videos.length]?.maxDurationMs || 60_000;
      setRecordingElapsed(
        Math.min(performance.now() - recordingStartedAtRef.current, limitMs),
      );
    }, 100);
    const limitMs = videoSteps[videos.length]?.maxDurationMs || 60_000;
    recordTimerRef.current = setTimeout(() => stopRecording(true), limitMs);
  };

  useEffect(() => {
    if (photos.length === photoTotal && videos.length === videoTotal) {
      stopCamera();
      if (!locationRef.current) startLocation();
    }
  }, [
    photoTotal,
    photos.length,
    startLocation,
    stopCamera,
    videoTotal,
    videos.length,
  ]);

  const reset = () => {
    capturesRef.current.forEach((capture) =>
      URL.revokeObjectURL(capture.preview),
    );
    setPhotos([]);
    setVideos([]);
    locationRef.current = null;
    setLocation(null);
    setCrossLoadingVehicleNumber("");
    setCaptureFeedback(null);
    uploadGenerationRef.current += 1;
    uploadQueueRef.current = Promise.resolve();
    uploadTasksRef.current.clear();
    uploadProofsRef.current.clear();
    submissionIdRef.current = createSubmissionId();
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    void startCamera();
  };

  const submit = async () => {
    if (
      photos.length !== photoTotal ||
      videos.length !== videoTotal ||
      !location ||
      sending
    ) {
      return;
    }
    setSending(true);
    setFinalizing(false);
    setError(null);
    try {
      const uploadedPhotos = await Promise.all(
        photos.map((capture) => beginBackgroundUpload(capture)),
      );
      const uploadedVideos = await Promise.all(
        videos.map((capture) => beginBackgroundUpload(capture)),
      );
      const currentLocation = locationRef.current;
      if (!currentLocation) throw new Error("Could not get location. Retry");
      setFinalizing(true);
      const claim = await sendEvidence({
        truckNumber,
        submissionId: submissionIdRef.current,
        photos: uploadedPhotos,
        videos: uploadedVideos,
        location: currentLocation,
        ...(engineSeize
          ? { crossLoadingVehicleNumber: crossLoadingVehicleNumber.trim() }
          : {}),
      });
      onSubmitted(claim);
    } catch (submitError) {
      setError(getMessage(submitError));
    } finally {
      setFinalizing(false);
      setSending(false);
    }
  };

  const capturingPhotos = photos.length < photoTotal;
  const capturingVideos =
    photos.length === photoTotal && videos.length < videoTotal;
  const reviewing =
    photos.length === photoTotal && videos.length === videoTotal;
  const readyUploads = [...photos, ...videos].filter(
    (capture) => capture.uploadState === "ready",
  ).length;
  const currentPhotoStep = photoSteps[photos.length];
  const currentVideoStep = videoSteps[videos.length];
  const recordingLimitMs = currentVideoStep?.maxDurationMs || 60_000;
  const recordingProgress = Math.min(recordingElapsed / recordingLimitMs, 1);
  const recordingSeconds = Math.min(
    Math.floor(recordingElapsed / 1000),
    recordingLimitMs / 1000,
  );

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0d1117] text-white">
      <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4">
        <span className="text-sm font-bold">
          {engineSeize ? "Engine seize" : "Accident claim"} ·{" "}
          {truckNumber.toUpperCase()}
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 px-2 text-sm text-white/80"
          >
            Close
          </button>
        ) : (
          <span aria-hidden="true" className="w-10" />
        )}
      </header>

      {!reviewing ? (
        <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-contain"
          />
          {engineSeize && capturingPhotos && currentPhotoStep && (
            <CaptureGuide step={currentPhotoStep} />
          )}
          <div className="absolute left-3 right-3 top-3 rounded-2xl border border-white/15 bg-black/75 px-4 py-3 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between text-sm font-black">
              <span>
                {capturingPhotos
                  ? currentPhotoStep?.label || "Photos"
                  : currentVideoStep?.label || "Videos"}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs text-[#111827]">
                {capturingPhotos
                  ? `${photos.length + 1} / ${photoTotal}`
                  : `${videos.length + 1} / ${videoTotal}`}
              </span>
            </div>
            <div className="mt-2 flex gap-2" aria-hidden="true">
              {Array.from({
                length: capturingPhotos ? photoTotal : videoTotal,
              }).map((_, index) => {
                const complete =
                  index < (capturingPhotos ? photos.length : videos.length);
                const current =
                  index === (capturingPhotos ? photos.length : videos.length);
                return (
                  <span
                    key={index}
                    className={`h-2 flex-1 rounded-full ${
                      complete
                        ? "bg-emerald-400"
                        : current
                          ? "bg-white"
                          : "bg-white/25"
                    }`}
                  />
                );
              })}
            </div>
            <p
              className={`mt-2 text-center text-sm font-bold ${
                captureFeedback ? "text-emerald-300" : "text-white"
              }`}
              aria-live="polite"
            >
              {recording
                ? `● Recording ${formatDuration(recordingSeconds)} / ${formatDuration(recordingLimitMs / 1000)}`
                : captureFeedback ||
                  (capturingPhotos
                    ? engineSeize
                      ? currentPhotoStep?.hint
                      : `${photoTotal - photos.length} photos remaining`
                    : currentVideoStep?.hint ||
                      `${videoTotal - videos.length} videos remaining`)}
            </p>
            {engineSeize && (
              <p
                className={`mt-1 text-center text-[10px] font-semibold ${
                  location ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {location
                  ? `GPS ready · ±${Math.round(location.accuracy)}m`
                  : "Getting GPS location…"}
              </p>
            )}
          </div>
          {engineSeize &&
            capturingVideos &&
            videos.length === 1 &&
            !recording && (
              <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/75 p-3 backdrop-blur-sm">
                <label className="text-[11px] font-bold text-white/70">
                  Cross-loading vehicle number
                </label>
                <input
                  value={crossLoadingVehicleNumber}
                  onChange={(event) => {
                    setCrossLoadingVehicleNumber(
                      event.target.value.toUpperCase(),
                    );
                    setError(null);
                  }}
                  placeholder="e.g. MH12AB1234"
                  maxLength={32}
                  className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-white px-3 text-sm font-bold text-[#172033] outline-none focus:border-white"
                />
              </div>
            )}
        </main>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f5f6f8] p-4 text-[#172033]">
          <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.preview} className="relative">
                <img
                  src={photo.preview}
                  alt={photo.label}
                  className="aspect-square w-full rounded-lg bg-black object-cover"
                />
                <UploadBadge state={photo.uploadState} />
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-2 py-1 text-[9px] font-bold text-white">
                  {photo.label}
                </span>
              </div>
            ))}
            {videos.map((video) => (
              <div key={video.preview} className="relative">
                <video
                  src={video.preview}
                  aria-label={video.label}
                  controls
                  preload="metadata"
                  className="aspect-square w-full rounded-lg bg-black object-cover"
                />
                <UploadBadge state={video.uploadState} />
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-2 py-1 text-[9px] font-bold text-white">
                  {video.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-4 max-w-xl divide-y divide-slate-100 rounded-xl bg-white px-4 text-sm font-bold">
            <div className="flex items-center justify-between py-3">
              <span>Evidence</span>
              <span
                className={
                  readyUploads === photoTotal + videoTotal
                    ? "text-emerald-700"
                    : "text-amber-700"
                }
              >
                {readyUploads === photoTotal + videoTotal
                  ? "Ready"
                  : `Preparing ${readyUploads}/${photoTotal + videoTotal}`}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span>Location</span>
              <span
                className={location ? "text-emerald-700" : "text-amber-700"}
              >
                {location
                  ? `Ready · ±${Math.round(location.accuracy)}m`
                  : "Getting…"}
              </span>
            </div>
            {engineSeize && (
              <div className="flex items-center justify-between py-3">
                <span>Cross-loading vehicle</span>
                <span className="text-slate-600">
                  {crossLoadingVehicleNumber || "—"}
                </span>
              </div>
            )}
          </div>
        </main>
      )}

      <footer className="border-t border-white/10 bg-[#0d1117] px-4 py-4">
        {error && (
          <p className="mb-3 text-center text-sm font-semibold text-rose-300">
            {error}
          </p>
        )}
        {capturingPhotos && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-5">
              {engineSeize && photos.length === 0 && (
                <>
                  <input
                    ref={rcUploadRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void uploadRc(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={!location || photoCaptureBusy}
                    onClick={() => rcUploadRef.current?.click()}
                    className="grid h-12 w-12 place-items-center rounded-full border border-white/30 text-white active:scale-95 disabled:opacity-40"
                    aria-label="Upload RC image"
                  >
                    <Upload className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={
                  !cameraReady || photoCaptureBusy || (engineSeize && !location)
                }
                onClick={takePhoto}
                className="block h-16 w-16 rounded-full border-4 border-white bg-white/20 shadow-[0_0_0_5px_rgba(255,255,255,0.12)] active:scale-95 disabled:opacity-40"
                aria-label={`Take ${currentPhotoStep?.label || "photo"} ${photos.length + 1} of ${photoTotal}`}
              />
              {engineSeize && photos.length === 0 && (
                <span aria-hidden="true" className="h-12 w-12" />
              )}
            </div>
            <p className="mt-2 text-xs font-bold text-white/70">
              {currentPhotoStep?.label || "Photo"} · {photos.length + 1} of{" "}
              {photoTotal}
            </p>
            {engineSeize && photos.length === 0 && (
              <button
                type="button"
                disabled={!location || photoCaptureBusy}
                onClick={() => rcUploadRef.current?.click()}
                className="mt-1 min-h-8 text-[11px] font-semibold text-white/65 underline disabled:opacity-40"
              >
                Or upload RC image
              </button>
            )}
          </div>
        )}
        {capturingVideos && (
          <div className="text-center">
            <div
              className="mx-auto grid h-20 w-20 place-items-center rounded-full p-1"
              style={{
                background: recording
                  ? `conic-gradient(#ef4444 ${recordingProgress * 360}deg, rgba(255,255,255,0.2) 0deg)`
                  : "rgba(255,255,255,0.18)",
              }}
            >
              <button
                type="button"
                disabled={!cameraReady || !videoProfileReady}
                onClick={recording ? () => stopRecording() : startRecording}
                className="grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-[#0d1117] bg-white disabled:opacity-40"
                aria-label={recording ? "Stop recording" : "Start recording"}
              >
                <span
                  className={`block bg-red-600 transition-all ${
                    recording ? "h-7 w-7 rounded-md" : "h-12 w-12 rounded-full"
                  }`}
                />
              </button>
            </div>
            <p
              className={`mt-2 text-xs font-black ${recording ? "text-red-300" : "text-white/75"}`}
            >
              {recording
                ? "Recording · tap to finish"
                : !videoProfileReady
                  ? "Preparing video…"
                  : `${currentVideoStep?.label || "Start video"} · up to ${formatDuration(recordingLimitMs / 1000)}`}
            </p>
          </div>
        )}
        {reviewing && (
          <div className="mx-auto flex max-w-xl gap-3">
            <button
              type="button"
              disabled={sending}
              onClick={reset}
              className="min-h-12 flex-1 rounded-xl border border-white/30 text-sm font-bold disabled:opacity-50"
            >
              Retake
            </button>
            <button
              type="button"
              disabled={!location || sending}
              onClick={submit}
              className="min-h-12 flex-[2] rounded-xl bg-white text-sm font-black text-[#172033] disabled:opacity-40"
            >
              {sending
                ? finalizing
                  ? "Sending claim…"
                  : `Finishing uploads ${readyUploads}/${photoTotal + videoTotal}`
                : location
                  ? "Send claim"
                  : "Getting location…"}
            </button>
          </div>
        )}
        {error && !cameraReady && !reviewing && (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="mx-auto mt-3 block min-h-10 px-5 text-sm font-bold underline"
          >
            Retry
          </button>
        )}
        {reviewing && !location && (
          <button
            type="button"
            onClick={startLocation}
            className="mx-auto mt-3 block min-h-10 px-5 text-sm font-bold underline"
          >
            Retry location
          </button>
        )}
      </footer>
    </div>
  );
}

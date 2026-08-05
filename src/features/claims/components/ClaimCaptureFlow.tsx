"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClaimEvidenceUploadProof,
  ClaimLocation,
  getClaimEvidenceUploadTarget,
  uploadClaimEvidence,
} from "@/features/insurance/api";

type Capture = {
  id: string;
  file: File;
  preview: string;
  capturedAt: string;
  label: string;
  kind: "photo" | "video";
  uploadState: "queued" | "uploading" | "ready" | "failed" | "saved";
};

export type ClaimCaptureType = "accident" | "engine_seize";

type CaptureStep = {
  label: string;
  minDurationMs?: number;
  maxDurationMs?: number;
};

const PHOTO_STEPS: CaptureStep[] = Array.from({ length: 4 }, (_, index) => ({
  label: `Photo ${index + 1}`,
}));
const VIDEO_STEPS: CaptureStep[] = Array.from({ length: 2 }, (_, index) => ({
  label: `Video ${index + 1}`,
  minDurationMs: 30_000,
  maxDurationMs: 90_000,
}));
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const VIDEO_FRAME_RATE = 24;
const VIDEO_BITS_PER_SECOND = 2_000_000;
const AUDIO_BITS_PER_SECOND = 64_000;
const VIDEO_MAX_UPLOAD_BYTES = 28 * 1024 * 1024;
const CORE_PHOTO_COUNT = 4;
const CORE_VIDEO_COUNT = 2;

type AppendResult = {
  photoCount: number;
  videoCount: number;
  coreComplete: boolean;
  canAddMore: boolean;
};

type Props = {
  truckNumber: string;
  captureType?: ClaimCaptureType;
  mode?: "wizard" | "addMore";
  initialPhotoCount?: number;
  initialVideoCount?: number;
  onClose?: () => void;
  onStateChange: (state: AppendResult) => void;
  prepareUpload: typeof getClaimEvidenceUploadTarget;
  uploadFile?: typeof uploadClaimEvidence;
  appendItem: (payload: {
    submissionId: string;
    kind: "photo" | "video";
    item: ClaimEvidenceUploadProof;
    location: ClaimLocation;
  }) => Promise<AppendResult>;
};

const getMessage = (error: unknown) => {
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return Array.isArray(message)
      ? message[0]
      : String(message || "Kuch gadbad ho gayi");
  }
  return "Kuch gadbad ho gayi";
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

export default function ClaimCaptureFlow({
  truckNumber,
  captureType = "accident",
  mode = "wizard",
  initialPhotoCount = 0,
  initialVideoCount = 0,
  onClose,
  onStateChange,
  prepareUpload,
  uploadFile = uploadClaimEvidence,
  appendItem,
}: Props) {
  const addMore = mode === "addMore";
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
  const serverPhotoCountRef = useRef(initialPhotoCount);
  const serverVideoCountRef = useRef(initialVideoCount);

  const [serverPhotoCount, setServerPhotoCount] = useState(initialPhotoCount);
  const [serverVideoCount, setServerVideoCount] = useState(initialVideoCount);
  const [pending, setPending] = useState<Capture[]>([]);
  const [addMoreKind, setAddMoreKind] = useState<"photo" | "video">("photo");
  const [location, setLocation] = useState<ClaimLocation | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [videoProfileReady, setVideoProfileReady] = useState(false);
  const [photoCaptureBusy, setPhotoCaptureBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);
  const [minVideoPopup, setMinVideoPopup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingPhotos = pending.filter((item) => item.kind === "photo").length;
  const pendingVideos = pending.filter((item) => item.kind === "video").length;
  const photoDone = serverPhotoCount >= CORE_PHOTO_COUNT;
  const videoDone = serverVideoCount >= CORE_VIDEO_COUNT;
  const capturingPhotos =
    !addMore && serverPhotoCount + pendingPhotos < CORE_PHOTO_COUNT;
  const capturingVideos =
    !addMore &&
    photoDone &&
    pendingPhotos === 0 &&
    serverVideoCount + pendingVideos < CORE_VIDEO_COUNT;
  const currentPhotoStep =
    PHOTO_STEPS[
      Math.min(serverPhotoCount + pendingPhotos, CORE_PHOTO_COUNT - 1)
    ];
  const currentVideoStep =
    VIDEO_STEPS[
      Math.min(serverVideoCount + pendingVideos, CORE_VIDEO_COUNT - 1)
    ];
  const activeVideoStep = addMore
    ? { label: "Video", minDurationMs: 30_000, maxDurationMs: 90_000 }
    : currentVideoStep;
  const recordingLimitMs = activeVideoStep?.maxDurationMs || 90_000;
  const recordingSeconds = Math.min(
    Math.floor(recordingElapsed / 1000),
    recordingLimitMs / 1000,
  );

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

  const updateCaptureState = useCallback(
    (captureId: string, uploadState: Capture["uploadState"]) => {
      setPending((items) =>
        items.map((item) =>
          item.id === captureId ? { ...item, uploadState } : item,
        ),
      );
    },
    [],
  );

  const persistCapture = useCallback(
    async (capture: Capture, proof: ClaimEvidenceUploadProof) => {
      const currentLocation = locationRef.current;
      if (!currentLocation) throw new Error("Location nahi mili, dubara try karo");
      const state = await appendItem({
        submissionId: submissionIdRef.current,
        kind: capture.kind,
        item: { ...proof, label: capture.label },
        location: currentLocation,
      });
      serverPhotoCountRef.current = state.photoCount;
      serverVideoCountRef.current = state.videoCount;
      setServerPhotoCount(state.photoCount);
      setServerVideoCount(state.videoCount);
      updateCaptureState(capture.id, "saved");
      setPending((items) => items.filter((item) => item.id !== capture.id));
      URL.revokeObjectURL(capture.preview);
      showCaptureFeedback("✓ Admin ko mil gaya");
      onStateChange(state);
      return state;
    },
    [appendItem, onStateChange, showCaptureFeedback, updateCaptureState],
  );

  const beginBackgroundUpload = useCallback(
    (capture: Capture) => {
      const generation = uploadGenerationRef.current;
      const submissionId = submissionIdRef.current;
      const task = uploadQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== uploadGenerationRef.current) {
            throw new Error("Capture reset");
          }
          if (
            capture.file.type.startsWith("video/") &&
            capture.file.size > VIDEO_MAX_UPLOAD_BYTES
          ) {
            throw new Error("Video bada ho gaya, dubara chhota record karo");
          }
          updateCaptureState(capture.id, "uploading");
          const target = await prepareUpload(submissionId);
          const proof = await uploadFile(
            target,
            capture.file,
            capture.capturedAt,
          );
          if (generation !== uploadGenerationRef.current) {
            throw new Error("Capture reset");
          }
          updateCaptureState(capture.id, "ready");
          return persistCapture(capture, proof);
        });

      uploadQueueRef.current = task.then(
        () => undefined,
        () => undefined,
      );
      void task.catch((uploadError) => {
        if (generation === uploadGenerationRef.current) {
          updateCaptureState(capture.id, "failed");
          setError(getMessage(uploadError));
        }
      });
      return task;
    },
    [persistCapture, prepareUpload, updateCaptureState, uploadFile],
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
      setError("Location nahi chal raha");
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
            ? "Location allow karo"
            : "Location nahi mili, dubara try karo",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError("HTTPS pe kholo");
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
          ? "Camera allow karo"
          : name === "NotFoundError"
            ? "Camera nahi mili"
            : name === "OverconstrainedError"
              ? "Pichhli camera chahiye"
              : "Camera start nahi hui",
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    startLocation();
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
  }, [startCamera, startLocation, stopCamera]);

  useEffect(() => {
    capturesRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const needVideoProfile =
      addMore || (photoDone && !videoDone) || addMoreKind === "video";
    if (!needVideoProfile || !cameraReady) return;

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
          frameRate: { ideal: VIDEO_FRAME_RATE, max: VIDEO_FRAME_RATE },
        });
      } catch {
        try {
          await videoTrack.applyConstraints({
            frameRate: { ideal: VIDEO_FRAME_RATE, max: VIDEO_FRAME_RATE },
          });
        } catch {
          // Bitrate cap still keeps uploads under the size gate.
        }
      }
    };

    void prepareCompactVideo().finally(() => {
      if (!cancelled) setVideoProfileReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [addMore, addMoreKind, cameraReady, photoDone, videoDone]);

  const enqueueCapture = (capture: Capture) => {
    setPending((items) => [...items, capture]);
    void beginBackgroundUpload(capture).catch(() => undefined);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canTakeWizard = capturingPhotos;
    const canTakeAddMore = addMore && addMoreKind === "photo";
    if (
      !video ||
      !cameraReady ||
      photoCaptureBusyRef.current ||
      (!canTakeWizard && !canTakeAddMore)
    ) {
      return;
    }
    if (!locationRef.current) {
      setError("Location nahi mili, dubara try karo");
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
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    const capturedAt = new Date().toISOString();
    const label = addMore
      ? `Photo ${serverPhotoCount + pendingPhotos + 1}`
      : PHOTO_STEPS[Math.min(serverPhotoCount + pendingPhotos, CORE_PHOTO_COUNT - 1)]
          .label;
    canvas.toBlob(
      (blob) => {
        photoCaptureBusyRef.current = false;
        setPhotoCaptureBusy(false);
        if (!blob) return setError("Photo nahi bani, dubara lo");
        const file = new File(
          [blob],
          `${captureType}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`,
          { type: "image/jpeg", lastModified: Date.now() },
        );
        const capture: Capture = {
          id: `${submissionIdRef.current}-photo-${Date.now()}`,
          file,
          preview: URL.createObjectURL(file),
          capturedAt,
          label,
          kind: "photo",
          uploadState: "queued",
        };
        enqueueCapture(capture);
      },
      "image/jpeg",
      0.76,
    );
  };

  const stopRecording = (force = false) => {
    const minMs = activeVideoStep?.minDurationMs || 30_000;
    const elapsed = performance.now() - recordingStartedAtRef.current;
    if (!force && recorderRef.current?.state === "recording" && elapsed < minMs) {
      const remainingSec = Math.ceil((minMs - elapsed) / 1000);
      setMinVideoPopup(`Thoda aur chalao — ~${remainingSec} sec baki`);
      return;
    }
    setMinVideoPopup(null);
    clearRecordingTimers();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = () => {
    const canRecordWizard = capturingVideos;
    const canRecordAddMore = addMore && addMoreKind === "video";
    if (
      !streamRef.current ||
      !videoProfileReady ||
      recording ||
      (!canRecordWizard && !canRecordAddMore) ||
      typeof MediaRecorder === "undefined"
    ) {
      if (typeof MediaRecorder === "undefined")
        setError("Video support nahi hai");
      return;
    }
    if (!locationRef.current) {
      setError("Location nahi mili, dubara try karo");
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
        setError("Video nahi bani, dubara lo");
      } else if (blob.size > VIDEO_MAX_UPLOAD_BYTES) {
        setError("Video bada ho gaya, dubara chhota record karo");
      } else {
        const label = addMore
          ? `Video ${serverVideoCount + pendingVideos + 1}`
          : VIDEO_STEPS[
              Math.min(serverVideoCount + pendingVideos, CORE_VIDEO_COUNT - 1)
            ].label;
        const extension = finalType.includes("mp4") ? "mp4" : "webm";
        const file = new File(
          [blob],
          `${captureType}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extension}`,
          {
            type: finalType.split(";")[0],
            lastModified: Date.now(),
          },
        );
        const capture: Capture = {
          id: `${submissionIdRef.current}-video-${Date.now()}`,
          file,
          preview: URL.createObjectURL(file),
          capturedAt: new Date().toISOString(),
          label,
          kind: "video",
          uploadState: "queued",
        };
        enqueueCapture(capture);
      }
      setRecording(false);
      setRecordingElapsed(0);
    };
    recorder.start(1000);
    recordingStartedAtRef.current = performance.now();
    setRecordingElapsed(0);
    setRecording(true);
    recordTickRef.current = setInterval(() => {
      setRecordingElapsed(
        Math.min(performance.now() - recordingStartedAtRef.current, recordingLimitMs),
      );
    }, 100);
    recordTimerRef.current = setTimeout(() => stopRecording(true), recordingLimitMs);
  };

  const showPhotoShutter =
    (capturingPhotos || (addMore && addMoreKind === "photo")) && !recording;
  const showVideoShutter =
    capturingVideos || (addMore && addMoreKind === "video");

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0d1117] text-white">
      <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4">
        <span className="text-sm font-bold">
          {captureType === "engine_seize" ? "Engine seize" : "Accident"} ·{" "}
          {truckNumber.toUpperCase()}
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 px-2 text-sm text-white/80"
          >
            Band
          </button>
        ) : (
          <span aria-hidden="true" className="w-10" />
        )}
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-contain"
        />
        <div className="absolute left-3 right-3 top-3 rounded-2xl border border-white/15 bg-black/75 px-4 py-3 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-sm font-black">
            <span>
              {addMore
                ? addMoreKind === "photo"
                  ? "Aur photo"
                  : "Aur video"
                : capturingPhotos
                  ? currentPhotoStep?.label || "Photo"
                  : currentVideoStep?.label || "Video"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs text-[#111827]">
              {addMore
                ? `${serverPhotoCount}p · ${serverVideoCount}v`
                : capturingPhotos
                  ? `${Math.min(serverPhotoCount + pendingPhotos + 1, CORE_PHOTO_COUNT)} / ${CORE_PHOTO_COUNT}`
                  : `${Math.min(serverVideoCount + pendingVideos + 1, CORE_VIDEO_COUNT)} / ${CORE_VIDEO_COUNT}`}
            </span>
          </div>
          {!addMore && (
            <div className="mt-2 flex gap-2" aria-hidden="true">
              {Array.from({
                length: capturingPhotos ? CORE_PHOTO_COUNT : CORE_VIDEO_COUNT,
              }).map((_, index) => {
                const complete =
                  index <
                  (capturingPhotos
                    ? serverPhotoCount + pendingPhotos
                    : serverVideoCount + pendingVideos);
                const current =
                  index ===
                  (capturingPhotos
                    ? serverPhotoCount + pendingPhotos
                    : serverVideoCount + pendingVideos);
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
          )}
          {(recording || captureFeedback) && (
            <p
              className={`mt-2 text-center text-sm font-bold ${
                captureFeedback ? "text-emerald-300" : "text-white"
              }`}
              aria-live="polite"
            >
              {recording
                ? `● ${formatDuration(recordingSeconds)} / ${formatDuration(recordingLimitMs / 1000)}`
                : captureFeedback}
            </p>
          )}
        </div>

        {addMore && !recording && (
          <div className="absolute bottom-28 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/70 p-1">
            <button
              type="button"
              onClick={() => setAddMoreKind("photo")}
              className={`min-h-10 rounded-full px-4 text-sm font-black ${
                addMoreKind === "photo" ? "bg-white text-[#111827]" : "text-white/80"
              }`}
            >
              Photo
            </button>
            <button
              type="button"
              onClick={() => setAddMoreKind("video")}
              className={`min-h-10 rounded-full px-4 text-sm font-black ${
                addMoreKind === "video" ? "bg-white text-[#111827]" : "text-white/80"
              }`}
            >
              Video
            </button>
          </div>
        )}

        {minVideoPopup && (
          <div className="absolute inset-x-8 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-white/20 bg-black/90 px-5 py-4 text-center shadow-xl">
            <p className="text-base font-black">{minVideoPopup}</p>
            <button
              type="button"
              onClick={() => setMinVideoPopup(null)}
              className="mt-3 min-h-10 rounded-xl bg-white px-4 text-sm font-black text-[#111827]"
            >
              Theek hai
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 bg-[#0d1117] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {error && (
          <p className="mb-2 text-center text-sm font-bold text-amber-300">
            {error}
          </p>
        )}
        {!location && (
          <p className="mb-2 text-center text-xs font-bold text-white/60">
            Location aa raha…
          </p>
        )}
        <div className="flex items-center justify-center gap-4">
          {showPhotoShutter && (
            <button
              type="button"
              onClick={takePhoto}
              disabled={!cameraReady || photoCaptureBusy || !location}
              className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-white/15 disabled:opacity-40"
              aria-label="Photo lo"
            >
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>
          )}
          {showVideoShutter && (
            <button
              type="button"
              onClick={() => (recording ? stopRecording() : startRecording())}
              disabled={
                (!recording && (!cameraReady || !videoProfileReady || !location)) ||
                false
              }
              className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-white/15 disabled:opacity-40"
              aria-label={recording ? "Video band" : "Video chalu"}
            >
              <span
                className={`transition-all ${
                  recording
                    ? "h-8 w-8 rounded-md bg-red-500"
                    : "h-14 w-14 rounded-full bg-red-500"
                }`}
              />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs font-bold text-white/55">
          {showPhotoShutter
            ? "Photo lo"
            : recording
              ? "Band karne ke liye dabao"
              : showVideoShutter
                ? "Video chalu"
                : "Save ho raha…"}
        </p>
      </footer>
    </div>
  );
}

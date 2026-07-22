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

type Capture = {
  id: string;
  file: File;
  preview: string;
  capturedAt: string;
  uploadState: "queued" | "uploading" | "ready" | "failed";
};

const PHOTO_TOTAL = 4;
const VIDEO_TOTAL = 2;
const RECORDING_LIMIT_MS = 8000;

type ClaimEvidenceSubmission = Parameters<typeof createClaimWithEvidence>[0];

type Props<TResult> = {
  truckNumber: string;
  onClose?: () => void;
  onSubmitted: (claim: TResult) => void;
  prepareUpload?: typeof getClaimEvidenceUploadTarget;
  uploadFile?: typeof uploadClaimEvidence;
  sendEvidence?: (payload: ClaimEvidenceSubmission) => Promise<TResult>;
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
}: Props<TResult>) {
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
  const [photoCaptureBusy, setPhotoCaptureBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

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
          const proof = await uploadFile(target, capture.file, capture.capturedAt);
          if (generation === uploadGenerationRef.current) {
            uploadProofsRef.current.set(capture.id, proof);
            updateCaptureUploadState(capture.id, "ready");
          }
          return proof;
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
        audio: false,
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
          ? "Allow camera access"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "Rear camera not available"
            : "Camera could not start",
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
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
  }, [startCamera, stopCamera]);

  useEffect(() => {
    capturesRef.current = [...photos, ...videos];
  }, [photos, videos]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (
      !video ||
      !cameraReady ||
      photoCaptureBusyRef.current ||
      photos.length >= PHOTO_TOTAL
    ) {
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
    canvas.toBlob(
      (blob) => {
        photoCaptureBusyRef.current = false;
        setPhotoCaptureBusy(false);
        if (!blob) return setError("Photo failed. Try again");
        const photoNumber = photos.length + 1;
        const capturedAt = new Date().toISOString();
        const file = new File([blob], `claim-photo-${photoNumber}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        const capture: Capture = {
          id: `${submissionIdRef.current}-photo-${photoNumber}`,
          file,
          preview: URL.createObjectURL(file),
          capturedAt,
          uploadState: "queued",
        };
        setPhotos((items) => [...items, capture]);
        showCaptureFeedback(
          photoNumber === PHOTO_TOTAL
            ? "All 4 photos captured"
            : `Photo ${photoNumber} saved · ${PHOTO_TOTAL - photoNumber} left`,
        );
        void beginBackgroundUpload(capture).catch(() => undefined);
      },
      "image/jpeg",
      0.76,
    );
  };

  const stopRecording = () => {
    clearRecordingTimers();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = () => {
    if (
      !streamRef.current ||
      recording ||
      videos.length >= VIDEO_TOTAL ||
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
      videoBitsPerSecond: 1_000_000,
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
        const capturedAt = new Date().toISOString();
        const extension = finalType.includes("mp4") ? "mp4" : "webm";
        const file = new File(
          [blob],
          `claim-video-${videoNumber}.${extension}`,
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
          uploadState: "queued",
        };
        setVideos((items) => [...items, capture]);
        showCaptureFeedback(
          videoNumber === VIDEO_TOTAL
            ? "Both videos captured"
            : `Video ${videoNumber} saved · 1 left`,
        );
        void beginBackgroundUpload(capture).catch(() => undefined);
      }
      setRecording(false);
      setRecordingElapsed(0);
    };
    recorder.start(500);
    recordingStartedAtRef.current = performance.now();
    setRecordingElapsed(0);
    setRecording(true);
    recordTickRef.current = setInterval(() => {
      setRecordingElapsed(
        Math.min(
          performance.now() - recordingStartedAtRef.current,
          RECORDING_LIMIT_MS,
        ),
      );
    }, 100);
    recordTimerRef.current = setTimeout(stopRecording, RECORDING_LIMIT_MS);
  };

  useEffect(() => {
    if (photos.length === PHOTO_TOTAL && videos.length === VIDEO_TOTAL) {
      stopCamera();
      startLocation();
    }
  }, [photos.length, videos.length, startLocation, stopCamera]);

  const reset = () => {
    capturesRef.current.forEach((capture) =>
      URL.revokeObjectURL(capture.preview),
    );
    setPhotos([]);
    setVideos([]);
    locationRef.current = null;
    setLocation(null);
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
      photos.length !== PHOTO_TOTAL ||
      videos.length !== VIDEO_TOTAL ||
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
      });
      onSubmitted(claim);
    } catch (submitError) {
      setError(getMessage(submitError));
    } finally {
      setFinalizing(false);
      setSending(false);
    }
  };

  const capturingPhotos = photos.length < PHOTO_TOTAL;
  const capturingVideos =
    photos.length === PHOTO_TOTAL && videos.length < VIDEO_TOTAL;
  const reviewing =
    photos.length === PHOTO_TOTAL && videos.length === VIDEO_TOTAL;
  const readyUploads = [...photos, ...videos].filter(
    (capture) => capture.uploadState === "ready",
  ).length;
  const recordingProgress = Math.min(recordingElapsed / RECORDING_LIMIT_MS, 1);
  const recordingSeconds = Math.min(
    Math.floor(recordingElapsed / 1000),
    RECORDING_LIMIT_MS / 1000,
  );

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0d1117] text-white">
      <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4">
        <span className="text-sm font-bold">
          Claim · {truckNumber.toUpperCase()}
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
          <div className="absolute left-3 right-3 top-3 rounded-2xl border border-white/15 bg-black/75 px-4 py-3 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between text-sm font-black">
              <span>{capturingPhotos ? "Photos" : "Videos"}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs text-[#111827]">
                {capturingPhotos
                  ? `${photos.length} / ${PHOTO_TOTAL}`
                  : `${videos.length} / ${VIDEO_TOTAL}`}
              </span>
            </div>
            <div className="mt-2 flex gap-2" aria-hidden="true">
              {Array.from({
                length: capturingPhotos ? PHOTO_TOTAL : VIDEO_TOTAL,
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
                ? `● Recording 00:${String(recordingSeconds).padStart(2, "0")} / 00:08`
                : captureFeedback ||
                  (capturingPhotos
                    ? `${PHOTO_TOTAL - photos.length} photos remaining`
                    : `${VIDEO_TOTAL - videos.length} videos remaining`)}
            </p>
          </div>
        </main>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f5f6f8] p-4 text-[#172033]">
          <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <div key={photo.preview} className="relative">
                <img
                  src={photo.preview}
                  alt={`Photo ${index + 1}`}
                  className="aspect-square w-full rounded-lg bg-black object-cover"
                />
                <UploadBadge state={photo.uploadState} />
              </div>
            ))}
            {videos.map((video, index) => (
              <div key={video.preview} className="relative">
                <video
                  src={video.preview}
                  aria-label={`Video ${index + 1}`}
                  controls
                  preload="metadata"
                  className="aspect-square w-full rounded-lg bg-black object-cover"
                />
                <UploadBadge state={video.uploadState} />
              </div>
            ))}
          </div>
          <div className="mx-auto mt-4 max-w-xl divide-y divide-slate-100 rounded-xl bg-white px-4 text-sm font-bold">
            <div className="flex items-center justify-between py-3">
              <span>Evidence</span>
              <span
                className={
                  readyUploads === PHOTO_TOTAL + VIDEO_TOTAL
                    ? "text-emerald-700"
                    : "text-amber-700"
                }
              >
                {readyUploads === PHOTO_TOTAL + VIDEO_TOTAL
                  ? "Ready"
                  : `Preparing ${readyUploads}/6`}
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
            <button
              type="button"
              disabled={!cameraReady || photoCaptureBusy}
              onClick={takePhoto}
              className="mx-auto block h-16 w-16 rounded-full border-4 border-white bg-white/20 shadow-[0_0_0_5px_rgba(255,255,255,0.12)] active:scale-95 disabled:opacity-40"
              aria-label={`Take photo ${photos.length + 1} of ${PHOTO_TOTAL}`}
            />
            <p className="mt-2 text-xs font-bold text-white/70">
              Photo {photos.length + 1} of {PHOTO_TOTAL}
            </p>
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
                disabled={!cameraReady}
                onClick={recording ? stopRecording : startRecording}
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
              className={`mt-2 text-xs font-black ${
                recording ? "text-red-300" : "text-white/75"
              }`}
            >
              {recording
                ? "Recording · tap to finish"
                : `Start video ${videos.length + 1} of ${VIDEO_TOTAL}`}
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
                  : `Finishing uploads ${readyUploads}/6`
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

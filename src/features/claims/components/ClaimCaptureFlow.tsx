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
  file?: File;
  preview: string;
  capturedAt: string;
  label: string;
  kind: "photo" | "video";
  uploadState: "queued" | "uploading" | "ready" | "failed" | "saved";
  fromServer?: boolean;
};

export type ClaimCaptureType = "accident" | "engine_seize";

type CaptureStep = {
  label: string;
  minDurationMs?: number;
  maxDurationMs?: number;
};

type GallerySeed = {
  url: string;
  label?: string | null;
  kind: "photo" | "video";
  capturedAt: string;
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
  initialMedia?: GallerySeed[];
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

const waitForLocation = (
  getLocation: () => ClaimLocation | null,
  timeoutMs = 45_000,
) =>
  new Promise<ClaimLocation>((resolve, reject) => {
    const existing = getLocation();
    if (existing) {
      resolve(existing);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const current = getLocation();
      if (current) {
        clearInterval(timer);
        resolve(current);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error("Location nahi mili, dubara try karo"));
      }
    }, 250);
  });

export default function ClaimCaptureFlow({
  truckNumber,
  captureType = "accident",
  mode = "wizard",
  initialPhotoCount = 0,
  initialVideoCount = 0,
  initialMedia = [],
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
  const locationWatchRef = useRef<number | null>(null);
  const locationRef = useRef<ClaimLocation | null>(null);
  const sessionItemsRef = useRef<Capture[]>([]);
  const submissionIdRef = useRef(createSubmissionId());
  const uploadGenerationRef = useRef(0);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const baselinePhotosRef = useRef(initialPhotoCount);
  const baselineVideosRef = useRef(initialVideoCount);

  const [sessionItems, setSessionItems] = useState<Capture[]>([]);
  const [freeCapture, setFreeCapture] = useState(addMore);
  const [captureKind, setCaptureKind] = useState<"photo" | "video">(
    addMore || initialPhotoCount >= CORE_PHOTO_COUNT ? "video" : "photo",
  );
  const [showGallery, setShowGallery] = useState(false);
  const [location, setLocation] = useState<ClaimLocation | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [videoProfileReady, setVideoProfileReady] = useState(false);
  const [photoCaptureBusy, setPhotoCaptureBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [minVideoPopup, setMinVideoPopup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionPhotos = sessionItems.filter((item) => item.kind === "photo")
    .length;
  const sessionVideos = sessionItems.filter((item) => item.kind === "video")
    .length;
  const totalPhotos = baselinePhotosRef.current + sessionPhotos;
  const totalVideos = baselineVideosRef.current + sessionVideos;
  const photoDone = totalPhotos >= CORE_PHOTO_COUNT;
  const videoDone = totalVideos >= CORE_VIDEO_COUNT;
  const coreFilled = photoDone && videoDone;
  const inFreeMode = freeCapture || addMore;
  const wizardJustFinished = !inFreeMode && coreFilled;

  const activeVideoStep = inFreeMode
    ? { label: "Video", minDurationMs: 30_000, maxDurationMs: 90_000 }
    : VIDEO_STEPS[Math.min(totalVideos, CORE_VIDEO_COUNT - 1)];
  const recordingLimitMs = activeVideoStep?.maxDurationMs || 90_000;
  const recordingSeconds = Math.min(
    Math.floor(recordingElapsed / 1000),
    recordingLimitMs / 1000,
  );

  const galleryItems: Capture[] = [
    ...initialMedia.map((item, index) => ({
      id: `server-${item.kind}-${index}`,
      preview: item.url,
      capturedAt: item.capturedAt,
      label: item.label || (item.kind === "photo" ? "Photo" : "Video"),
      kind: item.kind,
      uploadState: "saved" as const,
      fromServer: true,
    })),
    ...sessionItems,
  ];

  const clearRecordingTimers = useCallback(() => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    if (recordTickRef.current) clearInterval(recordTickRef.current);
    recordTimerRef.current = null;
    recordTickRef.current = null;
  }, []);

  const updateCaptureState = useCallback(
    (captureId: string, uploadState: Capture["uploadState"]) => {
      setSessionItems((items) =>
        items.map((item) =>
          item.id === captureId ? { ...item, uploadState } : item,
        ),
      );
    },
    [],
  );

  const persistCapture = useCallback(
    async (capture: Capture, proof: ClaimEvidenceUploadProof) => {
      const currentLocation = await waitForLocation(() => locationRef.current);
      const state = await appendItem({
        submissionId: submissionIdRef.current,
        kind: capture.kind,
        item: { ...proof, label: capture.label },
        location: currentLocation,
      });
      updateCaptureState(capture.id, "saved");
      onStateChange(state);
      return state;
    },
    [appendItem, onStateChange, updateCaptureState],
  );

  const beginBackgroundUpload = useCallback(
    (capture: Capture) => {
      if (!capture.file) return Promise.resolve();
      const generation = uploadGenerationRef.current;
      const submissionId = submissionIdRef.current;
      const file = capture.file;
      const task = uploadQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== uploadGenerationRef.current) {
            throw new Error("Capture reset");
          }
          if (
            file.type.startsWith("video/") &&
            file.size > VIDEO_MAX_UPLOAD_BYTES
          ) {
            throw new Error("Video bada ho gaya, dubara chhota record karo");
          }
          updateCaptureState(capture.id, "uploading");
          const target = await prepareUpload(submissionId);
          const proof = await uploadFile(target, file, capture.capturedAt);
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
      sessionItemsRef.current.forEach((capture) => {
        if (!capture.fromServer) URL.revokeObjectURL(capture.preview);
      });
    };
  }, [startCamera, startLocation, stopCamera]);

  useEffect(() => {
    sessionItemsRef.current = sessionItems;
  }, [sessionItems]);

  useEffect(() => {
    if (!inFreeMode && photoDone && captureKind === "photo" && !videoDone) {
      setCaptureKind("video");
    }
  }, [captureKind, inFreeMode, photoDone, videoDone]);

  useEffect(() => {
    if (wizardJustFinished) setShowGallery(true);
  }, [wizardJustFinished]);

  useEffect(() => {
    const needVideoProfile = captureKind === "video" || recording;
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
  }, [cameraReady, captureKind, recording]);

  const enqueueCapture = (capture: Capture) => {
    setSessionItems((items) => [...items, capture]);
    navigator.vibrate?.(25);
    void beginBackgroundUpload(capture).catch(() => undefined);
  };

  const canTakePhoto =
    !recording &&
    (inFreeMode
      ? captureKind === "photo"
      : !photoDone && captureKind === "photo");
  const canRecordVideo = inFreeMode
    ? captureKind === "video"
    : photoDone && !videoDone && captureKind === "video";

  const takePhoto = () => {
    const video = videoRef.current;
    if (
      !video ||
      !cameraReady ||
      photoCaptureBusyRef.current ||
      !canTakePhoto
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
    const capturedAt = new Date().toISOString();
    const label = inFreeMode
      ? `Photo ${totalPhotos + 1}`
      : PHOTO_STEPS[Math.min(totalPhotos, CORE_PHOTO_COUNT - 1)].label;
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
        enqueueCapture({
          id: `${submissionIdRef.current}-photo-${Date.now()}`,
          file,
          preview: URL.createObjectURL(file),
          capturedAt,
          label,
          kind: "photo",
          uploadState: "queued",
        });
      },
      "image/jpeg",
      0.76,
    );
  };

  const stopRecording = (force = false) => {
    const minMs = activeVideoStep?.minDurationMs || 30_000;
    const elapsed = performance.now() - recordingStartedAtRef.current;
    if (
      !force &&
      recorderRef.current?.state === "recording" &&
      elapsed < minMs
    ) {
      const remainingSec = Math.ceil((minMs - elapsed) / 1000);
      setMinVideoPopup(`Thoda aur chalao — ~${remainingSec} sec baki`);
      return;
    }
    setMinVideoPopup(null);
    clearRecordingTimers();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = () => {
    if (
      !streamRef.current ||
      !videoProfileReady ||
      recording ||
      !canRecordVideo ||
      typeof MediaRecorder === "undefined"
    ) {
      if (typeof MediaRecorder === "undefined")
        setError("Video support nahi hai");
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
        const label = inFreeMode
          ? `Video ${totalVideos + 1}`
          : VIDEO_STEPS[Math.min(totalVideos, CORE_VIDEO_COUNT - 1)].label;
        const extension = finalType.includes("mp4") ? "mp4" : "webm";
        const file = new File(
          [blob],
          `${captureType}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extension}`,
          {
            type: finalType.split(";")[0],
            lastModified: Date.now(),
          },
        );
        enqueueCapture({
          id: `${submissionIdRef.current}-video-${Date.now()}`,
          file,
          preview: URL.createObjectURL(file),
          capturedAt: new Date().toISOString(),
          label,
          kind: "video",
          uploadState: "queued",
        });
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
        Math.min(
          performance.now() - recordingStartedAtRef.current,
          recordingLimitMs,
        ),
      );
    }, 100);
    recordTimerRef.current = setTimeout(
      () => stopRecording(true),
      recordingLimitMs,
    );
  };

  const showKindSwitch =
    !recording && (inFreeMode || (photoDone && !wizardJustFinished));

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0d1117] text-white">
      <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4">
        <span className="text-sm font-bold">
          {captureType === "engine_seize" ? "Engine seize" : "Accident"} ·{" "}
          {truckNumber.toUpperCase()}
        </span>
        <button
          type="button"
          onClick={() => setShowGallery(true)}
          className="min-h-10 px-2 text-sm font-bold text-white"
        >
          Gallery
          {galleryItems.length > 0 ? ` (${galleryItems.length})` : ""}
        </button>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-contain"
        />

        {!inFreeMode && !wizardJustFinished && (
          <div className="absolute left-3 right-3 top-3 flex gap-1.5">
            {Array.from({
              length: photoDone ? CORE_VIDEO_COUNT : CORE_PHOTO_COUNT,
            }).map((_, index) => {
              const doneCount = photoDone ? totalVideos : totalPhotos;
              return (
                <span
                  key={index}
                  className={`h-1 flex-1 rounded-full ${
                    index < doneCount ? "bg-white" : "bg-white/25"
                  }`}
                />
              );
            })}
          </div>
        )}

        {recording && (
          <p className="absolute left-0 right-0 top-8 text-center text-sm font-bold">
            ● {formatDuration(recordingSeconds)} /{" "}
            {formatDuration(recordingLimitMs / 1000)}
          </p>
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

        {showKindSwitch && (
          <div className="mb-3 flex justify-center">
            <div className="flex gap-1 rounded-full bg-white/10 p-1">
              {(inFreeMode || !photoDone) && (
                <button
                  type="button"
                  onClick={() => setCaptureKind("photo")}
                  className={`min-h-10 rounded-full px-5 text-sm font-black ${
                    captureKind === "photo"
                      ? "bg-white text-[#111827]"
                      : "text-white/75"
                  }`}
                >
                  Photo
                </button>
              )}
              {(inFreeMode || photoDone) && (
                <button
                  type="button"
                  onClick={() => setCaptureKind("video")}
                  className={`min-h-10 rounded-full px-5 text-sm font-black ${
                    captureKind === "video"
                      ? "bg-white text-[#111827]"
                      : "text-white/75"
                  }`}
                >
                  Video
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center">
          {canTakePhoto && (
            <button
              type="button"
              onClick={takePhoto}
              disabled={!cameraReady || photoCaptureBusy}
              className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-white/15 disabled:opacity-40"
              aria-label="Photo lo"
            >
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>
          )}
          {(canRecordVideo || recording) && (
            <button
              type="button"
              onClick={() => (recording ? stopRecording() : startRecording())}
              disabled={!recording && (!cameraReady || !videoProfileReady)}
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
          {recording
            ? "Band karne ke liye dabao"
            : canTakePhoto
              ? "Photo lo"
              : canRecordVideo
                ? "Video chalu"
                : "Gallery dekho"}
        </p>
      </footer>

      {showGallery && (
        <div className="absolute inset-0 z-20 flex flex-col bg-[#0d1117]">
          <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4">
            <span className="text-sm font-bold">Gallery</span>
            <button
              type="button"
              onClick={() => {
                if (wizardJustFinished && !freeCapture) onClose?.();
                else setShowGallery(false);
              }}
              className="min-h-10 px-2 text-sm font-bold text-white/80"
            >
              {wizardJustFinished && !freeCapture ? "Ho gaya" : "Wapas"}
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {galleryItems.length === 0 ? (
              <p className="mt-10 text-center text-sm font-bold text-white/55">
                Abhi kuch nahi hai
              </p>
            ) : (
              <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
                {galleryItems.map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square overflow-hidden rounded-xl bg-black"
                  >
                    {item.kind === "video" ? (
                      <video
                        src={item.preview}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={item.preview}
                        alt={item.label}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">
                      {item.kind === "video" ? "Video" : "Photo"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={() => {
                setFreeCapture(true);
                setCaptureKind("photo");
                setShowGallery(false);
              }}
              className="min-h-14 w-full rounded-2xl bg-white text-base font-black text-[#111827]"
            >
              Aur kheecho
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

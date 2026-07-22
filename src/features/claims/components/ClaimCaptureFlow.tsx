"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClaimLocation,
  ClaimRequest,
  createClaimWithEvidence,
  getClaimEvidenceUploadTarget,
  uploadClaimEvidence,
} from "@/features/insurance/api";

type Capture = {
  file: File;
  preview: string;
  capturedAt: string;
};

type Props = {
  truckNumber: string;
  onClose: () => void;
  onSubmitted: (claim: ClaimRequest) => void;
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

export default function ClaimCaptureFlow({
  truckNumber,
  onClose,
  onSubmitted,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const locationRef = useRef<ClaimLocation | null>(null);
  const capturesRef = useRef<Capture[]>([]);
  const submissionIdRef = useRef(createSubmissionId());

  const [photos, setPhotos] = useState<Capture[]>([]);
  const [videos, setVideos] = useState<Capture[]>([]);
  const [location, setLocation] = useState<ClaimLocation | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);

  const stopCamera = useCallback(() => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    recordTimerRef.current = null;
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setRecording(false);
  }, []);

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
            ? "Allow location access, then retry"
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
          facingMode: { ideal: "environment" },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
        },
        audio: false,
      });
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
          : "Camera could not start",
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
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
    if (!video || !cameraReady || photos.length >= 4) return;
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
        if (!blob) return setError("Photo failed. Try again");
        const capturedAt = new Date().toISOString();
        const file = new File([blob], `claim-photo-${photos.length + 1}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        setPhotos((items) => [
          ...items,
          { file, preview: URL.createObjectURL(file), capturedAt },
        ]);
      },
      "image/jpeg",
      0.8,
    );
  };

  const stopRecording = () => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    recordTimerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = () => {
    if (
      !streamRef.current ||
      recording ||
      videos.length >= 2 ||
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
      videoBitsPerSecond: 1_500_000,
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
        const capturedAt = new Date().toISOString();
        const extension = finalType.includes("mp4") ? "mp4" : "webm";
        const file = new File(
          [blob],
          `claim-video-${videos.length + 1}.${extension}`,
          {
            type: finalType.split(";")[0],
            lastModified: Date.now(),
          },
        );
        setVideos((items) => [
          ...items,
          { file, preview: URL.createObjectURL(file), capturedAt },
        ]);
      }
      setRecording(false);
    };
    recorder.start(500);
    setRecording(true);
    recordTimerRef.current = setTimeout(stopRecording, 8000);
  };

  useEffect(() => {
    if (photos.length === 4 && videos.length === 2) {
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
    setProgress(0);
    submissionIdRef.current = createSubmissionId();
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    void startCamera();
  };

  const submit = async () => {
    if (photos.length !== 4 || videos.length !== 2 || !location || sending)
      return;
    setSending(true);
    setError(null);
    try {
      const uploadedPhotos = [];
      const uploadedVideos = [];
      for (const capture of photos) {
        const target = await getClaimEvidenceUploadTarget(
          submissionIdRef.current,
        );
        uploadedPhotos.push(
          await uploadClaimEvidence(target, capture.file, capture.capturedAt),
        );
        setProgress((value) => value + 1);
      }
      for (const capture of videos) {
        const target = await getClaimEvidenceUploadTarget(
          submissionIdRef.current,
        );
        uploadedVideos.push(
          await uploadClaimEvidence(target, capture.file, capture.capturedAt),
        );
        setProgress((value) => value + 1);
      }
      const currentLocation = locationRef.current;
      if (!currentLocation) throw new Error("Could not get location. Retry");
      const claim = await createClaimWithEvidence({
        truckNumber,
        submissionId: submissionIdRef.current,
        photos: uploadedPhotos,
        videos: uploadedVideos,
        location: currentLocation,
      });
      onSubmitted(claim);
    } catch (submitError) {
      setError(getMessage(submitError));
      setProgress(0);
    } finally {
      setSending(false);
    }
  };

  const capturingPhotos = photos.length < 4;
  const capturingVideos = photos.length === 4 && videos.length < 2;
  const reviewing = photos.length === 4 && videos.length === 2;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0d1117] text-white">
      <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4">
        <span className="text-sm font-bold">
          Claim · {truckNumber.toUpperCase()}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 px-2 text-sm text-white/80"
        >
          Close
        </button>
      </header>

      {!reviewing ? (
        <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-contain"
          />
          <div className="absolute left-0 right-0 top-3 text-center text-sm font-bold">
            {capturingPhotos
              ? `Photo ${photos.length + 1} of 4`
              : `Video ${videos.length + 1} of 2`}
          </div>
        </main>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f5f6f8] p-4 text-[#172033]">
          <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <img
                key={photo.preview}
                src={photo.preview}
                alt={`Photo ${index + 1}`}
                className="aspect-square w-full rounded-lg bg-black object-cover"
              />
            ))}
            {videos.map((video, index) => (
              <video
                key={video.preview}
                src={video.preview}
                aria-label={`Video ${index + 1}`}
                controls
                preload="metadata"
                className="aspect-square w-full rounded-lg bg-black object-cover"
              />
            ))}
          </div>
          <div className="mx-auto mt-4 flex max-w-xl items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-bold">
            <span>Location</span>
            <span className={location ? "text-emerald-700" : "text-amber-700"}>
              {location
                ? `Ready · ±${Math.round(location.accuracy)}m`
                : "Getting…"}
            </span>
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
          <button
            type="button"
            disabled={!cameraReady}
            onClick={takePhoto}
            className="mx-auto block h-16 w-16 rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
            aria-label="Take photo"
          />
        )}
        {capturingVideos && (
          <button
            type="button"
            disabled={!cameraReady}
            onClick={recording ? stopRecording : startRecording}
            className={`mx-auto block h-16 w-16 border-4 border-white ${recording ? "rounded-xl bg-red-600" : "rounded-full bg-red-600"}`}
            aria-label={recording ? "Stop recording" : "Start recording"}
          />
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
                ? `Sending ${Math.min(progress, 6)}/6`
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

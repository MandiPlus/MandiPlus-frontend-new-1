"use client";

import { useCallback, useEffect, useState } from "react";
import ClaimCaptureFlow from "./ClaimCaptureFlow";
import {
  appendPublicClaimEvidenceItem,
  getPublicClaimCaptureLink,
  getPublicClaimEvidenceUploadTarget,
  PublicClaimCaptureLink,
} from "@/features/insurance/api";

export default function PublicClaimCapturePage({ token }: { token: string }) {
  const [claim, setClaim] = useState<PublicClaimCaptureLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<"wizard" | "addMore" | null>(
    null,
  );

  const refresh = useCallback(async () => {
    const result = await getPublicClaimCaptureLink(token);
    setClaim(result);
    return result;
  }, [token]);

  useEffect(() => {
    let active = true;
    refresh()
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Link nahi mila",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const expired =
    !!claim?.expiresAt && new Date(claim.expiresAt).getTime() <= Date.now();

  const initialMedia = [
    ...(claim?.photos || []).map((item) => ({
      url: item.url,
      label: item.label,
      kind: "photo" as const,
      capturedAt: item.capturedAt,
    })),
    ...(claim?.videos || []).map((item) => ({
      url: item.url,
      label: item.label,
      kind: "video" as const,
      capturedAt: item.capturedAt,
    })),
  ];

  if (cameraMode && claim) {
    return (
      <ClaimCaptureFlow
        truckNumber={claim.vehicleNumber}
        captureType={claim.captureType}
        mode={cameraMode}
        initialPhotoCount={claim.photoCount || 0}
        initialVideoCount={claim.videoCount || 0}
        initialMedia={initialMedia}
        prepareUpload={(submissionId) =>
          getPublicClaimEvidenceUploadTarget(token, submissionId)
        }
        appendItem={(payload) => appendPublicClaimEvidenceItem(token, payload)}
        onClose={() => {
          void refresh().finally(() => setCameraMode(null));
        }}
        onStateChange={(state) => {
          setClaim((current) =>
            current
              ? {
                  ...current,
                  photoCount: state.photoCount,
                  videoCount: state.videoCount,
                  coreComplete: state.coreComplete,
                  canAddMore: state.canAddMore,
                  submitted: state.coreComplete,
                }
              : current,
          );
        }}
      />
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4f6f9] px-5 text-[#172033]">
      <section className="w-full max-w-sm rounded-[28px] border border-[#e1e6ee] bg-white p-6 shadow-[0_18px_60px_rgba(23,32,51,0.10)]">
        <div className="mb-8 h-1.5 w-10 rounded-full bg-[#4309ac]" />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6c7482]">
          {claim?.captureType === "engine_seize"
            ? "Engine Seize"
            : "Accident Claim"}
        </p>

        {loading ? (
          <p className="mt-4 text-lg font-black">Khul raha…</p>
        ) : error ? (
          <>
            <h1 className="mt-4 text-2xl font-black">Link nahi chala</h1>
            <p className="mt-2 text-sm font-semibold text-[#b23b3b]">{error}</p>
          </>
        ) : expired ? (
          <>
            <h1 className="mt-4 text-2xl font-black">Link band</h1>
            <p className="mt-2 text-sm font-bold text-[#6c7482]">
              Wapas naya link mango
            </p>
          </>
        ) : claim?.coreComplete ? (
          <>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700">
              ✓
            </div>
            <h1 className="mt-4 text-2xl font-black">Ho gaya</h1>
            <p className="mt-2 text-sm font-bold text-[#6c7482]">
              {claim.vehicleNumber}
            </p>
            {claim.canAddMore ? (
              <button
                type="button"
                onClick={() => setCameraMode("addMore")}
                className="mt-8 min-h-14 w-full rounded-2xl bg-[#172033] px-5 text-base font-black text-white active:scale-[0.99]"
              >
                Aur kheecho
              </button>
            ) : null}
          </>
        ) : claim ? (
          <>
            <h1 className="mt-4 text-3xl font-black tracking-tight">
              {claim.vehicleNumber}
            </h1>
            <p className="mt-1 text-sm font-bold text-[#6c7482]">
              4 photo · 2 video
            </p>
            <button
              type="button"
              onClick={() => setCameraMode("wizard")}
              className="mt-8 min-h-14 w-full rounded-2xl bg-[#172033] px-5 text-base font-black text-white active:scale-[0.99]"
            >
              {claim.photoCount > 0 || claim.videoCount > 0
                ? "Aage badho"
                : "Camera kholo"}
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

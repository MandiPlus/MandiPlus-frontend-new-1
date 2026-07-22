"use client";

import { useEffect, useState } from "react";
import ClaimCaptureFlow from "./ClaimCaptureFlow";
import {
  createPublicClaimWithEvidence,
  getPublicClaimCaptureLink,
  getPublicClaimEvidenceUploadTarget,
  PublicClaimCaptureLink,
} from "@/features/insurance/api";

export default function PublicClaimCapturePage({ token }: { token: string }) {
  const [claim, setClaim] = useState<PublicClaimCaptureLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicClaimCaptureLink(token)
      .then((result) => {
        if (active) setClaim(result);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Link not found",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (cameraOpen && claim && !claim.submitted) {
    return (
      <ClaimCaptureFlow<PublicClaimCaptureLink>
        truckNumber={claim.vehicleNumber}
        prepareUpload={(submissionId) =>
          getPublicClaimEvidenceUploadTarget(token, submissionId)
        }
        sendEvidence={(payload) =>
          createPublicClaimWithEvidence(token, payload)
        }
        onSubmitted={(submittedClaim) => {
          setClaim(submittedClaim);
          setCameraOpen(false);
        }}
      />
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4f6f9] px-5 text-[#172033]">
      <section className="w-full max-w-sm rounded-[28px] border border-[#e1e6ee] bg-white p-6 shadow-[0_18px_60px_rgba(23,32,51,0.10)]">
        <div className="mb-8 h-1.5 w-10 rounded-full bg-[#4309ac]" />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6c7482]">
          MandiPlus Claim
        </p>

        {loading ? (
          <p className="mt-4 text-lg font-black">Opening…</p>
        ) : error ? (
          <>
            <h1 className="mt-4 text-2xl font-black">Link unavailable</h1>
            <p className="mt-2 text-sm font-semibold text-[#b23b3b]">{error}</p>
          </>
        ) : claim?.submitted ? (
          <>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700">
              ✓
            </div>
            <h1 className="mt-4 text-2xl font-black">Claim sent</h1>
            <p className="mt-2 text-sm font-bold text-[#6c7482]">
              {claim.vehicleNumber}
            </p>
          </>
        ) : claim ? (
          <>
            <h1 className="mt-4 text-3xl font-black tracking-tight">
              {claim.vehicleNumber}
            </h1>
            <p className="mt-1 text-sm font-bold text-[#6c7482]">
              4 photos · 2 videos · location
            </p>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="mt-8 min-h-14 w-full rounded-2xl bg-[#172033] px-5 text-base font-black text-white active:scale-[0.99]"
            >
              Open rear camera
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { ArrowLeft, Monitor, X } from "lucide-react";

type DesktopRequiredNoticeProps = {
  variant?: "page" | "dialog";
  returnHref?: string;
  returnLabel?: string;
  onDismiss?: () => void;
};

function NoticeCard({
  variant,
  returnHref,
  returnLabel,
  onDismiss,
}: Required<Pick<DesktopRequiredNoticeProps, "variant">> &
  Omit<DesktopRequiredNoticeProps, "variant">) {
  const isDialog = variant === "dialog";

  return (
    <section className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-xl shadow-slate-200/70 sm:px-8">
      {isDialog && onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close desktop requirement notice"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <Monitor className="h-7 w-7" strokeWidth={1.7} />
      </div>

      <h1 className="mt-5 font-[family-name:var(--font-bricolage)] text-2xl font-semibold tracking-tight text-slate-950">
        Please use a desktop
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
        Open this page on a desktop or laptop to create invoices.
      </p>

      <div className="mt-6">
        {isDialog && onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Got it
          </button>
        ) : returnHref ? (
          <Link
            href={returnHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            {returnLabel || "Go back"}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export default function DesktopRequiredNotice({
  variant = "page",
  returnHref,
  returnLabel,
  onDismiss,
}: DesktopRequiredNoticeProps) {
  if (variant === "dialog") {
    return (
      <div
        className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Please use a desktop"
      >
        <NoticeCard
          variant="dialog"
          returnHref={returnHref}
          returnLabel={returnLabel}
          onDismiss={onDismiss}
        />
      </div>
    );
  }

  return (
    <main
      className="fixed inset-0 z-[2500] flex min-h-screen items-center justify-center bg-slate-100 p-5"
      role="alert"
      aria-label="Please use a desktop"
    >
      <NoticeCard
        variant="page"
        returnHref={returnHref}
        returnLabel={returnLabel}
        onDismiss={onDismiss}
      />
    </main>
  );
}

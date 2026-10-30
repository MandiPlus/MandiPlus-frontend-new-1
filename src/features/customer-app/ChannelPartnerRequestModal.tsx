"use client";

import { CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/context/AuthContext";
import {
  createCustomerChannelPartnerRequest,
  getCustomerChannelPartnerRequest,
  type CustomerChannelPartnerRequest,
} from "./api";
import { INDIA_STATES } from "./indiaStates";
import { readableError } from "./utils";
import styles from "./customer-app.module.css";

type RequestView = "loading" | "form" | "pending" | "success" | "approved";

export function ChannelPartnerRequestModal({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [view, setView] = useState<RequestView>("loading");
  const [request, setRequest] = useState<CustomerChannelPartnerRequest | null>(null);
  const [name, setName] = useState("");
  const [selectedState, setSelectedState] = useState("KARNATAKA");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const phone = useMemo(
    () =>
      String(
        user?.mobileNumber ||
          user?.phoneNumber ||
          user?.phone ||
          "",
      )
        .replace(/\D/g, "")
        .slice(-10),
    [user?.mobileNumber, user?.phone, user?.phoneNumber],
  );
  const selectedStateLabel =
    INDIA_STATES.find((item) => item.value === selectedState)?.label ||
    selectedState.replace(/_/g, " ");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const defaultName = String(user?.name || "").trim();
    const defaultState = normalizeState(user?.state) || "KARNATAKA";

    setView("loading");
    setRequest(null);
    setName(defaultName);
    setSelectedState(defaultState);
    setError("");
    setSubmitting(false);

    void getCustomerChannelPartnerRequest()
      .then((existing) => {
        if (cancelled) return;
        setRequest(existing);
        if (existing?.name) setName(existing.name);
        const existingState = normalizeState(existing?.state);
        if (existingState) setSelectedState(existingState);
        const status = String(existing?.status || "").toUpperCase();
        if (status === "PENDING") {
          setView("pending");
        } else if (status === "APPROVED") {
          setView("approved");
        } else {
          setView("form");
        }
      })
      .catch((nextError) => {
        if (cancelled) return;
        setView("form");
        const message = readableError(nextError, "");
        setError(
          /Cannot GET .*channel-partners\/me\/request|404|Not Found/i.test(message)
            ? ""
            : message,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [open, user?.name, user?.state]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open, submitting]);

  if (!open) return null;

  const submit = async () => {
    const cleanName = name.replace(/\s+/g, " ").trim();
    if (!cleanName) {
      setError("Enter your name to submit the request.");
      return;
    }
    if (!normalizeState(selectedState)) {
      setError("Select your state.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await createCustomerChannelPartnerRequest({
        name: cleanName,
        state: selectedState,
      });
      setRequest(response.data || null);
      if (
        !response.data &&
        /already active/i.test(String(response.message || ""))
      ) {
        setView("approved");
      } else {
        setView("success");
      }
      await onSubmitted?.();
    } catch (nextError) {
      setError(
        readableError(
          nextError,
          "Could not submit the request. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={styles.partnerRequestBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-request-title"
    >
      <button
        type="button"
        className={styles.partnerRequestScrim}
        onClick={onClose}
        disabled={submitting}
        aria-label="Close channel partner request"
      />
      <section className={styles.partnerRequestSheet}>
        <header className={styles.partnerRequestHeader}>
          <div>
            <h2 id="partner-request-title">Become a Channel Partner</h2>
            <p>
              Submit your details. Our team will review and enable access
              after approval.
            </p>
          </div>
          <button
            type="button"
            className={styles.partnerRequestClose}
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={21} />
          </button>
        </header>

        {view === "loading" ? (
          <div className={styles.partnerRequestLoading} role="status">
            <LoaderCircle size={28} aria-hidden="true" />
            <span>Checking request status</span>
          </div>
        ) : null}

        {view === "pending" ? (
          <div className={styles.partnerRequestStatus}>
            <span className={styles.partnerRequestStatusIcon}>
              <LoaderCircle size={25} aria-hidden="true" />
            </span>
            <h3>Your request is under process</h3>
            <p>Our team will contact you within 1 business day.</p>
            {request?.createdAt ? (
              <small>Submitted {formatDate(request.createdAt)}</small>
            ) : null}
            <button type="button" className={styles.wideButton} onClick={onClose}>
              Done
            </button>
          </div>
        ) : null}

        {view === "success" ? (
          <div className={styles.partnerRequestStatus}>
            <span className={styles.partnerRequestStatusIcon}>
              <CheckCircle2 size={27} aria-hidden="true" />
            </span>
            <h3>Request submitted</h3>
            <p>Our team will contact you within 1 business day.</p>
            <button type="button" className={styles.wideButton} onClick={onClose}>
              Done
            </button>
          </div>
        ) : null}

        {view === "approved" ? (
          <div className={styles.partnerRequestStatus}>
            <span className={styles.partnerRequestStatusIcon}>
              <CheckCircle2 size={27} aria-hidden="true" />
            </span>
            <h3>Channel Partner access is active</h3>
            <p>Your dashboard is ready to use.</p>
            <button
              type="button"
              className={styles.wideButton}
              onClick={() => {
                onClose();
                router.push("/partner");
              }}
            >
              Open dashboard
            </button>
          </div>
        ) : null}

        {view === "form" ? (
          <form
            className={styles.partnerRequestForm}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {phone ? (
              <span className={styles.partnerRequestPhone}>+91 {phone}</span>
            ) : null}

            <label className={styles.partnerRequestField}>
              <span>Name</span>
              <input
                autoFocus
                autoComplete="name"
                value={name}
                placeholder="Enter full name"
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
              />
            </label>

            <div className={styles.partnerRequestStateField}>
              <span>State</span>
              <strong>{selectedStateLabel}</strong>
              <div
                className={styles.partnerRequestStateScroller}
                role="listbox"
                aria-label="Select state"
              >
                {INDIA_STATES.map((item) => {
                  const selected = item.value === selectedState;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={
                        selected ? styles.partnerRequestStateSelected : ""
                      }
                      onClick={() => {
                        setSelectedState(item.value);
                        setError("");
                      }}
                      role="option"
                      aria-selected={selected}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? (
              <div className={styles.partnerRequestError} role="alert">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className={styles.wideButton}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle
                    size={18}
                    className={styles.partnerRequestSpinner}
                    aria-hidden="true"
                  />
                  Submitting
                </>
              ) : (
                "Submit request"
              )}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function normalizeState(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return INDIA_STATES.some((item) => item.value === normalized)
    ? normalized
    : "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

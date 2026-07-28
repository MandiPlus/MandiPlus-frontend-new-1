"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Truck,
  Upload,
} from "lucide-react";

import {
  createClaimByTruck,
  uploadClaimMedia,
  type ClaimRequest,
} from "@/features/insurance/api";
import { CustomerAppShell } from "./CustomerAppShell";
import { useCustomerAppData } from "./useCustomerAppData";
import {
  invoiceVehicle,
  isClosedClaim,
  money,
  readableError,
  type CustomerInvoice,
} from "./utils";
import styles from "./customer-app.module.css";

export default function CustomerClaimsPage() {
  const router = useRouter();
  const data = useCustomerAppData();
  const [creating, setCreating] = useState(false);
  const [vehicle, setVehicle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const insuredVehicles = useMemo(
    () =>
      [...new Set(data.invoices.map(invoiceVehicle).filter((value) => !value.includes("not added")))],
    [data.invoices],
  );

  const startClaim = async () => {
    const normalized = vehicle.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalized) {
      setNotice("Vehicle number select ya enter karein.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      const claim = await createClaimByTruck(normalized);
      await data.refresh();
      setExpanded(claim.id);
      setCreating(false);
      setVehicle("");
      setNotice("Claim successfully register ho gaya. Documents upload karein.");
    } catch (error) {
      setNotice(readableError(error, "Claim register nahi ho paya. Please retry."));
    } finally {
      setSubmitting(false);
    }
  };

  const upload = async (
    claim: ClaimRequest,
    type: "lorryReceipt" | "accidentPic",
    file?: File,
  ) => {
    if (!file) return;
    const key = `${claim.id}:${type}`;
    setUploading(key);
    setNotice("");
    try {
      await uploadClaimMedia(claim.id, type, file);
      await data.refresh(true);
      setNotice(type === "lorryReceipt" ? "Lorry receipt uploaded." : "Proof photo uploaded.");
    } catch (error) {
      setNotice(readableError(error, "Document upload nahi ho paya."));
    } finally {
      setUploading(null);
    }
  };

  return (
    <CustomerAppShell
      activeTab="partner"
      partnerActive={data.partnerActive}
      showBottomNav={false}
    >
      <header className={styles.secondaryHeader}>
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={() => router.push("/home")}
          aria-label="Back to home"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className={styles.secondaryHeading}>Claims</h1>
        <span />
      </header>

      <main className={styles.pageBody}>
        {creating ? (
          <section className={styles.formCard}>
            <div className={styles.field}>
              <label htmlFor="claim-vehicle">Vehicle number</label>
              {insuredVehicles.length ? (
                <select
                  id="claim-vehicle"
                  value={vehicle}
                  onChange={(event) => setVehicle(event.target.value)}
                >
                  <option value="">Vehicle choose karein</option>
                  {insuredVehicles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="claim-vehicle"
                  value={vehicle}
                  onChange={(event) => setVehicle(event.target.value.toUpperCase())}
                  placeholder="e.g. HR45D6194"
                  autoCapitalize="characters"
                />
              )}
            </div>
            <button
              type="button"
              className={styles.wideButton}
              disabled={submitting}
              onClick={() => void startClaim()}
            >
              {submitting ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={19} />}
              Claim register karein
            </button>
            <button
              type="button"
              className={styles.tabButton}
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </section>
        ) : (
          <button
            type="button"
            className={styles.startClaimCard}
            onClick={() => {
              setCreating(true);
              setNotice("");
            }}
          >
            <span className={styles.startClaimIcon}>
              <Plus size={24} />
            </span>
            <span className={styles.startClaimText}>Start new claim</span>
            <ChevronRight size={24} />
          </button>
        )}

        {notice ? <div className={styles.notice}>{notice}</div> : null}

        <div className={styles.claimSectionHeader}>
          <span>Active claims</span>
          <span>
            {data.claims.filter((claim) => !isClosedClaim(claim)).length
              ? `${data.claims.filter((claim) => !isClosedClaim(claim)).length} active`
              : "None"}
          </span>
        </div>

        {data.loading ? (
          <div className={styles.emptyState}>Claims load ho rahe hain…</div>
        ) : data.claims.filter((claim) => !isClosedClaim(claim)).length ? (
          <div className={styles.documentList}>
            {data.claims.filter((claim) => !isClosedClaim(claim)).map((claim) => {
              const open = expanded === claim.id;
              const invoice = claim.invoice as CustomerInvoice | undefined;
              return (
                <article
                  key={claim.id}
                  className={open ? styles.claimCard : styles.claimListRow}
                >
                  <button
                    type="button"
                    className={open ? styles.claimTop : styles.claimListTop}
                    onClick={() => setExpanded(open ? null : claim.id)}
                  >
                    <span style={{ display: "flex", gap: 11, minWidth: 0, textAlign: "left" }}>
                      <span className={styles.documentIcon}>
                        <Truck size={22} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className={styles.documentTitle}>
                          {invoice ? invoiceVehicle(invoice) : "Claim request"}
                        </span>
                        <span className={styles.documentMeta}>
                          {invoice?.invoiceNumber || claim.id.slice(0, 10)}
                        </span>
                      </span>
                    </span>
                    <span className={styles.claimAmountSide}>
                      <span>
                        {invoice?.amount ? money(invoice.amount) : money(0)}
                      </span>
                      {open ? <ChevronUp size={18} /> : <ChevronRight size={20} />}
                    </span>
                  </button>

                  {open ? (
                    <>
                      <div className={styles.timeline}>
                        <TimelineStep
                          title="Claim registered"
                          copy="Request Mandi Plus team ko mil gayi."
                          complete
                        />
                        <TimelineStep
                          title="Documents"
                          copy={
                            claim.lorryReceipt || claim.accidentPic
                              ? "Uploaded documents review mein hain."
                              : "Lorry receipt aur proof photo upload karein."
                          }
                          complete={Boolean(claim.lorryReceipt && claim.accidentPic)}
                        />
                        <TimelineStep
                          title="Review"
                          copy={
                            claim.surveyorName
                              ? `Surveyor: ${claim.surveyorName}`
                              : "Surveyor update yahan dikhega."
                          }
                          complete={Boolean(claim.surveyorName)}
                        />
                        <TimelineStep
                          title="Settlement"
                          copy="Final approval ke baad settlement update milega."
                          complete={isClosedClaim(claim)}
                        />
                      </div>
                      <div className={styles.uploadRow}>
                        <label className={styles.uploadButton}>
                          {uploading === `${claim.id}:lorryReceipt` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <FileText size={16} />
                          )}
                          Lorry receipt
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(event) => {
                              void upload(claim, "lorryReceipt", event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <label className={styles.uploadButton}>
                          {uploading === `${claim.id}:accidentPic` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Camera size={16} />
                          )}
                          Proof photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) => {
                              void upload(claim, "accidentPic", event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div>
              <ShieldCheck size={34} style={{ margin: "0 auto 10px" }} />
              No active claims
            </div>
          </div>
        )}

        <a
          href="https://wa.me/919900186757?text=Hi%20MandiPlus%2C%20I%20need%20help%20with%20my%20claim."
          target="_blank"
          rel="noreferrer"
          className={styles.claimContactCard}
        >
          <span className={styles.claimContactIcon}>
            <MessageCircle size={20} />
          </span>
          <span className={styles.claimContactCopy}>
            <strong>Need help?</strong>
            <small>Contact our support team on WhatsApp</small>
          </span>
          <span className={styles.claimContactButton}>
            Contact
            <ChevronRight size={18} />
          </span>
        </a>
      </main>
    </CustomerAppShell>
  );
}

function TimelineStep({
  title,
  copy,
  complete,
}: {
  title: string;
  copy: string;
  complete: boolean;
}) {
  return (
    <div className={styles.timelineStep}>
      <span
        className={styles.timelineDot}
        style={{ opacity: complete ? 1 : 0.28 }}
      >
        {complete ? <Check size={14} /> : <Upload size={13} />}
      </span>
      <span>
        <span className={styles.timelineTitle}>{title}</span>
        <span className={styles.timelineCopy}>{copy}</span>
      </span>
    </div>
  );
}

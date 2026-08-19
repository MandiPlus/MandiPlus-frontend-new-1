"use client";

import {
  Check,
  CheckCircle2,
  FileImage,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Upload,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  getPublicClaimDocumentUploadLink,
  PublicClaimDocumentType,
  PublicClaimDocumentUploadLink,
  uploadPublicClaimDocument,
} from "@/features/insurance/api";
import styles from "./public-claim-documents.module.css";

type DocumentDefinition = {
  type: PublicClaimDocumentType;
  title: string;
  Icon: typeof FileText;
};

const DOCUMENTS: DocumentDefinition[] = [
  {
    type: "lorryReceipt",
    title: "Lorry Receipt (LR)",
    Icon: FileText,
  },
  {
    type: "damageCertificate",
    title: "Damage Certificate",
    Icon: FileImage,
  },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export default function PublicClaimDocumentsPage({ token }: { token: string }) {
  const [claim, setClaim] = useState<PublicClaimDocumentUploadLink | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<PublicClaimDocumentType | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const inputs = useRef<
    Partial<Record<PublicClaimDocumentType, HTMLInputElement | null>>
  >({});

  const refresh = useCallback(async () => {
    const result = await getPublicClaimDocumentUploadLink(token);
    setClaim(result);
    return result;
  }, [token]);

  useEffect(() => {
    let active = true;
    refresh()
      .catch((error: unknown) => {
        if (active) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Yeh link abhi open nahi ho pa raha.",
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

  const handleFile = async (
    type: PublicClaimDocumentType,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice(null);
    if (!ACCEPTED_TYPES.has(file.type)) {
      setNotice("Sirf PDF, JPG ya PNG file upload karein.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setNotice("File 10 MB se chhoti honi chahiye.");
      return;
    }

    setUploading(type);
    try {
      const updated = await uploadPublicClaimDocument(token, type, file);
      setClaim(updated);
      const label = DOCUMENTS.find((item) => item.type === type)?.title;
      setNotice(`${label} mil gaya. Admin team ko update bhej diya hai.`);
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Upload nahi hua. Dobara try karein.",
      );
    } finally {
      setUploading(null);
    }
  };

  const receivedCount = claim
    ? DOCUMENTS.filter((item) => claim.documents[item.type].received).length
    : 0;
  const complete = receivedCount === DOCUMENTS.length;
  const expired =
    !!claim?.expiresAt && new Date(claim.expiresAt).getTime() <= Date.now();

  if (loading) {
    return (
      <main className={styles.shell}>
        <section className={styles.stateCard} aria-live="polite">
          <LoaderCircle className={styles.spinner} aria-hidden="true" />
          <h1>Claim details khul rahi hain…</h1>
          <p>Bas ek moment.</p>
        </section>
      </main>
    );
  }

  if (pageError || !claim) {
    return (
      <main className={styles.shell}>
        <section className={styles.stateCard}>
          <div className={styles.errorMark}>!</div>
          <p className={styles.eyebrow}>MandiPlus Claims</p>
          <h1>Link open nahi hua</h1>
          <p>
            {pageError || "Naya link mangne ke liye WhatsApp par reply karein."}
          </p>
        </section>
      </main>
    );
  }

  if (expired || !claim.canUpload) {
    return (
      <main className={styles.shell}>
        <section className={styles.stateCard}>
          <LockKeyhole className={styles.stateIcon} aria-hidden="true" />
          <p className={styles.eyebrow}>Claim {claim.claimNumber}</p>
          <h1>Uploads ab band hain</h1>
          <p>
            {expired
              ? "Link expire ho gaya hai. Naya link mangne ke liye WhatsApp par reply karein."
              : "Yeh claim close ho chuka hai, isliye documents change nahi ho sakte."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.paper}>
        <header className={styles.header}>
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>M+</div>
            <p className={styles.brand}>MandiPlus Claims</p>
          </div>
          <p className={styles.secureLine}>
            <LockKeyhole size={14} aria-hidden="true" /> Secure
          </p>
        </header>

        <section className={styles.intro}>
          <p className={styles.eyebrow}>Claim {claim.claimNumber}</p>
          <h1>{complete ? "Documents mil gaye" : "Documents upload karein"}</h1>
          <p>{claim.vehicleNumber}</p>
        </section>

        <div
          className={styles.progress}
          aria-label={`${receivedCount} of 2 documents received`}
        >
          <div className={styles.progressMeta}>
            <span>Progress</span>
            <strong>{receivedCount}/2</strong>
          </div>
          <div className={styles.track}>
            <span style={{ width: `${(receivedCount / 2) * 100}%` }} />
          </div>
        </div>

        <section
          className={styles.documentList}
          aria-label="Required documents"
        >
          {DOCUMENTS.map(({ type, title, Icon }) => {
            const received = claim.documents[type].received;
            const isUploading = uploading === type;
            return (
              <article className={styles.documentCard} key={type}>
                <div className={styles.documentIcon} data-received={received}>
                  {received ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Icon aria-hidden="true" />
                  )}
                </div>
                <div className={styles.documentCopy}>
                  <div className={styles.titleRow}>
                    <h2>{title}</h2>
                    <span data-received={received}>
                      {received ? "Received" : "Pending"}
                    </span>
                  </div>
                  <input
                    ref={(node) => {
                      inputs.current[type] = node;
                    }}
                    className={styles.fileInput}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(event) => void handleFile(type, event)}
                    aria-label={`${title} file choose karein`}
                  />
                  <button
                    type="button"
                    className={
                      received ? styles.replaceButton : styles.uploadButton
                    }
                    disabled={Boolean(uploading)}
                    onClick={() => inputs.current[type]?.click()}
                  >
                    {isUploading ? (
                      <LoaderCircle
                        className={styles.buttonSpinner}
                        aria-hidden="true"
                      />
                    ) : (
                      <Upload size={17} aria-hidden="true" />
                    )}
                    {isUploading
                      ? "Upload ho raha hai…"
                      : received
                        ? "File replace karein"
                        : "Upload karein"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {notice ? (
          <div className={styles.notice} role="status">
            {notice.includes("mil gaya") ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : null}
            <span>{notice}</span>
          </div>
        ) : null}

        <footer className={styles.footer}>
          <LockKeyhole size={15} aria-hidden="true" />
          <span>PDF, JPG ya PNG · max 10 MB</span>
        </footer>
      </div>
    </main>
  );
}

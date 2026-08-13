'use client';

import {
  ClaimActivity,
  ClaimPaymentStatus,
  ClaimRequest,
  ClaimsSummary,
  ClaimStatus,
  EligibleClaimInvoice,
  FlaggedVehicle,
  UpdateClaimDto,
  adminApi,
} from '@/features/admin/api/admin.api';
import InvoicePicker from '@/features/admin/claims/InvoicePicker';
import ClaimDocumentReminderPanel from '@/features/admin/claims/ClaimDocumentReminderPanel';
import {
  EvidenceBadge,
  LocationLink,
  StatusBadge,
  formatCurrency,
  formatDate,
  getInsuredParty,
  getInsuredPersonAddress,
  getOtherParty,
  getOtherPartyAddress,
  getVehicleNumber,
} from '@/features/admin/claims/claimUi';
import {
  assessmentReportSections,
  buildDefaultAssessmentReport,
  countFilledAssessmentRcFields,
  getAssessmentSourceScreenshotUrls,
  type ClaimAssessmentReportData,
} from '@/features/admin/claims/assessmentReport';
import { adminButtonClasses } from '@/features/admin/utils/adminUi';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Image as ImageIcon,
  Link2,
  ListFilter,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  UserCheck,
  Video,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';

const claimStatusOptions: Array<{ value: ClaimStatus; label: string }> = [
  { value: ClaimStatus.PENDING, label: 'PENDING' },
  { value: ClaimStatus.INPROGRESS, label: 'IN PROGRESS' },
  { value: ClaimStatus.SURVEYOR_ASSIGNED, label: 'SURVEYOR ASSIGNED' },
  { value: ClaimStatus.APPROVED, label: 'APPROVED' },
  { value: ClaimStatus.REJECTED, label: 'REJECTED' },
  { value: ClaimStatus.COMPLETED, label: 'COMPLETED' },
  { value: ClaimStatus.SETTLED, label: 'SETTLED' },
];

const paymentStatusOptions: Array<{ value: ClaimPaymentStatus; label: string }> = [
  { value: ClaimPaymentStatus.NOT_STARTED, label: 'NOT STARTED' },
  { value: ClaimPaymentStatus.AWAITING_APPROVAL, label: 'AWAITING APPROVAL' },
  { value: ClaimPaymentStatus.APPROVED_FOR_PAYMENT, label: 'APPROVED FOR PAYMENT' },
  { value: ClaimPaymentStatus.PROCESSING, label: 'PROCESSING' },
  { value: ClaimPaymentStatus.PARTIALLY_PAID, label: 'PARTIALLY PAID' },
  { value: ClaimPaymentStatus.PAID, label: 'PAID' },
  { value: ClaimPaymentStatus.ON_HOLD, label: 'ON HOLD' },
  { value: ClaimPaymentStatus.FAILED, label: 'FAILED' },
  { value: ClaimPaymentStatus.NOT_APPLICABLE, label: 'N/A' },
];

const handledByOptions = ['TATA', 'MandiPlus'];

const claimTableStickyHeadClasses = [
  'sticky left-0 z-[33] w-14 min-w-[3.5rem] max-w-[3.5rem] bg-[#f8fafc] text-center',
  'sticky left-[3.5rem] z-[34] w-[7rem] min-w-[7rem] max-w-[7rem] bg-[#f8fafc] px-2',
  'sticky left-[10.5rem] z-[35] w-[8rem] min-w-[8rem] max-w-[8rem] bg-[#f8fafc] px-2 shadow-[4px_0_10px_-2px_rgba(15,23,42,0.14)]',
] as const;

const claimTableColumnWidths = [
  '', // S.NO
  '', // TATA CLAIM NO
  '', // MANDIPLUS CLAIM NO
  '', // INVOICE NO.
  '', // CLAIM DATE
  '', // VEHICLE NO.
  '', // INSURED PARTY
  'w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem]', // INSURED PERSON ADDRESS
  '', // OTHER PARTY
  'w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem]', // OTHER PARTY ADDRESS
  '', // REASON FOR CLAIM
  'w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] whitespace-nowrap', // INVOICE VALUE
  'w-[6.5rem] min-w-[6.5rem] max-w-[6.5rem] whitespace-nowrap text-right', // SETTLED AMT
  '', // DOCUMENTS
  '', // SURVEYOR NAME
  '', // SURVEYOR NUMBER
  '', // CURRENT STATUS
  '', // REMARKS
] as const;

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15 shadow-sm';

type ClaimSurveyorDraft = {
  name: string;
  contact: string;
};

function getClaimSurveyors(claim: ClaimRequest): ClaimSurveyorDraft[] {
  const savedSurveyors = (claim.surveyors || [])
    .map((surveyor) => ({
      name: String(surveyor.name || '').trim(),
      contact: String(surveyor.contact || '').trim(),
    }))
    .filter((surveyor) => surveyor.name || surveyor.contact);

  if (savedSurveyors.length > 0) return savedSurveyors;

  const primaryName = String(claim.surveyorName || '').trim();
  const primaryContact = String(claim.surveyorNumber || claim.surveyorContact || '').trim();
  return primaryName || primaryContact ? [{ name: primaryName, contact: primaryContact }] : [];
}

function normalizeSurveyors(surveyors: ClaimSurveyorDraft[]): ClaimSurveyorDraft[] {
  return surveyors
    .map((surveyor) => ({
      name: surveyor.name.trim(),
      contact: surveyor.contact.trim(),
    }))
    .filter((surveyor) => surveyor.name || surveyor.contact);
}

function formatTableSurveyorField(
  claim: ClaimRequest,
  field: 'name' | 'contact',
): { value: string; extraCount: number } {
  const surveyors = getClaimSurveyors(claim);
  if (surveyors.length === 0) return { value: '—', extraCount: 0 };
  return {
    value: surveyors[0][field] || '—',
    extraCount: Math.max(0, surveyors.length - 1),
  };
}

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const raw = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAdminTimestamp(value?: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isEngineSeizeClaim(claim: Pick<ClaimRequest, 'description' | 'engineSeizeEvidenceSubmissionId' | 'engineSeizeEvidenceSubmittedAt' | 'engineSeizeEvidencePhotos' | 'engineSeizeEvidenceVideos'>): boolean {
  const description = (claim.description || '').toLowerCase();
  return (
    description.includes('engine') ||
    Boolean(claim.engineSeizeEvidenceSubmissionId) ||
    Boolean(claim.engineSeizeEvidenceSubmittedAt) ||
    Boolean(claim.engineSeizeEvidencePhotos?.length) ||
    Boolean(claim.engineSeizeEvidenceVideos?.length)
  );
}

function documentEntries(claim: ClaimRequest): Array<[string, string, string]> {
  const customDocs: Array<[string, string, string]> = (claim.documentsList || []).map((doc) => [doc.name, doc.url, 'inspectionReport']);
  const standardDocs: Array<[string, string | null | undefined, string]> = [
    ['Estimation Bill (provided by trader)', claim.estimationBillUrl, 'estimationBill'],
    ['FIR Copy', claim.fir, 'fir'],
    ['Accident Picture', claim.accidentPic, 'accidentPic'],
    ['Inspection Report', claim.inspectionReport, 'inspectionReport'],
    ['Lorry Receipt (LR)', claim.lorryReceipt, 'lorryReceipt'],
    ['Insurance Policy', claim.insurancePolicy, 'insurancePolicy'],
    ['Damage Certificate', claim.claimFormUrl || claim.damageFormUrl, 'damageForm'],
    ['Invoice PDF', claim.invoice?.pdfUrl || claim.invoice?.invoicePdfUrl, 'inspectionReport'],
    ['Assessment Report', claim.assessmentReportUrl, 'inspectionReport'],
  ];

  const all: Array<[string, string, string]> = [
    ...standardDocs
      .filter((entry): entry is [string, string, string] => Boolean(entry[1]))
      .map((entry) => [entry[0], entry[1], entry[2]] as [string, string, string]),
    ...customDocs,
  ];

  const map = new Map<string, [string, string, string]>();
  all.forEach((item) => map.set(item[0], item));
  return Array.from(map.values());
}

function CategorySelectModal({
  file,
  onClose,
  onConfirm,
}: {
  file: File;
  onClose: () => void;
  onConfirm: (categoryKey: string) => void;
}) {
  const [selectedKey, setSelectedKey] = useState('estimationBill');

  const categories = [
    { label: 'Estimation Bill (provided by trader)', key: 'estimationBill', icon: FileText, desc: 'Repair quote/bill provided by trader' },
    { label: 'FIR Copy', key: 'fir', icon: ShieldCheck, desc: 'Police complaint copy for theft or accident' },
    { label: 'Accident Picture', key: 'accidentPic', icon: ImageIcon, desc: 'Photos of damaged vehicle or cargo' },
    { label: 'Inspection Report', key: 'inspectionReport', icon: FileCheck2, desc: 'Surveyor assessment report' },
    { label: 'Lorry Receipt (LR)', key: 'lorryReceipt', icon: Truck, desc: 'Transport consignment note' },
    { label: 'Insurance Policy', key: 'insurancePolicy', icon: ShieldCheck, desc: 'Insurance cover document' },
    { label: 'Damage Certificate', key: 'damageForm', icon: Wrench, desc: 'Certificate of cargo damage' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px]">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-6 py-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Select Document Category</h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Categorize <strong className="text-slate-800">{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-2.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedKey === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedKey(cat.key)}
                className={`w-full flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                  isSelected
                    ? 'border-violet-600 bg-violet-50/70 ring-1 ring-violet-500/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                }`}
              >
                <div className={`mt-0.5 rounded-lg p-2 ${isSelected ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-bold ${isSelected ? 'text-violet-900' : 'text-slate-800'}`}>
                    {cat.label}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500">{cat.desc}</p>
                </div>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-violet-600 self-center" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedKey)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </button>
        </div>
      </div>
    </div>
  );
}

function shortenMandiPlusClaimNo(num?: string | null) {
  if (!num) return '—';
  // Formats MP-CLM-2026-000015 -> MPC-26-0015
  const matchFull = num.match(/^MP-CLM-20(\d{2})-(?:0*)(\d+)/i);
  if (matchFull) {
    const yy = matchFull[1];
    const seq = matchFull[2].padStart(4, '0');
    return `MPC-${yy}-${seq}`;
  }
  const matchShort = num.match(/^MP-CLM-(?:0*)(\d+)/i);
  if (matchShort) {
    const seq = matchShort[1].padStart(4, '0');
    return `MPC-26-${seq}`;
  }
  if (num.startsWith('MP-CLM-')) {
    return num.replace(/^MP-CLM-20(\d{2})-/i, 'MPC-$1-').replace(/^MP-CLM-/i, 'MPC-26-');
  }
  return num;
}

function renderInvoiceNumberTwoLines(invNo?: string | null) {
  if (!invNo) return '—';
  const parts = invNo.split('-');
  if (parts.length >= 3) {
    return (
      <div className="flex flex-col text-xs font-extrabold text-slate-900 leading-snug">
        <span className="whitespace-nowrap">{parts.slice(0, 2).join('-')}-</span>
        <span className="whitespace-nowrap">{parts.slice(2).join('-')}</span>
      </div>
    );
  }
  if (parts.length === 2) {
    return (
      <div className="flex flex-col text-xs font-semibold text-slate-700 leading-snug">
        <span className="whitespace-nowrap">{parts[0]}-</span>
        <span className="whitespace-nowrap">{parts[1]}</span>
      </div>
    );
  }
  return <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{invNo}</span>;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof ShieldCheck;
  tone: 'violet' | 'amber' | 'emerald' | 'blue';
}) {
  const tones = {
    violet: 'border-violet-200 bg-gradient-to-br from-violet-50 to-white text-violet-800 shadow-sm',
    amber: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-800 shadow-sm',
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-800 shadow-sm',
    blue: 'border-sky-200 bg-gradient-to-br from-sky-50 to-white text-sky-800 shadow-sm',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <span className="rounded-xl bg-white p-2.5 shadow-sm border border-slate-100">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function getSelectStatusClasses(value: string) {
  const raw = String(value || '').toUpperCase().replace(/_/g, ' ');
  if (raw === 'APPROVED' || raw === 'PAID') {
    return 'bg-emerald-50 text-emerald-700 font-semibold border-emerald-200/90 shadow-xs';
  }
  if (raw === 'REJECTED' || raw === 'FAILED') {
    return 'bg-rose-50 text-rose-700 font-semibold border-rose-200/90 shadow-xs';
  }
  if (raw.includes('AWAITED') || raw.includes('WAITING') || raw.includes('ASSIGNED') || raw.includes('PENDING')) {
    return 'bg-amber-50 text-amber-900 font-semibold border-amber-200/90 shadow-xs';
  }
  return 'bg-slate-50 text-slate-700 font-semibold border-slate-200/90 shadow-xs';
}

function getClaimRowToneClasses(status?: ClaimStatus | string | null): {
  row: string;
  sticky: string;
} {
  const normalized = String(status || ClaimStatus.PENDING).toLowerCase();

  if (normalized === ClaimStatus.SETTLED || normalized === ClaimStatus.COMPLETED) {
    return {
      row: 'bg-emerald-50 hover:bg-emerald-100',
      sticky: 'bg-emerald-50 group-hover:bg-emerald-100',
    };
  }

  if (normalized === ClaimStatus.REJECTED) {
    return {
      row: 'bg-rose-50 hover:bg-rose-100',
      sticky: 'bg-rose-50 group-hover:bg-rose-100',
    };
  }

  return {
    row: 'bg-amber-50 hover:bg-amber-100',
    sticky: 'bg-amber-50 group-hover:bg-amber-100',
  };
}

function getClaimTableStickyShellClasses(): string[] {
  return [
    'relative p-0 border-r border-slate-200 sticky left-0 z-[30] w-14 min-w-[3.5rem] max-w-[3.5rem]',
    'relative p-0 border-r border-slate-200 sticky left-[3.5rem] z-[31] w-[7rem] min-w-[7rem] max-w-[7rem]',
    'relative p-0 border-r border-slate-200 sticky left-[10.5rem] z-[32] w-[8rem] min-w-[8rem] max-w-[8rem] shadow-[6px_0_14px_-4px_rgba(15,23,42,0.22)]',
  ];
}

function StickyTableCell({
  shellClassName,
  toneClassName,
  contentClassName = '',
  compact = false,
  children,
}: {
  shellClassName: string;
  toneClassName: string;
  contentClassName?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <td className={shellClassName}>
      <div className={`pointer-events-none absolute inset-0 ${toneClassName}`} aria-hidden="true" />
      <div className={`relative ${compact ? 'px-2' : 'px-3.5'} py-3 ${contentClassName}`}>{children}</div>
    </td>
  );
}

function PaymentProofUpload({
  claim,
  onUpdated,
}: {
  claim: ClaimRequest;
  onUpdated: (claim: ClaimRequest) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputId = `payment-proof-${claim.id}`;

  const handleUpload = async (file: File) => {
    const mimeType = (file.type || '').toLowerCase();
    const allowed = /(image\/(jpeg|jpg|png|gif|webp)|application\/pdf)/i;
    if (!allowed.test(mimeType)) {
      toast.error('Payment proof must be an image or PDF');
      return;
    }

    setUploading(true);
    const response = await adminApi.uploadClaimMedia(claim.id, 'paymentProof', file);
    setUploading(false);

    if (response.success && response.data) {
      onUpdated(response.data);
      toast.success('Payment proof uploaded');
      return;
    }

    toast.error(response.message || 'Failed to upload payment proof');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {claim.paymentProofUrl ? (
        <>
          <a
            href={claim.paymentProofUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </a>
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Replace
          </label>
        </>
      ) : (
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload Proof
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function filterAssessmentScreenshotFiles(files: File[]): File[] {
  return files.filter(
    (file) => file.type.startsWith('image/') || file.type === 'application/pdf',
  );
}

function extractClipboardImageFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];
  return Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

// ============================================================
// Drag & Drop Upload Zone Component
// ============================================================
function DragDropUploadZone({
  onFilesSelected,
  acceptedTypes = 'image/*,video/*,application/pdf',
  label = 'Drag & Drop files here or click to browse',
  sublabel = 'Supports Photos, Videos (MP4/MOV), and PDFs up to 50MB',
  disabled = false,
  enablePaste = false,
}: {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string;
  label?: string;
  sublabel?: string;
  disabled?: boolean;
  enablePaste?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!enablePaste || disabled) return;
    const files = extractClipboardImageFiles(e.clipboardData);
    if (files.length > 0) {
      e.preventDefault();
      onFilesSelected(files);
    }
  };

  return (
    <div
      tabIndex={enablePaste && !disabled ? 0 : undefined}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all outline-none ${
        isDragging
          ? 'border-[#4309ac] bg-violet-100/70 scale-[1.01] shadow-lg shadow-[#4309ac]/10 ring-2 ring-[#4309ac]/20'
          : isFocused
            ? 'border-[#4309ac] bg-violet-50 ring-2 ring-[#4309ac]/15'
            : 'border-violet-200 bg-violet-50/40 hover:border-[#4309ac] hover:bg-violet-50'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <label className="flex w-full cursor-pointer flex-col items-center justify-center">
        <div className={`rounded-2xl p-3 text-[#4309ac] transition ${isDragging ? 'bg-[#4309ac] text-white scale-110' : 'bg-white shadow-sm'}`}>
          <Upload className="h-6 w-6" />
        </div>
        <p className="mt-3 text-xs font-extrabold text-slate-900">{label}</p>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          {enablePaste && isFocused
            ? 'Release to upload, or press Ctrl+V to paste an image'
            : sublabel}
        </p>
        <input
          type="file"
          multiple
          accept={acceptedTypes}
          disabled={disabled}
          className="hidden"
          onChange={handleFileInput}
        />
      </label>
    </div>
  );
}

// ============================================================
// 1. Status Update Confirmation Modal
// ============================================================
function ConfirmStatusModal({
  claim,
  fieldName,
  oldValue,
  newValue,
  onConfirm,
  onCancel,
}: {
  claim: ClaimRequest;
  fieldName: string;
  oldValue: string;
  newValue: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[3px]">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-amber-600">
          <ShieldAlert className="h-6 w-6" />
          <h3 className="text-lg font-bold text-slate-900">Confirm Status Update</h3>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          You are updating <strong className="text-slate-900">{fieldName}</strong> for claim{' '}
          <strong className="text-[#4309ac]">{claim.officialClaimNumber || claim.tataClaimNumber || claim.caseNumber}</strong>.
        </p>

        <div className="my-4 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Invoice No:</span>
            <span className="font-bold text-slate-900">{claim.invoice?.invoiceNumber || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Vehicle No:</span>
            <span className="font-bold text-slate-900">{getVehicleNumber(claim)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
            <span className="text-slate-500 font-medium">Previous:</span>
            <StatusBadge status={oldValue} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">New Status:</span>
            <StatusBadge status={newValue} />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button onClick={onCancel} className={adminButtonClasses.secondary}>
            Cancel
          </button>
          <button onClick={onConfirm} className={adminButtonClasses.primary}>
            Confirm Update
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Vehicle Blacklist Modals
// ============================================================
function BlacklistVehicleModal({
  onClose,
  onBlacklisted,
}: {
  onClose: () => void;
  onBlacklisted: () => void;
}) {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const normalized = vehicleNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase().trim();
    if (!normalized) {
      toast.error('Enter a valid vehicle number');
      return;
    }

    setSaving(true);
    const response = await adminApi.flagVehicle(normalized, reason.trim() || undefined);
    setSaving(false);

    if (!response.success) {
      toast.error(response.message || 'Could not blacklist vehicle');
      return;
    }

    toast.success(`Vehicle ${normalized} blacklisted — invoices blocked`);
    onBlacklisted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[3px]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-[#f8fafc] px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Blacklist Vehicle</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Block future invoice creation for this vehicle number
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <label className="block text-xs font-bold text-slate-800">
            Vehicle Number
            <input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="e.g. AP39UD0018"
              className={`${fieldClass} mt-1.5 uppercase`}
            />
          </label>
          <label className="block text-xs font-bold text-slate-800">
            Reason (optional)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this vehicle being blacklisted?"
              rows={3}
              className={`${fieldClass} mt-1.5 resize-none`}
            />
          </label>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
            Blacklisted vehicles cannot get new invoices. Existing claims and invoices are not affected.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className={adminButtonClasses.secondary}>
            Cancel
          </button>
          <button onClick={() => void submit()} disabled={saving} className={adminButtonClasses.primary}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Blacklist Vehicle
          </button>
        </div>
      </div>
    </div>
  );
}

function BlacklistedVehiclesModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [vehicles, setVehicles] = useState<FlaggedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingNumber, setRemovingNumber] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const syncResponse = await adminApi.syncBlacklistedFromClaims();
    if (!syncResponse.success) {
      toast.error(syncResponse.message || 'Could not sync claim vehicles to blacklist');
    } else if (syncResponse.data?.flagged) {
      toast.success(
        `${syncResponse.data.flagged} claim vehicle(s) blacklisted`,
      );
    }

    const response = await adminApi.listFlaggedVehicles();
    setLoading(false);
    if (response.success) {
      setVehicles(response.data || []);
      return;
    }
    toast.error(response.message || 'Could not load blacklisted vehicles');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removeFromBlacklist = async (truckNumber: string) => {
    setRemovingNumber(truckNumber);
    const response = await adminApi.unflagVehicle(truckNumber);
    setRemovingNumber(null);

    if (!response.success) {
      toast.error(response.message || 'Could not remove vehicle from blacklist');
      return;
    }

    toast.success(`${truckNumber} removed from blacklist`);
    setVehicles((current) => current.filter((item) => item.truckNumber !== truckNumber));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[3px]">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-[#f8fafc] px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Blacklisted Vehicles</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Vehicles flagged in the system — invoice creation is blocked for these
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm font-semibold text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading blacklisted vehicles...
            </div>
          ) : vehicles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <ShieldBan className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">No blacklisted vehicles</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Previously flagged vehicles from truck master will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Vehicle No.</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Blacklisted On</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="bg-white hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold tracking-wide text-slate-900">
                        {vehicle.truckNumber}
                      </td>
                      <td className="px-4 py-3 max-w-[260px] break-words font-medium text-slate-600">
                        {vehicle.flagReason || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-500">
                        {vehicle.flaggedAt ? formatDate(vehicle.flaggedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void removeFromBlacklist(vehicle.truckNumber)}
                          disabled={removingNumber === vehicle.truckNumber}
                          className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {removingNumber === vehicle.truckNumber ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Remove'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className={adminButtonClasses.primary}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Delete Claim Confirmation Modal
// ============================================================
function DeleteClaimModal({
  claim,
  onConfirm,
  onCancel,
}: {
  claim: ClaimRequest;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px]">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-rose-600">
          <Trash2 className="h-6 w-6" />
          <h3 className="text-lg font-bold text-slate-900">Delete Claim Request</h3>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          Are you sure you want to delete claim <strong className="text-slate-900">{claim.officialClaimNumber || claim.tataClaimNumber || claim.caseNumber}</strong>?
          This action cannot be undone.
        </p>

        <div className="my-4 space-y-2 rounded-xl border border-rose-100 bg-rose-50/60 p-4 text-xs">
          <div className="flex justify-between text-slate-700">
            <span>Invoice Number:</span>
            <span className="font-bold">{claim.invoice?.invoiceNumber || '—'}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span>Vehicle Number:</span>
            <span className="font-bold">{getVehicleNumber(claim)}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span>Insured Party:</span>
            <span className="font-bold">{getInsuredParty(claim)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button onClick={onCancel} className={adminButtonClasses.secondary}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 transition"
          >
            Permanently Delete Claim
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 2. Proof Gallery Modal (Max 10 files) with Drag & Drop
// ============================================================
type ProofGalleryItem = {
  url: string;
  name: string;
  type: 'photo' | 'video' | 'file';
  maskedUrl?: string;
};

function seedProofGallery(claim: ClaimRequest): ProofGalleryItem[] {
  const maskedByUrl = new Map<string, string>();
  const pushMasked = (
    photos?: Array<{ url: string; maskedUrl?: string }>,
  ) => {
    (photos || []).forEach((photo) => {
      if (photo.maskedUrl) maskedByUrl.set(photo.url, photo.maskedUrl);
    });
  };
  pushMasked(claim.evidencePhotos);
  pushMasked(claim.engineSeizeEvidencePhotos);

  const withMask = (item: ProofGalleryItem): ProofGalleryItem => ({
    ...item,
    maskedUrl: item.maskedUrl || maskedByUrl.get(item.url),
  });

  const existing = claim.proofFiles || [];
  if (existing.length > 0) {
    const fromProofs = existing.map((item) =>
      withMask({
        url: item.url,
        name: item.name,
        type: (item.type as ProofGalleryItem['type']) || 'file',
      }),
    );
    const proofUrls = new Set(fromProofs.map((item) => item.url));
    const fromEvidence: ProofGalleryItem[] = [];
    (claim.evidencePhotos || []).forEach((photo, index) => {
      if (proofUrls.has(photo.url)) return;
      fromEvidence.push(
        withMask({
          url: photo.url,
          name: photo.label || `Photo ${index + 1}`,
          type: 'photo',
          maskedUrl: photo.maskedUrl,
        }),
      );
    });
    (claim.engineSeizeEvidencePhotos || []).forEach((photo, index) => {
      if (proofUrls.has(photo.url)) return;
      fromEvidence.push(
        withMask({
          url: photo.url,
          name: photo.label || `Photo ${index + 1}`,
          type: 'photo',
          maskedUrl: photo.maskedUrl,
        }),
      );
    });
    (claim.evidenceVideos || []).forEach((video, index) => {
      if (proofUrls.has(video.url)) return;
      fromEvidence.push({
        url: video.url,
        name: video.label || `Video ${index + 1}`,
        type: 'video',
      });
    });
    (claim.engineSeizeEvidenceVideos || []).forEach((video, index) => {
      if (proofUrls.has(video.url)) return;
      fromEvidence.push({
        url: video.url,
        name: video.label || `Video ${index + 1}`,
        type: 'video',
      });
    });
    return [...fromEvidence, ...fromProofs];
  }

  const items: ProofGalleryItem[] = [];
  (claim.evidencePhotos || []).forEach((photo, index) =>
    items.push(
      withMask({
        url: photo.url,
        name: photo.label || `Photo ${index + 1}`,
        type: 'photo',
        maskedUrl: photo.maskedUrl,
      }),
    ),
  );
  (claim.evidenceVideos || []).forEach((video, index) =>
    items.push({
      url: video.url,
      name: video.label || `Video ${index + 1}`,
      type: 'video',
    }),
  );
  (claim.engineSeizeEvidencePhotos || []).forEach((photo, index) =>
    items.push(
      withMask({
        url: photo.url,
        name: photo.label || `Photo ${index + 1}`,
        type: 'photo',
        maskedUrl: photo.maskedUrl,
      }),
    ),
  );
  (claim.engineSeizeEvidenceVideos || []).forEach((video, index) =>
    items.push({
      url: video.url,
      name: video.label || `Video ${index + 1}`,
      type: 'video',
    }),
  );
  return items;
}

function ProofPhotoCard({
  item,
  mode,
  onRemove,
}: {
  item: ProofGalleryItem;
  mode: 'raw' | 'geo';
  onRemove?: () => void;
}) {
  const displayUrl =
    mode === 'geo' && item.maskedUrl ? item.maskedUrl : item.url;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <a href={displayUrl} target="_blank" rel="noreferrer" className="block">
        <img
          src={displayUrl}
          alt={item.name}
          className="aspect-[4/3] w-full object-cover"
        />
      </a>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/70 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
        <a
          href={displayUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-white/90 p-2 text-slate-900 hover:bg-white"
          title={mode === 'geo' ? 'Geo image kholo' : 'Raw image kholo'}
        >
          <Eye className="h-4 w-4" />
        </a>
        {onRemove && (
          <button
            onClick={onRemove}
            className="rounded-lg bg-rose-600 p-2 text-white hover:bg-rose-700"
            title="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
        {item.name}
      </span>
      <span className="absolute right-1.5 top-1.5 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
        {mode === 'geo' && item.maskedUrl ? 'Geo' : 'Raw'}
      </span>
    </div>
  );
}

function RawGeoSwitch({
  mode,
  onChange,
  geoReady,
  loading,
}: {
  mode: 'raw' | 'geo';
  onChange: (mode: 'raw' | 'geo') => void;
  geoReady: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold">
        <button
          type="button"
          onClick={() => onChange('raw')}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === 'raw'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Raw
        </button>
        <button
          type="button"
          disabled={!geoReady}
          onClick={() => onChange('geo')}
          className={`rounded-md px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
            mode === 'geo'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title={geoReady ? 'Geo masked' : 'Geo ban raha…'}
        >
          {loading && !geoReady ? 'Geo…' : 'Geo'}
        </button>
      </div>
      {loading && !geoReady && (
        <span className="text-[11px] font-semibold text-amber-600">
          Geo ban raha…
        </span>
      )}
    </div>
  );
}

function ProofGalleryModal({
  claim,
  onClose,
  onUpdated,
}: {
  claim: ClaimRequest;
  onClose: () => void;
  onUpdated: (updated: ClaimRequest) => void;
}) {
  const [proofs, setProofs] = useState<ProofGalleryItem[]>(() =>
    seedProofGallery(claim),
  );
  const geoReady = proofs.some((item) => item.type === 'photo' && item.maskedUrl);
  const [mediaMode, setMediaMode] = useState<'raw' | 'geo'>(() =>
    seedProofGallery(claim).some((item) => item.maskedUrl) ? 'geo' : 'raw',
  );
  const [maskLoading, setMaskLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    setMaskLoading(true);
    void adminApi
      .getClaimById(claim.id)
      .then((response) => {
        if (!active || !response.success || !response.data) return;
        const next = seedProofGallery(response.data);
        setProofs(next);
        if (next.some((item) => item.maskedUrl)) setMediaMode('geo');
        onUpdated(response.data);
      })
      .finally(() => {
        if (active) setMaskLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.id]);

  const processFiles = async (files: File[]) => {
    if (!files.length) return;
    if (proofs.length + files.length > 10) {
      toast.error(`Maximum 10 proof files allowed. Currently ${proofs.length} attached.`);
      return;
    }

    setUploading(true);
    const newItems = [...proofs];

    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      newItems.push({
        url,
        name: file.name,
        type: isVideo ? 'video' : 'photo',
      });
    }

    setProofs(newItems);
    const response = await adminApi.updateClaim(claim.id, { proofFiles: newItems });
    setUploading(false);

    if (response.success && response.data) {
      toast.success('Proof file(s) attached');
      onUpdated(response.data);
    } else {
      toast.info('Proof file(s) updated in preview');
    }
  };

  const removeProof = async (index: number) => {
    const next = proofs.filter((_, idx) => idx !== index);
    setProofs(next);
    const response = await adminApi.updateClaim(claim.id, { proofFiles: next });
    if (response.success && response.data) {
      onUpdated(response.data);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[3px]">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-6 py-4 text-slate-900">
          <div>
            <h3 className="text-base font-bold text-slate-900">Proof Documentation Gallery</h3>
            <p className="text-xs font-semibold text-slate-500">
              Claim #{claim.officialClaimNumber || claim.tataClaimNumber || claim.caseNumber} · {proofs.length}/10 files attached
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6">
          <div className="flex items-center justify-between gap-3">
            <RawGeoSwitch
              mode={mediaMode}
              onChange={setMediaMode}
              geoReady={geoReady}
              loading={maskLoading}
            />
            <span className="text-[11px] font-semibold text-slate-500">
              Tap → {mediaMode === 'geo' ? 'Geo' : 'Raw'} khulega
            </span>
          </div>

          {proofs.length < 10 && (
            <DragDropUploadZone
              onFilesSelected={processFiles}
              acceptedTypes="image/*,video/*"
              label="Drag & Drop proof photos or videos here"
              sublabel={`Remaining slots: ${10 - proofs.length}. Max 50MB per file.`}
              disabled={uploading}
            />
          )}

          {proofs.length === 0 ? (
            <p className="py-12 text-center text-xs font-semibold text-slate-400">No proof documentation uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {proofs.map((item, index) =>
                item.type === 'video' ? (
                  <div
                    key={index}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm"
                  >
                    <div className="flex aspect-[4/3] flex-col items-center justify-center p-3 text-center text-white">
                      <Video className="h-8 w-8 text-violet-400" />
                      <p className="mt-2 line-clamp-1 text-[11px] font-medium">
                        {item.name}
                      </p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/70 opacity-0 transition group-hover:opacity-100">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-white/90 p-2 text-slate-900 hover:bg-white"
                        title="View full size"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => removeProof(index)}
                        className="rounded-lg bg-rose-600 p-2 text-white hover:bg-rose-700"
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <ProofPhotoCard
                    key={index}
                    item={item}
                    mode={mediaMode}
                    onRemove={() => removeProof(index)}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3">
          <button onClick={onClose} className={adminButtonClasses.primary}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3. Documents Modal with Drag & Drop
// ============================================================
function DocumentsModal({
  claim,
  onClose,
  onUpdated,
}: {
  claim: ClaimRequest;
  onClose: () => void;
  onUpdated: (updated: ClaimRequest) => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const docs = documentEntries(claim);

  const uploadDoc = async (mediaType: string, file?: File) => {
    if (!file) return;
    setUploading(mediaType);
    const response = await adminApi.uploadClaimMedia(
      claim.id,
      mediaType as any,
      file,
    );
    setUploading(null);

    if (response.success) {
      toast.success(`${mediaType.toUpperCase()} document uploaded`);
      const refreshed = await adminApi.getClaimById(claim.id);
      if (refreshed.data) onUpdated(refreshed.data);
    } else {
      toast.error(response.message || 'Upload failed');
    }
  };

  const handleDroppedFiles = (files: File[]) => {
    if (files.length > 0) {
      setPendingFile(files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[3px]">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-6 py-4 text-slate-900">
          <div>
            <h3 className="text-base font-bold text-slate-900">Official Document Manager</h3>
            <p className="text-xs font-semibold text-slate-500">
              Claim #{shortenMandiPlusClaimNo(claim.officialClaimNumber || claim.caseNumber)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-6 overflow-y-auto p-6">
          <DragDropUploadZone
            onFilesSelected={handleDroppedFiles}
            acceptedTypes="application/pdf,image/*"
            label="Drag & Drop official document (PDF or image) here"
            sublabel="System will prompt you to select document category"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Estimation Bill (provided by trader)', 'estimationBill'],
              ['FIR Copy', 'fir'],
              ['Accident Picture', 'accidentPic'],
              ['Inspection Report', 'inspectionReport'],
              ['Lorry Receipt (LR)', 'lorryReceipt'],
              ['Insurance Policy', 'insurancePolicy'],
              ['Damage Certificate', 'damageForm'],
            ].map(([label, typeKey]) => (
              <label
                key={typeKey}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 transition hover:border-[#4309ac] hover:bg-violet-50/50 shadow-2xs"
              >
                <span className="flex items-center gap-2">
                  {uploading === typeKey ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#4309ac]" />
                  ) : (
                    <Upload className="h-4 w-4 text-[#4309ac]" />
                  )}
                  {label}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => uploadDoc(typeKey, e.target.files?.[0])}
                />
              </label>
            ))}
          </div>

          <div className="space-y-2.5 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Attached Documents ({docs.length})</p>
              <span className="text-[11px] font-semibold text-slate-400">Viewable & Replaceable</span>
            </div>

            {docs.length === 0 ? (
              <p className="py-6 text-center text-xs font-medium text-slate-400">No documents uploaded yet.</p>
            ) : (
              docs.map(([title, url, typeKey]) => (
                <div
                  key={title}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs font-semibold text-slate-800 transition hover:border-violet-300 hover:bg-violet-50/30 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900">{title}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Attached & Verified
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      View
                    </a>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-2xs hover:bg-violet-100 transition">
                      <Upload className="h-3.5 w-3.5 text-violet-600" />
                      Re-upload
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/*"
                        onChange={(e) => e.target.files?.[0] && uploadDoc(typeKey, e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3">
          <button onClick={onClose} className={adminButtonClasses.primary}>
            Done
          </button>
        </div>
      </div>

      {pendingFile && (
        <CategorySelectModal
          file={pendingFile}
          onClose={() => setPendingFile(null)}
          onConfirm={(catKey) => {
            void uploadDoc(catKey, pendingFile);
            setPendingFile(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// 5. Initiate New Claim Modal
// ============================================================
function NewClaimModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [invoice, setInvoice] = useState<EligibleClaimInvoice | null>(null);
  const [reason, setReason] = useState('Engine Seize');
  const [remarks, setRemarks] = useState('');
  const [tataClaimNumber, setTataClaimNumber] = useState('');
  const [handledBy, setHandledBy] = useState('TATA');
  const [surveyorName, setSurveyorName] = useState('');
  const [surveyorNumber, setSurveyorNumber] = useState('');
  const [payableAmount, setPayableAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!invoice) {
      toast.error('Search and select an invoice or vehicle first');
      return;
    }
    setSaving(true);
    const response = await adminApi.createClaimByInvoice({
      invoiceId: invoice.id,
      tataClaimNumber: tataClaimNumber.trim() || undefined,
      description: reason.trim() || undefined,
      approvedPayableAmount: payableAmount ? Number(payableAmount) : undefined,
      surveyorName: surveyorName.trim() || undefined,
      surveyorNumber: surveyorNumber.trim() || undefined,
      surveyorContact: surveyorNumber.trim() || undefined,
      remarks: remarks.trim() || undefined,
      handledBy: handledBy || 'TATA',
    });

    if (!response.success || !response.data) {
      setSaving(false);
      toast.error(response.message || 'Could not create claim');
      return;
    }

    setSaving(false);
    toast.success('Claim request created successfully!');
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[3px]">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-[#f8fafc] px-6 py-5 text-slate-900">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Initiate Claim Request</h2>
            <p className="text-xs font-semibold text-slate-500">Search by Invoice Number or Vehicle Number</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-6">
          <InvoicePicker value={invoice} onChange={setInvoice} />

          {invoice && (
            <div className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Vehicle Number
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">
                  {invoice.vehicleNumber || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Insured Party
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">
                  {invoice.insuredPersonName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Insured Value
                </p>
                <p className="mt-1 text-sm font-extrabold text-[#4309ac]">
                  {formatCurrency(invoice.amount)}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-800">
              TATA Claim No (Admin)
              <input
                value={tataClaimNumber}
                onChange={(e) => setTataClaimNumber(e.target.value)}
                placeholder="e.g. 4500054295"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <div className="text-xs font-bold text-slate-800">
              MandiPlus Claim No
              <div className={`${fieldClass} mt-1.5 bg-slate-50 text-slate-500 cursor-not-allowed`}>
                Auto-generated when claim is created
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-800">
              Reason for Claim
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`${fieldClass} mt-1.5`}
              >
                <option value="Engine Seize">Engine Seize</option>
                <option value="Accident">Accident</option>
                <option value="Theft">Theft</option>
                <option value="OVERTURN">OVERTURN</option>
                <option value="MINOR ACCIDENT">MINOR ACCIDENT</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-800">
              Handled By
              <select
                value={handledBy}
                onChange={(e) => setHandledBy(e.target.value)}
                className={`${fieldClass} mt-1.5`}
              >
                <option value="TATA">TATA</option>
                <option value="MandiPlus">MandiPlus</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-800">
            We Have To Pay (₹)
            <input
              value={payableAmount}
              onChange={(e) => setPayableAmount(e.target.value)}
              type="number"
              min="0"
              placeholder="55000"
              className={`${fieldClass} mt-1.5`}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-800">
              Surveyor Name
              <input
                value={surveyorName}
                onChange={(e) => setSurveyorName(e.target.value)}
                placeholder="e.g. Srikanth"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <label className="text-xs font-bold text-slate-800">
              Surveyor Number
              <input
                value={surveyorNumber}
                onChange={(e) => setSurveyorNumber(e.target.value)}
                placeholder="e.g. +91 9849227155"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-800">
            Initial Remarks
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="e.g. Awaiting surveyor report before estimation settlement"
              className={`${fieldClass} mt-1.5 resize-none`}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className={adminButtonClasses.secondary}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !invoice}
            className={adminButtonClasses.primary}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Claim Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 6. Upgraded Full View & Edit Claim Modal with Drag & Drop Documentation
// ============================================================
function FullViewClaimModal({
  claim,
  onClose,
  onUpdated,
  onDeleted,
}: {
  claim: ClaimRequest;
  onClose: () => void;
  onUpdated: (claim: ClaimRequest) => void;
  onDeleted: (claimId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'proof' | 'documents' | 'assessment' | 'snapshot'>('overview');
  const initialSurveyors = getClaimSurveyors(claim);

  const [form, setForm] = useState<UpdateClaimDto>({
    tataClaimNumber: claim.tataClaimNumber || '',
    documentsSentToTataAt: claim.documentsSentToTataAt || null,
    handledBy: claim.handledBy || 'TATA',
    description: claim.description || 'Engine Seize',
    status: claim.status,
    approvedPayableAmount: claim.approvedPayableAmount ?? null,
    paymentStatus: claim.paymentStatus || ClaimPaymentStatus.NOT_STARTED,
    paymentReference: claim.paymentReference || '',
    claimDate: toDateInputValue(claim.claimDate || claim.createdAt),
    remarks: claim.remarks || '',
    surveyorName: claim.surveyorName || initialSurveyors[0]?.name || '',
    surveyorNumber: claim.surveyorNumber || claim.surveyorContact || initialSurveyors[0]?.contact || '',
    notes: claim.notes || '',
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const currentIsEngineSeize = isEngineSeizeClaim({ ...claim, description: form.description });
  const [surveyors, setSurveyors] = useState<ClaimSurveyorDraft[]>(() => {
    return initialSurveyors.length > 0 ? initialSurveyors : [{ name: '', contact: '' }];
  });
  const [assessmentReport, setAssessmentReport] = useState<ClaimAssessmentReportData>(() =>
    buildDefaultAssessmentReport(claim),
  );
  const [generatingAssessment, setGeneratingAssessment] = useState(false);
  const [uploadingAssessmentScreenshot, setUploadingAssessmentScreenshot] = useState(false);
  const [extractingAssessment, setExtractingAssessment] = useState(false);
  const [removingScreenshotUrl, setRemovingScreenshotUrl] = useState<string | null>(null);

  // Proof state
  const [proofs, setProofs] = useState<ProofGalleryItem[]>(() =>
    seedProofGallery(claim),
  );
  const geoReady = proofs.some((item) => item.type === 'photo' && item.maskedUrl);
  const [mediaMode, setMediaMode] = useState<'raw' | 'geo'>(() =>
    seedProofGallery(claim).some((item) => item.maskedUrl) ? 'geo' : 'raw',
  );
  const [maskLoading, setMaskLoading] = useState(false);

  const docs = documentEntries(claim);
  const tataDispatchMarkedButUnsaved = Boolean(
    form.documentsSentToTataAt && !claim.documentsSentToTataAt,
  );

  useEffect(() => {
    let active = true;
    setMaskLoading(true);
    void adminApi
      .getClaimById(claim.id)
      .then((response) => {
        if (!active || !response.success || !response.data) return;
        const next = seedProofGallery(response.data);
        setProofs(next);
        if (next.some((item) => item.maskedUrl)) setMediaMode('geo');
        onUpdated(response.data);
      })
      .finally(() => {
        if (active) setMaskLoading(false);
      });
    return () => {
      active = false;
    };
    // Refresh once on open so GPS masks backfill via findOne.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.id]);

  useEffect(() => {
    setAssessmentReport(buildDefaultAssessmentReport(claim));
  }, [claim.id, claim.assessmentReportUrl, claim.assessmentReportData]);

  useEffect(() => {
    if (currentIsEngineSeize && activeTab === 'documents') {
      setActiveTab('assessment');
    } else if (!currentIsEngineSeize && activeTab === 'assessment') {
      setActiveTab('documents');
    }
  }, [activeTab, currentIsEngineSeize]);

  const modalTabs: Array<{
    id: 'overview' | 'proof' | 'documents' | 'assessment' | 'snapshot';
    label: string;
    icon: typeof FileText;
    count: string | null;
  }> = [
    { id: 'overview', label: 'Claim Details & Edit', icon: FileText, count: null },
    { id: 'proof', label: 'Proof Media', icon: ImageIcon, count: `${proofs.length}/10` },
    currentIsEngineSeize
      ? { id: 'assessment', label: 'Technical Assessment', icon: Wrench, count: null }
      : { id: 'documents', label: 'Official Documents', icon: FileCheck2, count: String(docs.length) },
    { id: 'snapshot', label: 'Invoice & Party Snapshot', icon: Truck, count: null },
  ];

  const handleAssessmentScreenshotUpload = async (files: File[]) => {
    const validFiles = filterAssessmentScreenshotFiles(files);
    if (validFiles.length === 0) {
      toast.error('Please upload image or PDF screenshots only');
      return;
    }
    const rcFieldsBefore = countFilledAssessmentRcFields(assessmentReport);
    setUploadingAssessmentScreenshot(true);
    const response = await adminApi.uploadAssessmentSourceScreenshots(claim.id, validFiles);
    setUploadingAssessmentScreenshot(false);
    if (response.success && response.data) {
      const updatedReport = buildDefaultAssessmentReport(response.data);
      const rcFieldsAfter = countFilledAssessmentRcFields(updatedReport);
      onUpdated(response.data);
      setAssessmentReport(updatedReport);
      if (rcFieldsAfter > rcFieldsBefore) {
        toast.success(
          validFiles.length === 1
            ? 'Screenshot uploaded and RC details auto-filled'
            : `${validFiles.length} screenshots uploaded and RC details auto-filled`,
        );
        return;
      }
      toast.success(
        validFiles.length === 1
          ? 'Screenshot uploaded. Click Auto-fill if fields stay empty.'
          : `${validFiles.length} screenshots uploaded. Click Auto-fill if fields stay empty.`,
      );
      return;
    }
    toast.error(response.message || 'Failed to upload screenshots');
  };

  const handleExtractAssessmentFromScreenshots = async () => {
    setExtractingAssessment(true);
    const response = await adminApi.extractAssessmentFromScreenshots(claim.id);
    setExtractingAssessment(false);
    if (response.success && response.data) {
      toast.success('RC details auto-filled from screenshots');
      onUpdated(response.data);
      setAssessmentReport(buildDefaultAssessmentReport(response.data));
      return;
    }
    toast.error(response.message || 'Could not auto-fill from screenshots');
  };

  const handleAssessmentScreenshotRemove = async (url: string) => {
    setRemovingScreenshotUrl(url);
    const response = await adminApi.removeAssessmentSourceScreenshot(claim.id, url);
    setRemovingScreenshotUrl(null);
    if (response.success && response.data) {
      toast.success('Screenshot removed');
      onUpdated(response.data);
      setAssessmentReport(buildDefaultAssessmentReport(response.data));
      return;
    }
    toast.error(response.message || 'Failed to remove screenshot');
  };

  const assessmentScreenshotUrls = useMemo(
    () => getAssessmentSourceScreenshotUrls(assessmentReport),
    [assessmentReport],
  );

  useEffect(() => {
    if (activeTab !== 'assessment' || !currentIsEngineSeize) return;

    const handleWindowPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const files = extractClipboardImageFiles(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        void handleAssessmentScreenshotUpload(files);
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [activeTab, currentIsEngineSeize, claim.id]);

  const generateAssessmentPdf = async () => {
    setGeneratingAssessment(true);
    const response = await adminApi.generateAssessmentReport(claim.id, assessmentReport);
    setGeneratingAssessment(false);
    if (response.success && response.data) {
      toast.success('Assessment report PDF generated');
      onUpdated(response.data);
      setAssessmentReport(buildDefaultAssessmentReport(response.data));
      return;
    }
    toast.error(response.message || 'Failed to generate assessment report');
  };

  const save = async () => {
    const cleanSurveyors = normalizeSurveyors(surveyors);
    setSaving(true);
    const response = await adminApi.updateClaim(claim.id, {
      ...form,
      handledBy: form.handledBy || 'TATA',
      claimDate: form.claimDate || null,
      surveyorName: cleanSurveyors[0]?.name || form.surveyorName || null,
      surveyorNumber: cleanSurveyors[0]?.contact || form.surveyorNumber || null,
      surveyorContact: cleanSurveyors[0]?.contact || form.surveyorNumber || null,
      surveyors: cleanSurveyors,
      proofFiles: proofs,
    });
    setSaving(false);
    if (!response.success || !response.data) {
      toast.error(response.message || 'Could not update claim');
      return;
    }
    toast.success('Claim updated successfully');
    onUpdated(response.data);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    const response = await adminApi.deleteClaim(claim.id);
    setDeleting(false);

    if (response.success) {
      toast.success('Claim deleted successfully');
      onDeleted(claim.id);
      onClose();
    } else {
      toast.success('Claim removed from list');
      onDeleted(claim.id);
      onClose();
    }
  };

  const handleProofDrop = async (files: File[]) => {
    if (proofs.length + files.length > 10) {
      toast.error(`Maximum 10 proof files allowed. Currently ${proofs.length} attached.`);
      return;
    }

    const newItems = [...proofs];
    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      newItems.push({
        url,
        name: file.name,
        type: isVideo ? 'video' : 'photo',
      });
    }

    setProofs(newItems);
    const response = await adminApi.updateClaim(claim.id, { proofFiles: newItems });
    if (response.success && response.data) {
      toast.success('Proof media attached');
      onUpdated(response.data);
    }
  };

  const [pendingTab3File, setPendingTab3File] = useState<File | null>(null);

  const handleDocUploadCategory = async (typeKey: string, file: File) => {
    const response = await adminApi.uploadClaimMedia(claim.id, typeKey as any, file);
    if (response.success) {
      toast.success('Document uploaded successfully');
      const refreshed = await adminApi.getClaimById(claim.id);
      if (refreshed.data) onUpdated(refreshed.data);
    } else {
      toast.error(response.message || 'Upload failed');
    }
  };

  const handleDocDrop = (files: File[]) => {
    if (files.length > 0) {
      setPendingTab3File(files[0]);
    }
  };

  const handleEstimationBillUpload = async (file: File) => {
    const response = await adminApi.uploadClaimMedia(claim.id, 'estimationBill', file);
    if (response.success) {
      toast.success('Estimation Bill (provided by trader) uploaded successfully');
      const refreshed = await adminApi.getClaimById(claim.id);
      if (refreshed.data) onUpdated(refreshed.data);
    } else {
      toast.error(response.message || 'Upload failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px]">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Executive Header Bar */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-[#f8fafc] px-6 py-4 text-slate-900 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="rounded-2xl bg-[#4309ac]/10 p-3 text-[#4309ac]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black tracking-tight text-slate-900">
                    {shortenMandiPlusClaimNo(claim.officialClaimNumber || claim.caseNumber) || claim.tataClaimNumber}
                  </h2>
                  <StatusBadge status={form.status} />
                </div>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Invoice: <strong className="text-slate-800">{claim.invoice?.invoiceNumber || '—'}</strong> · Vehicle: <strong className="text-slate-800">{getVehicleNumber(claim)}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-sm"
              >
                <Trash2 className="h-4 w-4" />
                Delete Claim
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
              <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-4 flex gap-1.5 overflow-x-auto rounded-xl bg-slate-100/70 p-1 border border-slate-200/80">
            {modalTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-white text-violet-700 border border-violet-200 shadow-sm font-bold ring-1 ring-violet-500/10'
                      : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                  }`}
                >
                  <IconComponent className={`h-4 w-4 ${isActive ? 'text-violet-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`ml-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive ? 'bg-violet-100 text-violet-800' : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Financial Metrics Strip */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Insured Invoice Value</p>
                  <p className="mt-1 text-xl font-black text-slate-900">
                    {formatCurrency(claim.insuredValue ?? claim.invoice?.amount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">Settled Amount (₹)</p>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">Edit Amount</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-xl font-black text-blue-950">₹</span>
                    <input
                      type="number"
                      value={form.approvedPayableAmount ?? ''}
                      onChange={(e) => setForm({ ...form, approvedPayableAmount: e.target.value ? Number(e.target.value) : null })}
                      placeholder="0"
                      className="w-full bg-transparent text-xl font-black text-blue-950 outline-none placeholder:text-blue-400/60"
                    />
                  </div>
                </div>
              </div>

              {currentIsEngineSeize && (
                <ClaimDocumentReminderPanel
                  claim={claim}
                  claimNumber={shortenMandiPlusClaimNo(
                    claim.officialClaimNumber || claim.caseNumber,
                  )}
                />
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">
                  Captured Location
                </h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Accident
                    </p>
                    <div className="mt-1">
                      <LocationLink claim={claim} captureType="accident" />
                      {!claim.locationLatitude && (
                        <p className="text-xs text-slate-400">No GPS yet</p>
                      )}
                    </div>
                  </div>
                  {(claim.engineSeizeLocationLatitude ||
                    claim.engineSeizeEvidenceSubmittedAt) && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Engine seize
                      </p>
                      <div className="mt-1">
                        <LocationLink claim={claim} captureType="engine_seize" />
                        {!claim.engineSeizeLocationLatitude && (
                          <p className="text-xs text-slate-400">No GPS yet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Metadata */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">Identifiers & Status Options</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="text-xs font-bold text-slate-800">
                    TATA Claim No (Admin)
                    <input
                      value={form.tataClaimNumber || ''}
                      onChange={(e) => setForm({ ...form, tataClaimNumber: e.target.value })}
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                  <div className="text-xs font-bold text-slate-800">
                    MandiPlus Claim No
                    <div className={`${fieldClass} mt-1.5 bg-slate-50 text-violet-700 font-semibold cursor-not-allowed`}>
                      {shortenMandiPlusClaimNo(claim.officialClaimNumber || claim.caseNumber)}
                    </div>
                  </div>
                  <label className="text-xs font-bold text-slate-800">
                    Claim Date
                    <input
                      type="date"
                      value={form.claimDate || ''}
                      onChange={(e) => setForm({ ...form, claimDate: e.target.value || null })}
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                </div>

                <div
                  className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                    form.documentsSentToTataAt
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        form.documentsSentToTataAt
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-white text-slate-500 shadow-sm ring-1 ring-slate-200'
                      }`}
                    >
                      {form.documentsSentToTataAt ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Documents sent to TATA
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">
                        {form.documentsSentToTataAt
                          ? `${tataDispatchMarkedButUnsaved ? 'Ready to save' : 'Saved'} · ${formatAdminTimestamp(form.documentsSentToTataAt)}`
                          : 'Mark this only after the claim documents have been handed to TATA.'}
                      </p>
                      {tataDispatchMarkedButUnsaved && (
                        <p className="mt-1 text-[10px] font-bold text-emerald-700">
                          Click Save Changes to trigger the customer WhatsApp update.
                        </p>
                      )}
                    </div>
                  </div>

                  {!form.documentsSentToTataAt ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          documentsSentToTataAt: new Date().toISOString(),
                        }))
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 shadow-sm transition hover:bg-violet-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Mark documents sent
                    </button>
                  ) : tataDispatchMarkedButUnsaved ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          documentsSentToTataAt: null,
                        }))
                      }
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-100"
                    >
                      Undo
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                      Sent
                    </span>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="text-xs font-bold text-slate-800">
                    Handled By
                    <select
                      value={form.handledBy || 'TATA'}
                      onChange={(e) => setForm({ ...form, handledBy: e.target.value })}
                      className={`${fieldClass} mt-1.5`}
                    >
                      <option value="TATA">TATA</option>
                      <option value="MandiPlus">MandiPlus</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-800">
                    Reason for Claim
                    <select
                      value={form.description || 'Engine Seize'}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className={`${fieldClass} mt-1.5`}
                    >
                      <option value="Engine Seize">Engine Seize</option>
                      <option value="Accident">Accident</option>
                      <option value="Theft">Theft</option>
                      <option value="OVERTURN">OVERTURN</option>
                      <option value="MINOR ACCIDENT">MINOR ACCIDENT</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-800">
                    Current Status
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as ClaimStatus })}
                      className={`${fieldClass} mt-1.5`}
                    >
                      {claimStatusOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-800">
                    Payment Status
                    <select
                      value={form.paymentStatus}
                      onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as ClaimPaymentStatus })}
                      className={`${fieldClass} mt-1.5`}
                    >
                      {paymentStatusOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-800">
                    Settled Amount (₹)
                    <input
                      type="number"
                      value={form.approvedPayableAmount ?? ''}
                      onChange={(e) => setForm({ ...form, approvedPayableAmount: e.target.value ? Number(e.target.value) : null })}
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-1">
                  <label className="text-xs font-bold text-slate-800">
                    Payment Reference / UTR
                    <input
                      value={form.paymentReference || ''}
                      onChange={(e) => setForm({ ...form, paymentReference: e.target.value })}
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-bold text-slate-800">Payment Proof</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Upload settlement receipt or bank transfer proof (image or PDF).
                  </p>
                  <div className="mt-3">
                    <PaymentProofUpload claim={claim} onUpdated={onUpdated} />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">Surveyors</h3>
                    <button
                      type="button"
                      onClick={() => setSurveyors((current) => [...current, { name: '', contact: '' }])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-2xs hover:bg-violet-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Surveyor
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {surveyors.map((surveyor, index) => (
                      <div key={index} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="text-xs font-bold text-slate-800">
                          {index === 0 ? 'Primary Surveyor Name' : `Surveyor ${index + 1} Name`}
                          <input
                            value={surveyor.name}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSurveyors((current) =>
                                current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: value } : item)),
                              );
                              if (index === 0) setForm({ ...form, surveyorName: value });
                            }}
                            className={`${fieldClass} mt-1.5`}
                          />
                        </label>
                        <label className="text-xs font-bold text-slate-800">
                          {index === 0 ? 'Primary Surveyor Number' : `Surveyor ${index + 1} Number`}
                          <input
                            value={surveyor.contact}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSurveyors((current) =>
                                current.map((item, itemIndex) => (itemIndex === index ? { ...item, contact: value } : item)),
                              );
                              if (index === 0) setForm({ ...form, surveyorNumber: value });
                            }}
                            className={`${fieldClass} mt-1.5`}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setSurveyors((current) =>
                              current.length === 1 ? [{ name: '', contact: '' }] : current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                          className="self-end rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100"
                          title="Remove surveyor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="block text-xs font-bold text-slate-800">
                  Remarks & Case History
                  <textarea
                    rows={3}
                    value={form.remarks || ''}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    className={`${fieldClass} mt-1.5 resize-none`}
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: PROOF & MEDIA (DRAG & DROP) */}
          {activeTab === 'proof' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">Proof Photos & Videos</h3>
                    <p className="text-xs font-medium text-slate-500">
                      {maskLoading
                        ? 'Geo ban raha…'
                        : 'Tap image → selected Raw/Geo khulega'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RawGeoSwitch
                      mode={mediaMode}
                      onChange={setMediaMode}
                      geoReady={geoReady}
                      loading={maskLoading}
                    />
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-extrabold text-[#4309ac]">
                      {proofs.length}/10 Files Attached
                    </span>
                  </div>
                </div>

                {proofs.length < 10 && (
                  <DragDropUploadZone
                    onFilesSelected={handleProofDrop}
                    acceptedTypes="image/*,video/*"
                    label="Drag & Drop proof photos or videos here"
                    sublabel={`Remaining slots: ${10 - proofs.length}. Supports PNG, JPG, MP4, MOV.`}
                  />
                )}

                {proofs.length === 0 ? (
                  <p className="py-12 text-center text-xs font-semibold text-slate-400">No proof files attached yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {proofs.map((item, index) =>
                      item.type === 'video' ? (
                        <div
                          key={index}
                          className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm"
                        >
                          <div className="flex aspect-[4/3] flex-col items-center justify-center p-3 text-center text-white">
                            <Video className="h-8 w-8 text-violet-400" />
                            <p className="mt-2 line-clamp-1 text-[11px] font-medium">
                              {item.name}
                            </p>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/70 opacity-0 transition group-hover:opacity-100">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-white/90 p-2 text-slate-900 hover:bg-white"
                              title="View full size"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                            <button
                              onClick={() => {
                                const next = proofs.filter((_, i) => i !== index);
                                setProofs(next);
                              }}
                              className="rounded-lg bg-rose-600 p-2 text-white hover:bg-rose-700"
                              title="Remove"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                            {item.name}
                          </span>
                        </div>
                      ) : (
                        <ProofPhotoCard
                          key={index}
                          item={item}
                          mode={mediaMode}
                          onRemove={() => {
                            const next = proofs.filter((_, i) => i !== index);
                            setProofs(next);
                          }}
                        />
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OFFICIAL DOCUMENTS (DRAG & DROP) */}
          {activeTab === 'documents' && !currentIsEngineSeize && (
            <div className="space-y-6">
              <ClaimDocumentReminderPanel
                claim={claim}
                claimNumber={shortenMandiPlusClaimNo(
                  claim.officialClaimNumber || claim.caseNumber,
                )}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">Official Claim Documents</h3>
                  <p className="text-xs font-medium text-slate-500">Drag & Drop or select document category to upload</p>
                </div>

                <DragDropUploadZone
                  onFilesSelected={handleDocDrop}
                  acceptedTypes="application/pdf,image/*"
                  label="Drag & Drop official documents (PDF/Image) here"
                  sublabel="System will prompt you to select document category"
                />

                {/* Specific Document Upload Options */}
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  {[
                    ['Estimation Bill (provided by trader)', 'estimationBill'],
                    ['FIR Copy', 'fir'],
                    ['Accident Picture', 'accidentPic'],
                    ['Inspection Report', 'inspectionReport'],
                    ['Lorry Receipt (LR)', 'lorryReceipt'],
                    ['Insurance Policy', 'insurancePolicy'],
                    ['Damage Certificate', 'damageForm'],
                  ].map(([label, typeKey]) => (
                    <label
                      key={typeKey}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 transition hover:border-[#4309ac] hover:bg-violet-50/50 shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-[#4309ac]" />
                        {label}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleDocUploadCategory(typeKey, file);
                          }
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-2.5 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Document Records ({docs.length})</p>
                    <span className="text-[11px] font-semibold text-slate-400">Viewable & Replaceable</span>
                  </div>

                  {docs.length === 0 ? (
                    <p className="py-6 text-center text-xs font-medium text-slate-400">No documents uploaded yet.</p>
                  ) : (
                    docs.map(([title, url, typeKey]) => (
                      <div
                        key={title}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs font-semibold text-slate-800 transition hover:border-violet-300 hover:bg-violet-50/30 shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
                            <FileCheck2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{title}</p>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 mt-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Attached & Verified
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                            View
                          </a>
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-2xs hover:bg-violet-100 transition">
                            <Upload className="h-3.5 w-3.5 text-violet-600" />
                            Re-upload
                            <input
                              type="file"
                              className="hidden"
                              accept="application/pdf,image/*"
                              onChange={(e) => e.target.files?.[0] && handleDocUploadCategory(typeKey, e.target.files[0])}
                            />
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TECHNICAL ASSESSMENT */}
          {activeTab === 'assessment' && currentIsEngineSeize && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">
                      Engine Seize Technical Evaluation
                    </h3>
                    <p className="text-xs font-medium text-slate-500">
                      Fill RC / website details manually. Empty fields appear as Not available in the PDF.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {claim.assessmentReportUrl && (
                      <a
                        href={claim.assessmentReportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Eye className="h-4 w-4" />
                        View PDF
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void generateAssessmentPdf()}
                      disabled={generatingAssessment}
                      className={adminButtonClasses.primary}
                    >
                      {generatingAssessment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Generate PDF Report
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-800">External website screenshots (optional)</p>
                    <p className="text-[11px] text-slate-500">
                      Upload RC / VAHAN screenshots — RC fields auto-fill via Gemini OCR. You can edit anything before generating the PDF.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {assessmentScreenshotUrls.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleExtractAssessmentFromScreenshots()}
                        disabled={
                          uploadingAssessmentScreenshot ||
                          extractingAssessment ||
                          Boolean(removingScreenshotUrl)
                        }
                        className={adminButtonClasses.secondary}
                      >
                        {extractingAssessment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Auto-fill from screenshots
                      </button>
                    )}
                  </div>

                  <DragDropUploadZone
                    enablePaste
                    disabled={uploadingAssessmentScreenshot || extractingAssessment}
                    acceptedTypes="image/*,application/pdf"
                    label={
                      uploadingAssessmentScreenshot
                        ? 'Uploading & reading screenshots...'
                        : extractingAssessment
                          ? 'Auto-filling RC details...'
                          : 'Drag & drop screenshots here or click to browse'
                    }
                    sublabel="Multiple images or PDFs up to 10MB each. Click this area and Ctrl+V to paste an image."
                    onFilesSelected={(files) => void handleAssessmentScreenshotUpload(files)}
                  />

                  {(uploadingAssessmentScreenshot || extractingAssessment) && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-violet-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploadingAssessmentScreenshot
                        ? 'Uploading screenshots and extracting RC details...'
                        : 'Reading screenshots and filling RC fields...'}
                    </div>
                  )}

                  {assessmentScreenshotUrls.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Uploaded screenshots ({assessmentScreenshotUrls.length})
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {assessmentScreenshotUrls.map((url, index) => {
                          const isPdf = url.toLowerCase().includes('.pdf') || url.includes('application/pdf');
                          const isRemoving = removingScreenshotUrl === url;
                          return (
                            <div
                              key={`${url}-${index}`}
                              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-violet-300 hover:shadow-md"
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <div className="relative aspect-[4/3] bg-slate-50">
                                  {isPdf ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                                      <FileText className="h-8 w-8 text-violet-600" />
                                      <span className="text-[10px] font-bold uppercase">PDF</span>
                                    </div>
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={url}
                                      alt={`Assessment screenshot ${index + 1}`}
                                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                    />
                                  )}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent px-2 py-1.5">
                                    <span className="text-[10px] font-bold text-white">
                                      Screenshot {index + 1}
                                    </span>
                                  </div>
                                </div>
                              </a>
                              <button
                                type="button"
                                title="Remove screenshot"
                                disabled={Boolean(removingScreenshotUrl)}
                                onClick={() => void handleAssessmentScreenshotRemove(url)}
                                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white/95 text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isRemoving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {assessmentReportSections.map((section) => (
                <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="mb-4 text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">
                    {section.title}
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <label
                        key={field.key}
                        className={`text-xs font-bold text-slate-800 ${field.multiline ? 'sm:col-span-2' : ''}`}
                      >
                        {field.label}
                        {field.multiline ? (
                          <textarea
                            rows={4}
                            value={assessmentReport[field.key] || ''}
                            onChange={(e) =>
                              setAssessmentReport((current) => ({
                                ...current,
                                [field.key]: e.target.value,
                              }))
                            }
                            placeholder="Leave blank for Not available"
                            className={`${fieldClass} mt-1.5 resize-none`}
                          />
                        ) : (
                          <input
                            value={assessmentReport[field.key] || ''}
                            onChange={(e) =>
                              setAssessmentReport((current) => ({
                                ...current,
                                [field.key]: e.target.value,
                              }))
                            }
                            placeholder="Leave blank for Not available"
                            className={`${fieldClass} mt-1.5`}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: SNAPSHOT */}
          {activeTab === 'snapshot' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">Party Snapshot</h3>
              <div className="grid gap-4 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Insured Party</p>
                  <p className="mt-1 font-extrabold text-slate-900">{getInsuredParty(claim)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Other Party</p>
                  <p className="mt-1 font-extrabold text-slate-900">{getOtherParty(claim)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Invoice Value</p>
                  <p className="mt-1 font-black text-emerald-700">{formatCurrency(claim.insuredValue ?? claim.invoice?.amount)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Insured Person Address</p>
                  <p className="mt-1 font-medium text-slate-700 whitespace-normal break-words [overflow-wrap:anywhere] leading-relaxed">
                    {getInsuredPersonAddress(claim)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Other Party Address</p>
                  <p className="mt-1 font-medium text-slate-700 whitespace-normal break-words [overflow-wrap:anywhere] leading-relaxed">
                    {getOtherPartyAddress(claim)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete Request
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} className={adminButtonClasses.secondary}>
              Close
            </button>
            <button onClick={save} disabled={saving} className={adminButtonClasses.primary}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteClaimModal
          claim={claim}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {pendingTab3File && (
        <CategorySelectModal
          file={pendingTab3File}
          onClose={() => setPendingTab3File(null)}
          onConfirm={(catKey) => {
            void handleDocUploadCategory(catKey, pendingTab3File);
            setPendingTab3File(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [summary, setSummary] = useState<ClaimsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableScale, setTableScale] = useState(90); // Default 90% zoom for optimal view
  const [exporting, setExporting] = useState(false);

  // Modals state
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [showBlacklistVehicle, setShowBlacklistVehicle] = useState(false);
  const [showBlacklistedVehicles, setShowBlacklistedVehicles] = useState(false);
  const [docsClaim, setDocsClaim] = useState<ClaimRequest | null>(null);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    claim: ClaimRequest;
    fieldName: string;
    oldValue: string;
    newValue: string;
    updateKey: 'status' | 'paymentStatus' | 'handledBy';
  } | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const [claimsResponse, summaryResponse] = await Promise.all([
        adminApi.getClaimsPage({
          search: search || undefined,
          status: (status as ClaimStatus) || undefined,
          paymentStatus: (paymentStatus as ClaimPaymentStatus) || undefined,
          page,
          limit: 20,
        }),
        adminApi.getClaimsSummary(),
      ]);

      setClaims(claimsResponse.data?.data || []);
      setTotal(claimsResponse.data?.total || 0);
      setTotalPages(claimsResponse.data?.totalPages || 1);
      setSummary(summaryResponse.data || null);
      if (!silent) setLoading(false);
    },
    [page, paymentStatus, search, status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void adminApi.syncBlacklistedFromClaims();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const updateClaimRow = (updated: ClaimRequest) => {
    setClaims((current) => current.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedClaim((current) => (current?.id === updated.id ? updated : current));
    setDocsClaim((current) => (current?.id === updated.id ? updated : current));
  };

  const removeClaimRow = (claimId: string) => {
    setClaims((current) => current.filter((c) => c.id !== claimId));
  };

  const handleStatusChangeRequest = (
    claim: ClaimRequest,
    updateKey: 'status' | 'paymentStatus' | 'handledBy',
    newValue: string,
  ) => {
    const oldValue = String(claim[updateKey] || '—');
    if (oldValue === newValue) return;

    const fieldNameMap = {
      status: 'Current Status',
      paymentStatus: 'Payment Status',
      handledBy: 'Handled By',
    };

    setConfirmModal({
      claim,
      fieldName: fieldNameMap[updateKey],
      oldValue,
      newValue,
      updateKey,
    });
  };

  const executeStatusUpdate = async () => {
    if (!confirmModal) return;
    const { claim, updateKey, newValue } = confirmModal;
    setConfirmModal(null);

    const updatePayload: UpdateClaimDto = { [updateKey]: newValue };
    const response = await adminApi.updateClaim(claim.id, updatePayload);

    if (response.success && response.data) {
      toast.success(`${confirmModal.fieldName} updated successfully`);
      updateClaimRow(response.data);
    } else {
      toast.error(response.message || 'Could not update status');
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportClaimsToExcel({
        search: search || undefined,
        status: (status as ClaimStatus) || undefined,
        paymentStatus: (paymentStatus as ClaimPaymentStatus) || undefined,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mandiplus-claim-status-${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Claim status tracker exported');
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to export claims to Excel',
      );
    } finally {
      setExporting(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Claims',
        value: summary?.total || claims.length,
        icon: ShieldCheck,
        tone: 'violet' as const,
      },
      {
        label: 'Open Workload',
        value: summary?.open || 0,
        icon: ListFilter,
        tone: 'amber' as const,
      },
      {
        label: 'Evidence Received',
        value: summary?.evidenceReceived || 0,
        icon: CheckCircle2,
        tone: 'emerald' as const,
      },
      {
        label: 'Outstanding Payable',
        value: formatCurrency(summary?.outstandingAmount || 0),
        icon: CircleDollarSign,
        tone: 'blue' as const,
      },
    ],
    [claims.length, summary],
  );

  return (
    <div className="min-h-screen bg-slate-50/70 py-6">
      <div className="w-full space-y-5 px-3 sm:px-4 lg:px-6 xl:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              MandiPlus — Insurance Claim Status
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Live claim tracking, surveyor details, proof documentation and assessment reports
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setShowBlacklistedVehicles(true)}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ShieldBan className="mr-2 h-4 w-4 text-rose-500" />
              View Blacklisted
            </button>
            <button
              onClick={() => setShowBlacklistVehicle(true)}
              className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-100"
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              Blacklist Vehicle
            </button>
            <button
              onClick={() => setShowNewClaim(true)}
              className="inline-flex items-center rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Initiate Claim Request
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        {/* Table Container */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Controls Bar */}
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search invoice number, vehicle number, party or surveyor..."
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-[#4309ac]"
                >
                  <option value="">All Claim Statuses</option>
                  {claimStatusOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-[#4309ac]"
                >
                  <option value="">All Payment Statuses</option>
                  {paymentStatusOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void exportToExcel()}
                  disabled={exporting}
                  className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? 'Exporting...' : 'Export to Excel'}
                </button>

                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setTableScale((s) => Math.max(60, s - 10))}
                    className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition"
                    title="Zoom Out Table (-10%)"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[46px] text-center text-xs font-black text-slate-700">
                    {tableScale}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setTableScale((s) => Math.min(140, s + 10))}
                    className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition"
                    title="Zoom In Table (+10%)"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableScale(90)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition"
                    title="Reset Zoom (90%)"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => void load()}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Clean Executive Table View with Dynamic Scale & Clean Word Wrapping */}
          <div className="isolate overflow-x-auto">
            <div style={{ zoom: `${tableScale}%` }}>
              <table className="w-full min-w-[2200px] border-separate border-spacing-0 text-left">
                <thead className="bg-[#f8fafc] text-slate-600 border-b border-slate-200">
                  <tr>
                    {[
                      'S.NO',
                      'TATA CLAIM NO',
                      'MANDIPLUS CLAIM NO',
                      'INVOICE NO.',
                      'CLAIM DATE',
                      'VEHICLE NO.',
                      'INSURED PARTY',
                      'INSURED PERSON ADDRESS',
                      'OTHER PARTY',
                      'OTHER PARTY ADDRESS',
                      'REASON FOR CLAIM',
                      'INVOICE VALUE',
                      'SETTLED AMT',
                      'DOCUMENTS',
                      'SURVEYOR NAME',
                      'SURVEYOR NUMBER',
                      'CURRENT STATUS',
                      'REMARKS',
                    ].map((heading, index) => (
                      <th
                        key={heading}
                        className={`border-b border-slate-200/90 px-3.5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 ${
                          index < claimTableStickyHeadClasses.length
                            ? claimTableStickyHeadClasses[index]
                            : claimTableColumnWidths[index] || ''
                        } ${index === 11 || index === 12 ? 'text-right whitespace-nowrap' : ''}`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, r) => (
                      <tr key={r}>
                        {Array.from({ length: 18 }).map((__, c) => (
                          <td key={c} className="p-3">
                            <div className="h-4 animate-pulse rounded bg-slate-100" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : claims.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="py-16 text-center text-xs font-semibold text-slate-500">
                        No claims found matching these filters.
                      </td>
                    </tr>
                  ) : (
                    claims.map((claim, idx) => {
                      const docs = documentEntries(claim);
                      const surveyorNameDisplay = formatTableSurveyorField(claim, 'name');
                      const surveyorContactDisplay = formatTableSurveyorField(claim, 'contact');
                      const rowTone = getClaimRowToneClasses(claim.status);
                      const stickyShellClasses = getClaimTableStickyShellClasses();

                      return (
                        <tr
                          key={claim.id}
                          onClick={() => setSelectedClaim(claim)}
                          className={`group cursor-pointer transition text-xs text-slate-900 border-b border-slate-100/80 ${rowTone.row}`}
                        >
                          {/* 1. S.No */}
                          <StickyTableCell
                            shellClassName={stickyShellClasses[0]}
                            toneClassName={rowTone.sticky}
                            contentClassName="text-center font-medium text-slate-500"
                          >
                            {(page - 1) * 20 + idx + 1}
                          </StickyTableCell>

                          {/* 2. TATA Claim No (read-only — edit via claim detail modal) */}
                          <StickyTableCell
                            shellClassName={stickyShellClasses[1]}
                            toneClassName={rowTone.sticky}
                            compact
                          >
                            <span className="block font-semibold text-slate-700 whitespace-nowrap text-[11px]">
                              {claim.tataClaimNumber || '—'}
                            </span>
                          </StickyTableCell>

                          {/* 3. MandiPlus Claim No */}
                          <StickyTableCell
                            shellClassName={stickyShellClasses[2]}
                            toneClassName={rowTone.sticky}
                            contentClassName="font-semibold text-violet-700 tracking-wide whitespace-nowrap text-[11px]"
                            compact
                          >
                            {shortenMandiPlusClaimNo(claim.officialClaimNumber || claim.caseNumber)}
                          </StickyTableCell>

                          {/* 4. Invoice No */}
                          <td className="px-3.5 py-3 font-semibold text-slate-800 whitespace-nowrap">
                            {renderInvoiceNumberTwoLines(claim.invoice?.invoiceNumber)}
                          </td>

                          {/* 5. Claim Date */}
                          <td className="px-3.5 py-3 font-medium text-slate-700 whitespace-nowrap">
                            {formatDate(claim.claimDate || claim.createdAt)}
                          </td>

                          {/* 6. Vehicle No */}
                          <td className="px-3.5 py-3 font-semibold text-slate-700 max-w-[130px] break-words leading-tight">
                            {getVehicleNumber(claim)}
                          </td>

                          {/* 6. Insured Party */}
                          <td className="px-3.5 py-3 font-medium text-slate-800 max-w-[200px] break-words leading-snug">
                            {getInsuredParty(claim)}
                          </td>

                          {/* 7. Insured Person Address */}
                          <td className="px-2.5 py-3 text-slate-500 w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] whitespace-normal break-words [overflow-wrap:anywhere] font-normal leading-snug">
                            {getInsuredPersonAddress(claim)}
                          </td>

                          {/* 8. Other Party */}
                          <td className="px-3.5 py-3 font-medium text-slate-800 max-w-[200px] break-words leading-snug">
                            {getOtherParty(claim)}
                          </td>

                          {/* 9. Other Party Address */}
                          <td className="px-2.5 py-3 text-slate-500 w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] whitespace-normal break-words [overflow-wrap:anywhere] font-normal leading-snug">
                            {getOtherPartyAddress(claim)}
                          </td>

                          {/* 10. Reason for Claim */}
                          <td className="px-3.5 py-3 font-medium text-slate-700 uppercase whitespace-nowrap">
                            {claim.description || 'ENGINE SEIZE'}
                          </td>

                          {/* 12. Invoice / Insured Value */}
                          <td className="px-2 py-3 w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] text-right font-semibold text-slate-800 whitespace-nowrap">
                            {formatCurrency(claim.insuredValue ?? claim.invoice?.amount)}
                          </td>

                          {/* 13. SETTLED AMOUNT (read-only — edit via claim detail modal) */}
                          <td className="px-2 py-3 w-[6.5rem] min-w-[6.5rem] max-w-[6.5rem] text-right bg-blue-50/40 border-x border-blue-100/70 font-bold text-blue-900 whitespace-nowrap">
                            {formatCurrency(
                              claim.approvedPayableAmount ?? claim.claimAmount,
                            )}
                          </td>

                          {/* 14. Documents */}
                          <td className="px-3.5 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setDocsClaim(claim)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100/80"
                            >
                              <FileText className="h-3.5 w-3.5 text-sky-600" />
                              documents ({docs.length})
                            </button>
                          </td>

                          {/* 16. Surveyor Name (read-only — edit via claim detail modal) */}
                          <td className="px-3.5 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-slate-700">{surveyorNameDisplay.value}</span>
                              {surveyorNameDisplay.extraCount > 0 && (
                                <span className="text-[10px] font-semibold text-violet-600">
                                  +{surveyorNameDisplay.extraCount} more surveyor{surveyorNameDisplay.extraCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 17. Surveyor Number (read-only — edit via claim detail modal) */}
                          <td className="px-3.5 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-slate-700 whitespace-nowrap">{surveyorContactDisplay.value}</span>
                              {surveyorContactDisplay.extraCount > 0 && (
                                <span className="text-[10px] font-semibold text-violet-600">
                                  +{surveyorContactDisplay.extraCount} more
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 18. Current Status Dropdown */}
                          <td className="px-3.5 py-3" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={claim.status || ClaimStatus.PENDING}
                              onChange={(e) =>
                                handleStatusChangeRequest(claim, 'status', e.target.value)
                              }
                              className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold uppercase outline-none cursor-pointer ${getSelectStatusClasses(
                                claim.status || ClaimStatus.PENDING,
                              )}`}
                            >
                              {claimStatusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-medium">
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 21. Remarks */}
                          <td className="px-3.5 py-3 max-w-[280px] break-words text-slate-600 font-normal leading-relaxed">
                            {claim.remarks || '—'}
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Showing {claims.length ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)} of {total} claims
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((c) => Math.max(1, c - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="min-w-20 text-center text-xs font-bold text-slate-700">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Render Modals */}
      {showNewClaim && (
        <NewClaimModal
          onClose={() => setShowNewClaim(false)}
          onCreated={() => void load()}
        />
      )}

      {showBlacklistVehicle && (
        <BlacklistVehicleModal
          onClose={() => setShowBlacklistVehicle(false)}
          onBlacklisted={() => setShowBlacklistedVehicles(true)}
        />
      )}

      {showBlacklistedVehicles && (
        <BlacklistedVehiclesModal onClose={() => setShowBlacklistedVehicles(false)} />
      )}

      {selectedClaim && (
        <FullViewClaimModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onUpdated={updateClaimRow}
          onDeleted={removeClaimRow}
        />
      )}

      {confirmModal && (
        <ConfirmStatusModal
          claim={confirmModal.claim}
          fieldName={confirmModal.fieldName}
          oldValue={confirmModal.oldValue}
          newValue={confirmModal.newValue}
          onConfirm={executeStatusUpdate}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {docsClaim && (
        <DocumentsModal
          claim={docsClaim}
          onClose={() => setDocsClaim(null)}
          onUpdated={updateClaimRow}
        />
      )}
    </div>
  );
}

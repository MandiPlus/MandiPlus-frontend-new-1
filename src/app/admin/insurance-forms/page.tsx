'use client';

import { useEffect, useState, useCallback, useRef, Fragment, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { formatCurrency, formatDateOnly, formatTimeOnly } from '@/features/admin/utils/format';
import { AdminLedgerUser, adminApi, InvoiceFilterParams, RegenerateInvoicePayload } from '@/features/admin/api/admin.api';
import { toast } from 'react-toastify';
import 'cropperjs/dist/cropper.css';
import Cropper, { ReactCropperElement } from "react-cropper";
import { ArrowPathIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { FileText, RefreshCw, Upload, Eye, CheckCircle, AlertCircle, X, XCircle, Pencil, ChevronDown, ChevronRight, MoreVertical, Link as LinkIcon, RotateCcw, Monitor } from 'lucide-react';

import InsuranceUploadModal from '@/features/admin/components/InsuranceUploadModal';
import { BlacklistOverrideOtpModal } from '@/features/admin/components/BlacklistOverrideOtpModal';
import {
    isBlacklistOtpRequiredMessage,
    parseBlacklistOtpRequiredError,
} from '@/features/admin/blacklistOverride';
import PartyCombobox, { type PartyComboboxOption } from '@/features/admin/components/PartyCombobox';
import { getHsnForProduct, itemsData } from '@/features/insurance/productCatalog';
import { getVehicleRecentInvoiceStatus, getSupplierHistoricalParties, getBuyerHistoricalSuppliers, isInsuranceImpersonationActive } from '@/features/insurance/api';
import type { HistoricalPartyOption } from '@/features/insurance/api';
import { resolveInsuranceCreationAudience } from '@/features/insurance/creationAccessPolicy';
import DesktopRequiredNotice from '@/shared/components/DesktopRequiredNotice';
import { useDesktopCreationAccess } from '@/shared/hooks/useDesktopCreationAccess';

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

const INSURANCE_OVERRIDES_KEY = 'admin_invoice_insurance_overrides';
const ADMIN_CREATE_INVOICE_SKIP_OCR_KEY = 'admin_create_invoice_skip_ocr';
const INDIAN_PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;
const createInvoicePanelClass = 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm';
const createInvoiceFieldClass = 'mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500';
const createInvoiceFileFieldClass = `${createInvoiceFieldClass} cursor-pointer p-0 text-slate-500 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-slate-200 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-200`;
const createInvoiceTextareaClass = `${createInvoiceFieldClass} resize-none`;
const createInvoiceLabelClass = 'block text-xs font-medium text-slate-700';
const getInvoiceKey = (inv: { id?: string; _id?: string; invoiceNumber?: string }) =>
    inv?.id || inv?._id || inv?.invoiceNumber || '';
const getInvoiceId = (inv: { id?: string; _id?: string }) => inv?.id || inv?._id || '';
const normalizePhoneInput = (value: string) => value.replace(/[^\d+]/g, '').trim();
const isValidIndianPhone = (value: string) => INDIAN_PHONE_REGEX.test(value.trim());

/** Collapse sourceSurface into Admin / App / Web for insurance-forms clarity. */
function insuranceOriginLabel(
    sourceSurface?: string | null,
): 'Admin' | 'App' | 'Web' | '—' {
    const s = String(sourceSurface || '').trim();
    if (!s) return '—';
    if (s === 'CUSTOMER_WEB') return 'Web';
    if (s === 'USER_APP' || s === 'USER_APP_BETA') return 'App';
    if (
        s === 'ADMIN' ||
        s.startsWith('ADMIN_') ||
        s === 'insurance_chat' ||
        s === '/insurance'
    ) {
        return 'Admin';
    }
    return '—';
}

const ORIGIN_FILTER_SOURCE_SURFACES: Record<'Admin' | 'App' | 'Web', string> = {
    Admin: 'ADMIN,ADMIN_QUICK_DETAILS,ADMIN_DEVELOPER_TOOL,insurance_chat,/insurance',
    App: 'USER_APP,USER_APP_BETA',
    Web: 'CUSTOMER_WEB',
};

interface Invoice {
    id: string;
    _id?: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceType?: string;
    supplierName: string;
    supplierAddress: string[];
    billToName: string;
    billToAddress?: string[];
    shipToName?: string;
    shipToAddress?: string[];
    placeOfSupply?: string;
    productName: string[];
    hsnCode?: string;
    quantity: number;
    rate?: number;
    amount: number;
    vehicleNumber?: string;
    truckNumber?: string;
    weighmentSlipNote?: string;
    pdfUrl?: string;
    pdfURL?: string;
    createdAt: string;
    terms?: string;
    sourceSurface?: string | null;
    insuredPersonNameSnapshot?: string;
    insuredPersonUserId?: string;
    customerUserId?: string;
    user?: { id?: string; name?: string } | null;
    customerUser?: { id?: string; name?: string } | null;
    insuredPersonUser?: { id?: string; name?: string } | null;
    insuredPersonDisplayName?: string;
    otherPartyDisplayName?: string;
    insuredPersonDisplayAddress?: string[];
    otherPartyDisplayAddress?: string[];
    isVerified?: boolean;
    isRejected?: boolean;
    rejectionReason?: string | null;
    isSelected?: boolean;
    premiumAmount?: number;
    paymentStatus?: string;
    paymentAmount?: number | null;
    isPaymentRequired?: boolean;
    paymentLinkUrl?: string | null;
    paymentLinkSentAt?: string | null;
    paymentLinkSentCount?: number | null;
    insuredPartyPhone?: string | null;
    insurance?: {
        fileUrl: string;
        fileType: string;
        uploadedAt: string;
    } | null;
}

interface InsuranceFormFilters extends InvoiceFilterParams {
    verificationStatus?: '' | 'pending' | 'verified' | 'rejected';
}

type InsuranceFormsPageProps = {
    appQueueMode?: boolean;
};

type SendPhoneMode = 'payment_link' | 'invoice_created_template';
type AdminInvoiceKind = 'cash' | 'commission';

type AdminCreateInvoiceForm = {
    invoiceKind: AdminInvoiceKind;
    insuredUserId: string;
    otherPartyUserId: string;
    invoiceDate: string;
    supplierName: string;
    supplierAddress: string;
    placeOfSupply: string;
    billToName: string;
    billToAddress: string;
    shipToName: string;
    shipToAddress: string;
    productName: string;
    hsnCode: string;
    quantity: string;
    rate: string;
    vehicleNumber: string;
    truckNumber: string;
    ownerName: string;
    insuredPartyPhone: string;
    driverPhone: string;
    driverSecondaryPhone: string;
};

const emptyAdminCreateInvoiceForm = (): AdminCreateInvoiceForm => ({
    invoiceKind: 'cash',
    insuredUserId: '',
    otherPartyUserId: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    supplierName: '',
    supplierAddress: '',
    placeOfSupply: '',
    billToName: '',
    billToAddress: '',
    shipToName: '',
    shipToAddress: '',
    productName: '',
    hsnCode: '',
    quantity: '',
    rate: '',
    vehicleNumber: '',
    truckNumber: '',
    ownerName: '',
    insuredPartyPhone: '',
    driverPhone: '',
    driverSecondaryPhone: '',
});

const addressFieldsByIdentity: Record<string, string[]> = {
    CUSTOMER: ['destinationShopAddress', 'officeAddress', 'destinationAddress', 'loadingPoint'],
    TRANSPORTER: ['officeAddress', 'destinationAddress', 'loadingPoint'],
    BUYER: ['destinationShopAddress', 'destinationAddress', 'route'],
    SUPPLIER: ['loadingPoint', 'officeAddress', 'route'],
    AGENT: ['destinationAddress', 'mandiName', 'officeAddress'],
    FIELD_AGENT: ['destinationAddress', 'officeAddress'],
    INTERNAL_TEAM: ['officeAddress', 'destinationAddress'],
};

const normalizeLines = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
};

const userAddressText = (user?: Partial<AdminLedgerUser> | null) => {
    if (!user) return '';
    const anyUser = user as any;
    const preferredFields = addressFieldsByIdentity[String(user.identity || '').toUpperCase()] || [];
    const fields = [...preferredFields, 'destinationShopAddress', 'loadingPoint', 'officeAddress', 'destinationAddress', 'route', 'mandiName'];
    for (const field of fields) {
        const lines = normalizeLines(anyUser[field]);
        if (lines.length > 0) return lines.join('\n');
    }
    return String(user.state || '').replace(/_/g, ' ');
};

const userPlaceOfSupply = (user?: Partial<AdminLedgerUser> | null) =>
    userAddressText(user).split('\n').find(Boolean) || String(user?.state || '').replace(/_/g, ' ');

const normalizeVehicleText = (value: string) =>
    value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const hasCatalogProduct = (productName: string) =>
    itemsData.some((item) => item.name === productName);

const extractVehicleNumber = (text: string) => {
    const compact = normalizeVehicleText(text);
    const match = compact.match(/[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}/);
    return match?.[0] || '';
};

const extractAmountNear = (text: string, labels: string[]) => {
    for (const label of labels) {
        const regex = new RegExp(`${label}[^0-9]{0,20}([0-9]+(?:\\.[0-9]+)?)`, 'i');
        const match = text.match(regex);
        if (match?.[1]) return match[1];
    }
    return '';
};

const extractStateLikePlace = (text: string) => {
    const states = [
        'ANDHRA PRADESH', 'BIHAR', 'DELHI', 'GUJARAT', 'HARYANA', 'KARNATAKA',
        'MAHARASHTRA', 'PUNJAB', 'RAJASTHAN', 'TAMIL NADU', 'TELANGANA',
        'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL',
    ];
    const upper = text.toUpperCase().replace(/_/g, ' ');
    return states.find((state) => upper.includes(state)) || '';
};

const extractProductGuess = (text: string) => {
    const products = ['Tender Coconut', 'Pineapple', 'Mosambi', 'Ginger', 'Coconut', 'Banana', 'Mango'];
    const lower = text.toLowerCase();
    return products.find((product) => lower.includes(product.toLowerCase())) || '';
};

const normalizePartyName = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const cleanExtractedName = (value?: string | null) =>
    String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/^(for|to|bill to|party name)\s*[:\-]?\s*/i, '')
        .trim();

const getOcrLines = (text: string) =>
    text
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

const extractLineValue = (text: string, patterns: RegExp[]) => {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) return cleanExtractedName(match[1]);
    }
    return '';
};

const nextUsefulLine = (lines: string[], index: number) => {
    const blocked = /^(authorized signatory|tax invoice|invoice details|invoice no|date|phone|email|state|description|total|sub total)$/i;
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 5); cursor += 1) {
        const line = lines[cursor];
        if (!line || blocked.test(line)) continue;
        return line;
    }
    return '';
};

const extractSupplierName = (text: string) => {
    const lines = getOcrLines(text);
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const inlineFor = line.match(/^For\s*:\s*(.+)$/i);
        if (inlineFor?.[1]) {
            const value = cleanExtractedName(inlineFor[1]);
            if (value && !/authorized signatory/i.test(value)) return value;
        }
        if (/^For\s*:?\s*$/i.test(line)) {
            const value = cleanExtractedName(nextUsefulLine(lines, index));
            if (value) return value;
        }
        const labelled = line.match(/^(Seller|Supplier)\s*[:\-]\s*(.+)$/i);
        if (labelled?.[2]) return cleanExtractedName(labelled[2]);
    }

    return extractLineValue(text, [
        /For\s*:\s*([^\n\r]+?)(?=\s{2,}|Authorized|Phone|Email|State|Tax Invoice|$)/i,
        /Seller\s*[:\-]\s*([^\n\r]+)/i,
        /Supplier\s*[:\-]\s*([^\n\r]+)/i,
    ]);
};

const extractBillToName = (text: string) => {
    const lines = getOcrLines(text);
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const inlineBillTo = line.match(/^Bill\s*To\s*:?\s*(.+)$/i);
        if (inlineBillTo?.[1]) {
            const value = cleanExtractedName(inlineBillTo[1]);
            if (value && !/^contact/i.test(value)) return value;
        }
        if (/^Bill\s*To\s*:?\s*$/i.test(line)) {
            const value = cleanExtractedName(nextUsefulLine(lines, index));
            if (value) return value;
        }
        const labelled = line.match(/^(Buyer|Billed\s*To)\s*[:\-]\s*(.+)$/i);
        if (labelled?.[2]) return cleanExtractedName(labelled[2]);
    }

    return extractLineValue(text, [
        /Bill\s*To\s+([^\n\r]+?)(?=\s{2,}|Contact|Invoice Details|Address|$)/i,
        /Buyer\s*[:\-]\s*([^\n\r]+)/i,
        /Billed\s*To\s*[:\-]\s*([^\n\r]+)/i,
    ]);
};

const extractBillToAddress = (text: string) => {
    const lines = getOcrLines(text);
    const billIndex = lines.findIndex((line) => /^Bill\s*To\b/i.test(line));
    if (billIndex >= 0) {
        const nameLine = /^Bill\s*To\s*:?\s*.+/i.test(lines[billIndex])
            ? lines[billIndex]
            : nextUsefulLine(lines, billIndex);
        const nameIndex = lines.findIndex((line, index) => index >= billIndex && line === nameLine);
        const address = nextUsefulLine(lines, nameIndex >= 0 ? nameIndex : billIndex);
        if (address && !/^Contact/i.test(address) && !/^Invoice Details/i.test(address)) {
            return address;
        }
    }

    return extractLineValue(text, [
        /Bill\s*To\s+[^\n\r]+?\s{2,}([A-Za-z][A-Za-z\s,.-]+?)(?=\s{2,}|Contact|Invoice Details|$)/i,
    ]);
};

const extractPhoneNear = (text: string, labels: string[]) => {
    for (const label of labels) {
        const pattern = new RegExp(`${label}[^0-9+]{0,25}((?:\\+?91[\\s-]?)?[6-9][0-9\\s-]{9,14})`, 'i');
        const match = text.match(pattern);
        if (match?.[1]) return match[1].replace(/[^\d+]/g, '');
    }
    return '';
};

const extractInvoiceHints = (text: string) => ({
    vehicleNumber: extractVehicleNumber(text),
    quantity: extractAmountNear(text, ['quantity', 'qty', 'net weight', 'weight']),
    rate: extractAmountNear(text, ['rate']),
    placeOfSupply: extractStateLikePlace(text),
    productName: extractProductGuess(text),
    supplierName: extractSupplierName(text),
    billToName: extractBillToName(text),
    billToAddress: extractBillToAddress(text),
    insuredPhone: extractPhoneNear(text, ['Contact No\\.?', 'Mobile', 'Phone no\\.?', 'Phone']),
});

const extractPdfText = async (file: File): Promise<string> => {
    if (!file.type.includes('pdf')) return '';
    try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await (pdfjs as any).getDocument({ data, disableWorker: true }).promise;
        const pageTexts: string[] = [];
        for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 3); pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            pageTexts.push(content.items.map((item: any) => item.str || '').join(' '));
        }
        return pageTexts.join('\n');
    } catch {
        return '';
    }
};

const EXPORTABLE_INVOICE_COLUMNS = [
    { key: 'invoiceNumber', label: 'Invoice Number' },
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'invoiceType', label: 'Invoice Type' },
    { key: 'supplierName', label: 'Supplier Name' },
    { key: 'supplierAddress', label: 'Supplier Address' },
    { key: 'buyerName', label: 'Buyer Name' },
    { key: 'buyerAddress', label: 'Buyer Address' },
    { key: 'shipToName', label: 'Ship To Name' },
    { key: 'shipToAddress', label: 'Ship To Address' },
    { key: 'insuredPersonName', label: 'Insured Person Name' },
    { key: 'insuredPersonAddress', label: 'Insured Person Address' },
    { key: 'placeOfSupply', label: 'Place Of Supply' },
    { key: 'productName', label: 'Product Name' },
    { key: 'hsnCode', label: 'HSN Code' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'rate', label: 'Rate' },
    { key: 'amount', label: 'Amount' },
    { key: 'premiumAmount', label: 'Premium Amount' },
    { key: 'paymentAmount', label: 'Payment Amount' },
    { key: 'paymentStatus', label: 'Payment Status' },
    { key: 'paymentDate', label: 'Payment Date' },
    { key: 'vehicleNumber', label: 'Vehicle Number' },
    { key: 'truckNumber', label: 'Truck Number' },
    { key: 'weighmentSlipNote', label: 'Weighment Slip Note' },
    { key: 'ownerName', label: 'Owner Name' },
    { key: 'userName', label: 'User Name' },
    { key: 'userMobile', label: 'User Mobile' },
    { key: 'isClaim', label: 'Is Claim' },
    { key: 'isVerified', label: 'Is Verified' },
    { key: 'isRejected', label: 'Is Rejected' },
    { key: 'rejectionReason', label: 'Rejection Reason' },
    { key: 'insuranceStatus', label: 'Insurance Status' },
    { key: 'insuranceUploadedAt', label: 'Insurance Uploaded At' },
    { key: 'createdAt', label: 'Created At' },
] as const;

export function InsuranceFormsPageContent({ appQueueMode = false }: InsuranceFormsPageProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { isAuthenticated, accessProfile } = useAdmin();
    const desktopCreationAccess = useDesktopCreationAccess();
    const audience = resolveInsuranceCreationAudience({
        user,
        hasDirectAdminSession: true,
        hasAdminActorSession: isInsuranceImpersonationActive(),
        adminMobileNumber: accessProfile?.account?.mobileNumber,
    });
    const canCreateOnThisDevice =
        desktopCreationAccess.allowed || audience.canCreateOnMobile;

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [insuranceOverrides, setInsuranceOverrides] = useState<
        Record<string, { fileUrl: string; uploadedAt: string; fileType?: string }>
    >(() => {
        if (typeof window === 'undefined') return {};
        try {
            const stored = window.localStorage.getItem(INSURANCE_OVERRIDES_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (e) {
            console.error('Failed to load insurance overrides from storage', e);
        }
        return {};
    });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [showInsuranceModal, setShowInsuranceModal] = useState(false);
    const [selectedInvoiceForInsurance, setSelectedInvoiceForInsurance] = useState<Invoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [formData, setFormData] = useState<Partial<RegenerateInvoicePayload>>({});
    const [editInsuredUserId, setEditInsuredUserId] = useState('');
    const [editOtherPartyUserId, setEditOtherPartyUserId] = useState('');
    const [editInvoiceKind, setEditInvoiceKind] = useState<AdminInvoiceKind>('commission');
    const [verifyingInvoiceId, setVerifyingInvoiceId] = useState<string | null>(null);
    const [rejectingInvoiceId, setRejectingInvoiceId] = useState<string | null>(null);
    const [sendingPaymentInvoiceId, setSendingPaymentInvoiceId] = useState<string | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(
        EXPORTABLE_INVOICE_COLUMNS.map((column) => column.key),
    );
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const [invoiceMenuPlacement, setInvoiceMenuPlacement] = useState<Record<string, 'up' | 'down'>>({});
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
    const [createInvoiceBlockedNoticeOpen, setCreateInvoiceBlockedNoticeOpen] = useState(false);
    const [createInvoiceSubmitting, setCreateInvoiceSubmitting] = useState(false);
    const createInvoiceRequestInFlightRef = useRef(false);
    const [createInvoiceParsing, setCreateInvoiceParsing] = useState(false);
    const [verifiedUsers, setVerifiedUsers] = useState<AdminLedgerUser[]>([]);
    const [otherPartyHistorical, setOtherPartyHistorical] = useState<HistoricalPartyOption[]>([]);
    const [otherPartyHistoricalLoading, setOtherPartyHistoricalLoading] = useState(false);
    const [createInvoiceForm, setCreateInvoiceForm] = useState<AdminCreateInvoiceForm>(() => emptyAdminCreateInvoiceForm());
    const [createWeighmentFiles, setCreateWeighmentFiles] = useState<File[]>([]);
    const [createPurchaseBillFile, setCreatePurchaseBillFile] = useState<File | null>(null);
    const [blacklistOtpOpen, setBlacklistOtpOpen] = useState(false);
    const [blacklistOtpRetryKind, setBlacklistOtpRetryKind] = useState<'create' | 'regenerate' | null>(null);
    const [blacklistOtpAction, setBlacklistOtpAction] = useState<'create_invoice' | 'edit_claim_invoice'>('edit_claim_invoice');
    const [blacklistOtpVehicleNumber, setBlacklistOtpVehicleNumber] = useState<string | undefined>();
    const [blacklistOtpInvoiceId, setBlacklistOtpInvoiceId] = useState<string | undefined>();
    const [documentExtractText, setDocumentExtractText] = useState('');
    const [skipCreateInvoiceOcr, setSkipCreateInvoiceOcr] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(ADMIN_CREATE_INVOICE_SKIP_OCR_KEY) === '1';
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'verify' | 'reject' | 'info' | null>(null);
    const [modalInvoice, setModalInvoice] = useState<Invoice | null>(null);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalPrimaryLabel, setModalPrimaryLabel] = useState('');
    const [modalSecondaryLabel, setModalSecondaryLabel] = useState('Cancel');
    const [rejectReasonDraft, setRejectReasonDraft] = useState('');
    const [sendPhoneModalOpen, setSendPhoneModalOpen] = useState(false);
    const [sendPhoneInvoice, setSendPhoneInvoice] = useState<Invoice | null>(null);
    const [sendPhoneDraft, setSendPhoneDraft] = useState('');
    const [sendPhoneMode, setSendPhoneMode] = useState<SendPhoneMode>('payment_link');
    // Send Insurance PDF modal state
    const [sendPdfModalOpen, setSendPdfModalOpen] = useState(false);
    const [sendPdfInvoice, setSendPdfInvoice] = useState<Invoice | null>(null);
    const [sendPdfPhone, setSendPdfPhone] = useState('');
    const [sendPdfFile, setSendPdfFile] = useState<File | null>(null);
    const [sendingPdfInvoiceId, setSendingPdfInvoiceId] = useState<string | null>(null);

    // --- Cropper & File State ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [isCropperReady, setIsCropperReady] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [weightmentSlip, setWeightmentSlip] = useState<File | null>(null);
    const cropperRef = useRef<ReactCropperElement>(null);
    const [invoiceDateInputType, setInvoiceDateInputType] = useState<'text' | 'date'>('text');
    const [pdfRefreshKeys, setPdfRefreshKeys] = useState<Record<string, number>>({});
    const [filters, setFilters] = useState<InsuranceFormFilters>({
        invoiceType: '',
        invoiceNumber: '',
        vehicleNumber: '',
        startDate: '',
        endDate: '',
        supplierName: '',
        buyerName: '',
        productName: '',
        sourceSurface: appQueueMode ? 'USER_APP' : '',
        verificationStatus: '',
    });
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const [serverTotal, setServerTotal] = useState(0);
    const [serverTotalPages, setServerTotalPages] = useState(1);
    const [summaryStats, setSummaryStats] = useState({ totalRows: 0, verifiedCount: 0, rejectedCount: 0, pendingInsuranceCount: null as number | null, pendingPaymentCount: 0, paidCount: 0, totalPremium: 0, totalPaidAmount: 0 });
    const debouncedFilters = useDebounce(filters, 500);

    const buildActiveFilters = useCallback((sourceFilters: InsuranceFormFilters): InvoiceFilterParams => {
        const activeFilters: InvoiceFilterParams = {};

        if (sourceFilters.invoiceType) {
            activeFilters.invoiceType = sourceFilters.invoiceType;
        }

        if (sourceFilters.invoiceNumber?.trim()) {
            const value = sourceFilters.invoiceNumber.trim();
            if (value.length >= 2) activeFilters.invoiceNumber = value;
        }

        if (sourceFilters.vehicleNumber?.trim()) {
            const value = sourceFilters.vehicleNumber.trim();
            if (value.length >= 2) activeFilters.vehicleNumber = value;
        }

        if (sourceFilters.startDate) {
            activeFilters.startDate = sourceFilters.startDate;
        }

        if (sourceFilters.endDate) {
            activeFilters.endDate = sourceFilters.endDate;
        }

        if (sourceFilters.supplierName?.trim()) {
            const value = sourceFilters.supplierName.trim();
            if (value.length >= 3) activeFilters.supplierName = value;
        }

        if (sourceFilters.buyerName?.trim()) {
            const value = sourceFilters.buyerName.trim();
            if (value.length >= 3) activeFilters.buyerName = value;
        }

        if (sourceFilters.productName?.trim()) {
            activeFilters.productName = sourceFilters.productName.trim();
        }

        if (appQueueMode && sourceFilters.sourceSurface === 'USER_APP') {
            activeFilters.sourceSurfaces = 'USER_APP,USER_APP_BETA,ADMIN_QUICK_DETAILS';
        } else if (
            sourceFilters.sourceSurface === 'Admin' ||
            sourceFilters.sourceSurface === 'App' ||
            sourceFilters.sourceSurface === 'Web'
        ) {
            activeFilters.sourceSurfaces =
                ORIGIN_FILTER_SOURCE_SURFACES[sourceFilters.sourceSurface];
        } else if (sourceFilters.sourceSurface?.trim()) {
            activeFilters.sourceSurface = sourceFilters.sourceSurface.trim();
        }

        if (sourceFilters.verificationStatus === 'verified') {
            activeFilters.isVerified = true;
            activeFilters.isRejected = false;
        } else if (sourceFilters.verificationStatus === 'pending') {
            activeFilters.isVerified = false;
            activeFilters.isRejected = false;
        } else if (sourceFilters.verificationStatus === 'rejected') {
            activeFilters.isRejected = true;
        }

        return activeFilters;
    }, [appQueueMode]);

    const normalizeInvoices = useCallback((rawInvoices: any[]) => {
        const normalized = rawInvoices.map((raw: any) => {
            const inv = {
                ...raw,
                id: getInvoiceId(raw),
            };
            const key = getInvoiceKey(inv);
            const override = key ? insuranceOverrides[key] : undefined;
            if (!override) return inv;
            return {
                ...inv,
                insurance: {
                    fileUrl: override.fileUrl,
                    uploadedAt: override.uploadedAt,
                    fileType: override.fileType ?? 'application/pdf',
                },
            };
        });

        return normalized;
    }, [appQueueMode, insuranceOverrides]);

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const activeFilters = buildActiveFilters(debouncedFilters);

            const [pageResponse, summaryResponse] = await Promise.all([
                adminApi.filterInvoicesPaginated({ ...activeFilters, page: currentPage, limit: ITEMS_PER_PAGE }),
                adminApi.filterInvoicesSummary(activeFilters),
            ]);

            let data: Invoice[] = [];
            if (pageResponse.success && Array.isArray(pageResponse.data)) {
                data = pageResponse.data;
            }

            setInvoices(normalizeInvoices(data));
            setServerTotal(Number(pageResponse.total) || 0);
            setServerTotalPages(Math.max(1, Number(pageResponse.totalPages) || 1));

            if (summaryResponse.success) {
                setSummaryStats({
                    totalRows: summaryResponse.totalRows || 0,
                    verifiedCount: summaryResponse.verifiedCount || 0,
                    rejectedCount: summaryResponse.rejectedCount || 0,
                    pendingInsuranceCount: summaryResponse.pendingInsuranceCount ?? null,
                    pendingPaymentCount: summaryResponse.pendingPaymentCount || 0,
                    paidCount: summaryResponse.paidCount || 0,
                    totalPremium: summaryResponse.totalPremium || 0,
                    totalPaidAmount: summaryResponse.totalPaidAmount || 0,
                });
            }

        } catch (err: any) {
            console.error("Fetch error:", err);
            setError('Failed to fetch invoices');
        } finally {
            setLoading(false);
        }
    }, [buildActiveFilters, debouncedFilters, normalizeInvoices, currentPage]);

    const refreshInvoiceAfterRegenerate = useCallback(async (invoiceId: string) => {
        const activeFilters = buildActiveFilters(debouncedFilters);

        for (let attempt = 0; attempt < 8; attempt += 1) {
            try {
                const response = await adminApi.filterInvoicesPaginated({ ...activeFilters, page: currentPage, limit: ITEMS_PER_PAGE });
                let data: Invoice[] = [];

                if (response.success && Array.isArray(response.data)) {
                    data = response.data;
                }

                const normalized = normalizeInvoices(data);
                const refreshedInvoice = normalized.find((invoice) => getInvoiceId(invoice) === invoiceId);

                if (refreshedInvoice) {
                    setInvoices((prev) => prev.map((invoice) => (
                        getInvoiceId(invoice) === invoiceId ? refreshedInvoice : invoice
                    )));
                }

                if (refreshedInvoice?.pdfUrl || refreshedInvoice?.pdfURL) {
                    setPdfRefreshKeys((prev) => ({ ...prev, [invoiceId]: Date.now() }));
                    return;
                }
            } catch (error) {
                console.error('Failed to refresh regenerated invoice', error);
            }

            await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        await fetchInvoices();
        setPdfRefreshKeys((prev) => ({ ...prev, [invoiceId]: Date.now() }));
    }, [buildActiveFilters, debouncedFilters, fetchInvoices, normalizeInvoices, currentPage]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                INSURANCE_OVERRIDES_KEY,
                JSON.stringify(insuranceOverrides),
            );
        } catch (e) {
            console.error('Failed to save insurance overrides to storage', e);
        }
    }, [insuranceOverrides]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (skipCreateInvoiceOcr) {
            window.localStorage.setItem(ADMIN_CREATE_INVOICE_SKIP_OCR_KEY, '1');
        } else {
            window.localStorage.removeItem(ADMIN_CREATE_INVOICE_SKIP_OCR_KEY);
        }
    }, [skipCreateInvoiceOcr]);

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace('/admin/login');
            return;
        }
        fetchInvoices();
    }, [isAuthenticated, router, fetchInvoices]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const loadVerifiedUsers = async () => {
            const response = await adminApi.getAdminLedgerUsers();
            if (!response.success || !Array.isArray(response.data)) return;
            setVerifiedUsers(
                response.data
                    .filter((user) => (
                        user.isLedgerMasterVerified &&
                        !user.isMerged &&
                        user.id === user.canonicalUserId
                    ))
                    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))),
            );
        };
        void loadVerifiedUsers();
    }, [isAuthenticated]);

    const selectedInsuredUser = useMemo(
        () => verifiedUsers.find((user) => user.id === createInvoiceForm.insuredUserId) || null,
        [createInvoiceForm.insuredUserId, verifiedUsers],
    );

    const selectedOtherPartyUser = useMemo(
        () => verifiedUsers.find((user) => user.id === createInvoiceForm.otherPartyUserId) || null,
        [createInvoiceForm.otherPartyUserId, verifiedUsers],
    );

    useEffect(() => {
        const insuredId = isEditing ? editInsuredUserId : createInvoiceForm.insuredUserId;
        const invoiceKind = isEditing ? editInvoiceKind : createInvoiceForm.invoiceKind;
        if (!insuredId) {
            setOtherPartyHistorical([]);
            return;
        }
        let cancelled = false;
        const fetchHistorical = async () => {
            setOtherPartyHistoricalLoading(true);
            try {
                const isCash = invoiceKind === 'cash';
                const parties = isCash
                    ? await getBuyerHistoricalSuppliers({ buyerId: insuredId })
                    : await getSupplierHistoricalParties({ supplierId: insuredId });
                if (!cancelled) setOtherPartyHistorical(parties);
            } catch {
                if (!cancelled) setOtherPartyHistorical([]);
            } finally {
                if (!cancelled) setOtherPartyHistoricalLoading(false);
            }
        };
        void fetchHistorical();
        return () => { cancelled = true; };
    }, [isEditing, editInsuredUserId, editInvoiceKind, createInvoiceForm.insuredUserId, createInvoiceForm.invoiceKind]);

    const otherPartyComboboxOptions: PartyComboboxOption[] = useMemo(() => {
        const byName = new Map<string, { totalInvoices: number; addresses: string[]; phone?: string }>();
        for (const party of otherPartyHistorical) {
            const key = party.name.trim().toLowerCase();
            const existing = byName.get(key);
            if (existing) {
                existing.totalInvoices += party.invoiceCount;
                if (party.address && !existing.addresses.includes(party.address)) {
                    existing.addresses.push(party.address);
                }
                if (!existing.phone && party.phoneNumber) existing.phone = party.phoneNumber;
            } else {
                byName.set(key, {
                    totalInvoices: party.invoiceCount,
                    addresses: party.address ? [party.address] : [],
                    phone: party.phoneNumber || undefined,
                });
            }
        }

        const seen = new Set<string>();
        return otherPartyHistorical
            .filter((party) => {
                const key = party.name.trim().toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map((party) => {
                const key = party.name.trim().toLowerCase();
                const agg = byName.get(key)!;
                const subtitle = agg.addresses.length > 1
                    ? `${agg.addresses[0]} (+${agg.addresses.length - 1} more)`
                    : agg.addresses[0] || undefined;
                return {
                    value: party.name,
                    label: party.name,
                    subtitle,
                    meta: `${agg.totalInvoices} invoice${agg.totalInvoices === 1 ? '' : 's'}`,
                    searchText: `${party.name} ${agg.addresses.join(' ')} ${agg.phone || ''}`,
                };
            });
    }, [otherPartyHistorical]);

    const applyCreateInvoiceParties = useCallback((
        insuredUser: AdminLedgerUser | null,
        otherPartyUser: AdminLedgerUser | null,
        invoiceKind: AdminInvoiceKind,
        previous: AdminCreateInvoiceForm,
    ): AdminCreateInvoiceForm => {
        const insuredAddress = userAddressText(insuredUser);
        const otherAddress = userAddressText(otherPartyUser);
        const next: AdminCreateInvoiceForm = {
            ...previous,
            invoiceKind,
            insuredPartyPhone: insuredUser?.mobileNumber || previous.insuredPartyPhone,
        };

        if (invoiceKind === 'cash') {
            next.invoiceKind = 'cash';
            next.billToName = insuredUser?.name || '';
            next.billToAddress = insuredAddress;
            next.shipToName = insuredUser?.name || '';
            next.shipToAddress = insuredAddress;
            next.supplierName = otherPartyUser?.name || '';
            next.supplierAddress = otherAddress;
            next.placeOfSupply = previous.placeOfSupply || userPlaceOfSupply(otherPartyUser) || userPlaceOfSupply(insuredUser);
        } else {
            next.invoiceKind = 'commission';
            next.supplierName = insuredUser?.name || '';
            next.supplierAddress = insuredAddress;
            next.placeOfSupply = previous.placeOfSupply || userPlaceOfSupply(insuredUser);
            next.billToName = otherPartyUser?.name || '';
            next.billToAddress = otherAddress;
            next.shipToName = otherPartyUser?.name || '';
            next.shipToAddress = otherAddress;
        }

        if (!next.productName && Array.isArray((insuredUser as any)?.products) && (insuredUser as any).products[0]) {
            next.productName = (insuredUser as any).products[0];
        }
        if (next.productName && !next.hsnCode) {
            next.hsnCode = getHsnForProduct(next.productName) || next.hsnCode;
        }

        return next;
    }, []);

    const handleOtherPartyComboboxChange = useCallback((value: string, isCustom: boolean) => {
        const matchedHistorical = otherPartyHistorical.find(
            (p) => p.name === value,
        );
        const matchedVerified = verifiedUsers.find(
            (u) => u.name?.trim().toLowerCase() === value.trim().toLowerCase(),
        );

        const otherPartyUser = matchedVerified || null;
        const otherPartyUserId = otherPartyUser?.id || '';

        setCreateInvoiceForm((prev) => {
            const updated = applyCreateInvoiceParties(
                selectedInsuredUser,
                otherPartyUser,
                prev.invoiceKind,
                { ...prev, otherPartyUserId },
            );

            if (isCustom || (!otherPartyUser && matchedHistorical)) {
                if (prev.invoiceKind === 'cash') {
                    updated.supplierName = value;
                    updated.supplierAddress = matchedHistorical?.address || '';
                } else {
                    updated.billToName = value;
                    updated.billToAddress = matchedHistorical?.address || '';
                    updated.shipToName = value;
                    updated.shipToAddress = matchedHistorical?.shipToAddress || matchedHistorical?.address || '';
                }
            }

            if (matchedHistorical?.phoneNumber && prev.invoiceKind === 'cash') {
                updated.insuredPartyPhone = matchedHistorical.phoneNumber;
            }

            return updated;
        });
    }, [otherPartyHistorical, verifiedUsers, selectedInsuredUser, applyCreateInvoiceParties]);

    const applyEditInvoiceParties = useCallback((
        insuredUser: AdminLedgerUser | null,
        otherPartyUser: AdminLedgerUser | null,
        invoiceKind: AdminInvoiceKind,
        previous: Partial<RegenerateInvoicePayload>,
    ): Partial<RegenerateInvoicePayload> => {
        const insuredAddress = userAddressText(insuredUser);
        const otherAddress = userAddressText(otherPartyUser);
        const next: Partial<RegenerateInvoicePayload> = {
            ...previous,
            invoiceType: invoiceKind === 'cash' ? 'BUYER_INVOICE' : 'SUPPLIER_INVOICE',
            insuredPartyPhone: insuredUser?.mobileNumber || previous.insuredPartyPhone,
            weighmentSlipNote:
                previous.weighmentSlipNote ||
                (invoiceKind === 'cash' ? 'cash' : 'commission'),
        };

        if (invoiceKind === 'cash') {
            next.billToName = insuredUser?.name || '';
            next.billToAddress = insuredAddress;
            next.shipToName = insuredUser?.name || '';
            next.shipToAddress = insuredAddress;
            next.supplierName = otherPartyUser?.name || previous.supplierName || '';
            next.supplierAddress = otherAddress || previous.supplierAddress || '';
            next.placeOfSupply =
                previous.placeOfSupply ||
                userPlaceOfSupply(otherPartyUser) ||
                userPlaceOfSupply(insuredUser);
        } else {
            next.supplierName = insuredUser?.name || '';
            next.supplierAddress = insuredAddress;
            next.placeOfSupply =
                previous.placeOfSupply || userPlaceOfSupply(insuredUser);
            next.billToName = otherPartyUser?.name || previous.billToName || '';
            next.billToAddress = otherAddress || previous.billToAddress || '';
            next.shipToName = otherPartyUser?.name || previous.shipToName || '';
            next.shipToAddress = otherAddress || previous.shipToAddress || '';
        }

        return next;
    }, []);

    const handleEditOtherPartyComboboxChange = useCallback((value: string, isCustom: boolean) => {
        const matchedHistorical = otherPartyHistorical.find((p) => p.name === value);
        const matchedVerified = verifiedUsers.find(
            (u) => u.name?.trim().toLowerCase() === value.trim().toLowerCase(),
        );
        const otherPartyUser = matchedVerified || null;
        const insuredUser =
            verifiedUsers.find((user) => user.id === editInsuredUserId) || null;

        setEditOtherPartyUserId(otherPartyUser?.id || '');
        setFormData((prev) => {
            const updated = applyEditInvoiceParties(
                insuredUser,
                otherPartyUser,
                editInvoiceKind,
                prev,
            );

            if (isCustom || (!otherPartyUser && matchedHistorical)) {
                if (editInvoiceKind === 'cash') {
                    updated.supplierName = value;
                    updated.supplierAddress = matchedHistorical?.address || '';
                } else {
                    updated.billToName = value;
                    updated.billToAddress = matchedHistorical?.address || '';
                    updated.shipToName = value;
                    updated.shipToAddress =
                        matchedHistorical?.shipToAddress ||
                        matchedHistorical?.address ||
                        '';
                }
            }

            return updated;
        });
    }, [
        otherPartyHistorical,
        verifiedUsers,
        editInsuredUserId,
        editInvoiceKind,
        applyEditInvoiceParties,
    ]);

    const findVerifiedUserByName = useCallback((name: string) => {
        const normalizedName = normalizePartyName(name);
        if (!normalizedName) return null;
        return (
            verifiedUsers.find((user) => normalizePartyName(user.name || '') === normalizedName) ||
            verifiedUsers.find((user) => {
                const userName = normalizePartyName(user.name || '');
                return Boolean(userName && (userName.includes(normalizedName) || normalizedName.includes(userName)));
            }) ||
            null
        );
    }, [verifiedUsers]);

    const updateCreateInvoiceForm = (patch: Partial<AdminCreateInvoiceForm>) => {
        setCreateInvoiceForm((prev) => ({ ...prev, ...patch }));
    };

    const updateCreateInvoiceProduct = (productName: string) => {
        setCreateInvoiceForm((prev) => ({
            ...prev,
            productName,
            hsnCode: getHsnForProduct(productName),
        }));
    };

    const validateCreateInvoiceVehicle = async (vehicleNumber: string) => {
        const normalizedVehicle = normalizeVehicleText(vehicleNumber);
        if (!normalizedVehicle) return;

        try {
            const status = await getVehicleRecentInvoiceStatus(normalizedVehicle);
            if (status.hasRecentInvoice) {
                toast.error(
                    status.message ||
                    'An invoice was already created for this vehicle within the last 24 hours. Please try again after 24 hours.',
                );
            }
        } catch (error: any) {
            toast.error(error?.message || 'Unable to verify recent vehicle invoice status.');
        }
    };

    const openCreateInvoiceModal = () => {
        if (!desktopCreationAccess.ready) return;
        if (!canCreateOnThisDevice) {
            setCreateInvoiceBlockedNoticeOpen(true);
            return;
        }

        setCreateInvoiceForm(emptyAdminCreateInvoiceForm());
        setCreateWeighmentFiles([]);
        setCreatePurchaseBillFile(null);
        setDocumentExtractText('');
        setCreateInvoiceOpen(true);
    };

    const closeCreateInvoiceModal = () => {
        if (createInvoiceSubmitting) return;
        setCreateInvoiceOpen(false);
        setCreateInvoiceForm(emptyAdminCreateInvoiceForm());
        setCreateWeighmentFiles([]);
        setCreatePurchaseBillFile(null);
        setDocumentExtractText('');
    };

    const handleCreateInvoiceDocumentChange = async (
        weighmentFiles: File[],
        purchaseBillFile: File | null,
    ) => {
        setCreateWeighmentFiles(weighmentFiles);
        setCreatePurchaseBillFile(purchaseBillFile);

        const filesToParse = [...weighmentFiles, ...(purchaseBillFile ? [purchaseBillFile] : [])];
        if (filesToParse.length === 0) {
            setDocumentExtractText('');
            return;
        }

        if (skipCreateInvoiceOcr) {
            setDocumentExtractText('');
            toast.info('OCR is skipped. Fill invoice details manually.');
            return;
        }

        setCreateInvoiceParsing(true);
        try {
            let extracted = '';
            const ocrResponse = await adminApi.extractInvoiceDocumentText(filesToParse);
            if (ocrResponse.success) {
                extracted = ocrResponse.data?.text || '';
            } else {
                extracted = (await Promise.all(filesToParse.map(extractPdfText))).join('\n');
                toast.error(ocrResponse.message || 'Gemini OCR failed. PDF text fallback was used where possible.');
            }
            setDocumentExtractText(extracted);
            const hints = extractInvoiceHints(extracted);
            setCreateInvoiceForm((prev) => {
                const supplierUser = findVerifiedUserByName(hints.supplierName);
                const billToUser = findVerifiedUserByName(hints.billToName);
                const insuredUser = prev.invoiceKind === 'cash' ? billToUser : supplierUser;
                const otherPartyUser = prev.invoiceKind === 'cash' ? supplierUser : billToUser;
                const base = applyCreateInvoiceParties(
                    insuredUser,
                    otherPartyUser,
                    prev.invoiceKind,
                    {
                        ...prev,
                        insuredUserId: insuredUser?.id || prev.insuredUserId,
                        otherPartyUserId: otherPartyUser?.id || prev.otherPartyUserId,
                    },
                );

                const productName = hasCatalogProduct(hints.productName)
                    ? hints.productName
                    : prev.productName;

                return {
                    ...base,
                    supplierName: base.supplierName || hints.supplierName || prev.supplierName,
                    billToName: base.billToName || hints.billToName || prev.billToName,
                    shipToName: base.shipToName || hints.billToName || prev.shipToName,
                    billToAddress: base.billToAddress || hints.billToAddress || prev.billToAddress,
                    shipToAddress: base.shipToAddress || hints.billToAddress || prev.shipToAddress,
                    vehicleNumber: hints.vehicleNumber || prev.vehicleNumber,
                    truckNumber: hints.vehicleNumber || prev.truckNumber,
                    quantity: hints.quantity || prev.quantity,
                    rate: hints.rate || prev.rate,
                    productName,
                    hsnCode: getHsnForProduct(productName) || base.hsnCode || prev.hsnCode,
                    placeOfSupply: hints.placeOfSupply || base.placeOfSupply || prev.placeOfSupply,
                    insuredPartyPhone:
                        insuredUser?.mobileNumber ||
                        (prev.invoiceKind === 'cash' ? hints.insuredPhone : supplierUser?.mobileNumber) ||
                        prev.insuredPartyPhone,
                };
            });
            if (!extracted.trim()) {
                toast.info('No readable text was extracted. Review and fill fields manually.');
            }
        } finally {
            setCreateInvoiceParsing(false);
        }
    };


    const openBlacklistOtpModal = (params: {
        retryKind: 'create' | 'regenerate';
        action: 'create_invoice' | 'edit_claim_invoice';
        vehicleNumber?: string;
        invoiceId?: string;
    }) => {
        setBlacklistOtpRetryKind(params.retryKind);
        setBlacklistOtpAction(params.action);
        setBlacklistOtpVehicleNumber(params.vehicleNumber);
        setBlacklistOtpInvoiceId(params.invoiceId);
        setBlacklistOtpOpen(true);
    };

    const resolveBlacklistOtpPrompt = (
        source: unknown,
        fallbackMessage?: string,
        fallback?: {
            retryKind: 'create' | 'regenerate';
            action?: 'create_invoice' | 'edit_claim_invoice';
            vehicleNumber?: string;
            invoiceId?: string;
        },
    ) => {
        const parsed = parseBlacklistOtpRequiredError(source);
        if (parsed) {
            openBlacklistOtpModal({
                retryKind: fallback?.retryKind || 'regenerate',
                action: parsed.action || fallback?.action || 'edit_claim_invoice',
                vehicleNumber: parsed.vehicleNumber || fallback?.vehicleNumber,
                invoiceId: parsed.invoiceId || fallback?.invoiceId,
            });
            return true;
        }

        if (isBlacklistOtpRequiredMessage(fallbackMessage) && fallback) {
            openBlacklistOtpModal({
                retryKind: fallback.retryKind,
                action: fallback.action || 'edit_claim_invoice',
                vehicleNumber: fallback.vehicleNumber,
                invoiceId: fallback.invoiceId,
            });
            return true;
        }

        return false;
    };

    const executeCreateInvoice = async (blacklistOverrideToken?: string) => {
        if (createInvoiceRequestInFlightRef.current) return;

        const insuredUser = selectedInsuredUser;
        if (!insuredUser) {
            toast.error('Select a registered verified insured party.');
            return;
        }
        if (createWeighmentFiles.length === 0) {
            toast.error('Upload at least one weighment slip.');
            return;
        }

        const qty = Number(createInvoiceForm.quantity || 0);
        const rate = Number(createInvoiceForm.rate || 0);
        const amount = Number((qty * rate).toFixed(2));
        if (!createInvoiceForm.supplierName.trim() || !createInvoiceForm.billToName.trim()) {
            toast.error('Supplier and bill-to details are required.');
            return;
        }
        if (!createInvoiceForm.productName.trim() || qty <= 0 || rate <= 0) {
            toast.error('Fill product, quantity, and rate before creating invoice.');
            return;
        }
        if (!isValidIndianPhone(createInvoiceForm.insuredPartyPhone)) {
            toast.error('Insured party phone must be a valid Indian mobile number.');
            return;
        }
        const normalizedDriverPhone = normalizePhoneInput(createInvoiceForm.driverPhone);
        const normalizedDriverSecondaryPhone = normalizePhoneInput(createInvoiceForm.driverSecondaryPhone);
        if (
            createInvoiceForm.driverPhone.trim() &&
            !isValidIndianPhone(createInvoiceForm.driverPhone)
        ) {
            toast.error('Driver mobile number must be a valid Indian mobile number.');
            return;
        }
        if (
            createInvoiceForm.driverSecondaryPhone.trim() &&
            !isValidIndianPhone(createInvoiceForm.driverSecondaryPhone)
        ) {
            toast.error('Alternate driver mobile number must be a valid Indian mobile number.');
            return;
        }
        if (
            createInvoiceForm.driverSecondaryPhone.trim() &&
            normalizedDriverPhone &&
            normalizedDriverPhone === normalizedDriverSecondaryPhone
        ) {
            toast.error('Alternate driver mobile number must be different from primary driver number.');
            return;
        }

        // React state is applied on the next render, so it cannot by itself
        // stop two clicks delivered in the same tick. The ref is synchronous.
        createInvoiceRequestInFlightRef.current = true;
        setCreateInvoiceSubmitting(true);
        try {
            const vehicleNumber = normalizeVehicleText(createInvoiceForm.vehicleNumber);
            const response = await adminApi.createAdminInvoice({
                userId: insuredUser.id,
                customerUserId: insuredUser.id,
                buyerUserId: createInvoiceForm.invoiceKind === 'cash' ? insuredUser.id : undefined,
                supplierUserId: createInvoiceForm.invoiceKind === 'commission' ? insuredUser.id : undefined,
                invoiceDate: createInvoiceForm.invoiceDate,
                invoiceType: createInvoiceForm.invoiceKind === 'cash' ? 'BUYER_INVOICE' : 'SUPPLIER_INVOICE',
                supplierName: createInvoiceForm.supplierName.trim(),
                supplierAddress: normalizeLines(createInvoiceForm.supplierAddress),
                placeOfSupply: createInvoiceForm.placeOfSupply.trim() || userPlaceOfSupply(insuredUser),
                billToName: createInvoiceForm.billToName.trim(),
                billToAddress: normalizeLines(createInvoiceForm.billToAddress),
                shipToName: createInvoiceForm.shipToName.trim(),
                shipToAddress: normalizeLines(createInvoiceForm.shipToAddress),
                productName: createInvoiceForm.productName.trim(),
                hsnCode: createInvoiceForm.hsnCode.trim() || undefined,
                quantity: qty,
                rate,
                amount,
                vehicleNumber,
                truckNumber: normalizeVehicleText(createInvoiceForm.truckNumber || createInvoiceForm.vehicleNumber),
                ownerName: createInvoiceForm.ownerName.trim() || undefined,
                insuredPartyPhone: normalizePhoneInput(createInvoiceForm.insuredPartyPhone),
                driverPhone: normalizedDriverPhone || undefined,
                driverSecondaryPhone: normalizedDriverSecondaryPhone
                    ? normalizedDriverSecondaryPhone
                    : undefined,
                weighmentSlipNote: createInvoiceForm.invoiceKind === 'cash' ? 'cash' : 'commission',
                weighmentSlips: createWeighmentFiles,
                sourceSurface: 'ADMIN',
                blacklistOverrideToken,
            });

            if (!response.success) {
                const message = typeof response.message === 'string'
                    ? response.message
                    : 'Failed to create invoice';
                if (resolveBlacklistOtpPrompt(response.data || response, message, {
                    retryKind: 'create',
                    action: 'create_invoice',
                    vehicleNumber,
                })) {
                    return;
                }
                throw new Error(message);
            }

            toast.success('Invoice created and sent to insured party.');
            closeCreateInvoiceModal();
            await fetchInvoices();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to create invoice');
        } finally {
            createInvoiceRequestInFlightRef.current = false;
            setCreateInvoiceSubmitting(false);
        }
    };

    const handleCreateInvoiceSubmit = async () => {
        if (!desktopCreationAccess.ready || !canCreateOnThisDevice) {
            setCreateInvoiceOpen(false);
            setCreateInvoiceBlockedNoticeOpen(true);
            return;
        }

        await executeCreateInvoice();
    };

    const productOptions = useMemo(() => {
        const catalogProducts = itemsData.map((item) => item.name);
        const invoiceProducts = invoices
            .flatMap((invoice) => Array.isArray(invoice.productName) ? invoice.productName : [invoice.productName])
            .map((product) => String(product || '').trim())
            .filter(Boolean);
        const options = [...catalogProducts, ...invoiceProducts];

        if (filters.productName?.trim()) {
            options.push(filters.productName.trim());
        }

        return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b));
    }, [filters.productName, invoices]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const openExportModal = () => {
        setShowExportModal(true);
    };

    const toggleExportColumn = (columnKey: string) => {
        setSelectedExportColumns((prev) =>
            prev.includes(columnKey)
                ? prev.filter((key) => key !== columnKey)
                : [...prev, columnKey],
        );
    };

    const handleExport = async () => {
        if (selectedExportColumns.length === 0) {
            toast.error('Select at least one column to export.');
            return;
        }

        setExporting(true);
        try {
            const activeFilters = buildActiveFilters(filters);

            const body = {
                ...activeFilters,
                selectedColumns: selectedExportColumns,
            };

            const blob = await adminApi.exportInvoices(body);

            if (blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                const timestamp = new Date().toISOString().split('T')[0];
                const fileName = `invoices_export_${timestamp}.xlsx`;

                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                setShowExportModal(false);

                toast.success('✅ Export successful!');
            }
        } catch (err: any) {
            console.error("❌ Export failed:", err);
            const errorMsg = err?.response?.data?.message || err?.message || "Failed to export";
            toast.error(errorMsg);
        } finally {
            setExporting(false);
        }
    };

    const closeActionModal = () => {
        setModalOpen(false);
        setModalType(null);
        setModalInvoice(null);
        setModalTitle('');
        setModalMessage('');
        setModalPrimaryLabel('');
        setModalSecondaryLabel('Cancel');
        setRejectReasonDraft('');
    };

    const closeSendPhoneModal = () => {
        setSendPhoneModalOpen(false);
        setSendPhoneInvoice(null);
        setSendPhoneDraft('');
        setSendPhoneMode('payment_link');
    };

    const openSendPhoneModal = (inv: Invoice, mode: SendPhoneMode) => {
        setSendPhoneInvoice(inv);
        setSendPhoneDraft(inv.insuredPartyPhone || '');
        setSendPhoneMode(mode);
        setSendPhoneModalOpen(true);
    };

    const closeSendPdfModal = () => {
        setSendPdfModalOpen(false);
        setSendPdfInvoice(null);
        setSendPdfPhone('');
        setSendPdfFile(null);
    };

    const openSendPdfModal = (inv: Invoice) => {
        setSendPdfInvoice(inv);
        setSendPdfPhone(inv.insuredPartyPhone || '');
        setSendPdfModalOpen(true);
    };

    const submitSendInsurancePdf = async () => {
        if (sendingPdfInvoiceId || !sendPdfInvoice) return;

        const invoiceId = getInvoiceId(sendPdfInvoice);
        if (!invoiceId) {
            toast.error('Invoice ID missing. Please refresh and try again.');
            return;
        }

        const fileUrl = getInsuranceFileUrl(sendPdfInvoice);
        if (!fileUrl) {
            toast.error('No insurance PDF uploaded for this invoice yet.');
            return;
        }

        const phoneNumber = normalizePhoneInput(sendPdfPhone);
        if (!phoneNumber || !isValidIndianPhone(phoneNumber)) {
            toast.error('Enter a valid Indian mobile number.');
            return;
        }

        try {
            setSendingPdfInvoiceId(invoiceId);
            toast.loading('Sending insurance PDF...', { toastId: 'send-pdf' });

            const res = await adminApi.sendInsurancePdfViaBackend(invoiceId, phoneNumber);
            if (!res.success) throw new Error(res.message || 'Failed to send insurance PDF');

            const updateRes = await adminApi.updateInvoicePhone(invoiceId, phoneNumber);
            if (!updateRes.success) {
                throw new Error(updateRes.message || 'Insurance PDF sent, but failed to save phone number');
            }

            setInvoices((prev) =>
                prev.map((invoice) =>
                    getInvoiceId(invoice) === invoiceId
                        ? { ...invoice, insuredPartyPhone: phoneNumber }
                        : invoice
                )
            );

            toast.update('send-pdf', {
                render: 'Insurance PDF sent successfully',
                type: 'success',
                isLoading: false,
                autoClose: 2000,
            });
            closeSendPdfModal();
        } catch (error: any) {
            toast.update('send-pdf', {
                render: error?.message || 'Failed to send insurance PDF',
                type: 'error',
                isLoading: false,
                autoClose: 3000,
            });
        } finally {
            setSendingPdfInvoiceId(null);
        }
    };

    const requestVerify = (inv: Invoice) => {
        if (verifyingInvoiceId) return;
        if (inv.isVerified && !inv.isRejected) return;
        setModalInvoice(inv);
        setModalType('verify');
        setModalTitle('Verify invoice?');
        setModalMessage('This will mark the invoice as verified.');
        setModalPrimaryLabel('Verify');
        setModalSecondaryLabel('Cancel');
        setModalOpen(true);
    };

    const confirmVerifyInvoice = async (inv: Invoice) => {
        closeActionModal();
        await handleVerifyOnly(inv);
    };

    const executeRejectInvoice = async (inv: Invoice, rejectionReason?: string) => {
        const invoiceId = getInvoiceId(inv);
        if (!invoiceId) {
            toast.error('Invoice ID missing. Please refresh and try again.');
            return;
        }
        try {
            setRejectingInvoiceId(invoiceId);
            toast.loading('Rejecting invoice...', { toastId: 'reject-invoice' });

            const res = await adminApi.rejectInvoice(invoiceId, rejectionReason);
            if (!res.success) {
                throw new Error(res.message || 'Failed to reject invoice');
            }

            toast.update('reject-invoice', {
                render: 'Invoice rejected',
                type: 'success',
                isLoading: false,
                autoClose: 2000,
            });

            setInvoices((prev) =>
                prev.map((item) =>
                    item.id === inv.id
                        ? {
                            ...item,
                            isRejected: true,
                            isVerified: false,
                            rejectionReason: rejectionReason || null,
                        }
                        : item,
                ),
            );
            await fetchInvoices();
        } catch (error: any) {
            toast.update('reject-invoice', {
                render: error?.message || 'Failed to reject invoice',
                type: 'error',
                isLoading: false,
                autoClose: 3000,
            });
        } finally {
            setRejectingInvoiceId(null);
        }
    };

    const requestReject = (inv: Invoice) => {
        if (rejectingInvoiceId) return;
        if (inv.isRejected) return;

        const reasonInput = window.prompt(
            'Enter rejection reason (optional):',
            inv.rejectionReason || '',
        );
        if (reasonInput === null) return;
        const rejectionReason = reasonInput.trim() || undefined;
        void executeRejectInvoice(inv, rejectionReason);
    };

    const handleModalPrimary = () => {
        if (modalType === 'reject') {
            closeActionModal();
            return;
        }

        if (modalType === 'verify' && modalInvoice) {
            void confirmVerifyInvoice(modalInvoice);
            return;
        }

        if (modalType === 'info' && modalInvoice) {
            closeActionModal();
            requestVerify(modalInvoice);
        }
    };

    const handleVerifyOnly = async (inv: Invoice) => {
        if (verifyingInvoiceId) return;

        try {
            setVerifyingInvoiceId(inv.id);
            toast.loading('Verifying invoice...', { toastId: 'verify-only' });

            const res = await adminApi.verifyInvoice(inv.id);
            if (!res.success) {
                throw new Error(res.message || 'Failed to verify invoice');
            }

            toast.update('verify-only', {
                render: 'Invoice verified',
                type: 'success',
                isLoading: false,
                autoClose: 2000,
            });

            await fetchInvoices();
        } catch (error: any) {
            toast.update('verify-only', {
                render: error?.message || 'Failed to verify invoice',
                type: 'error',
                isLoading: false,
                autoClose: 3000,
            });
        } finally {
            setVerifyingInvoiceId(null);
        }
    };

    const toFullFileUrl = (url?: string) => {
        if (!url) return '';
        return url.startsWith('http')
            ? url
            : `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}${url}`;
    };

    const getInsuranceFileUrl = (inv: any): string | undefined => {
        const insurance = inv?.insurance;
        if (typeof insurance === 'string') return insurance;
        if (insurance?.fileUrl) return insurance.fileUrl;
        if (insurance?.url) return insurance.url;
        if (inv?.insuranceFileUrl) return inv.insuranceFileUrl;
        if (inv?.insuranceUrl) return inv.insuranceUrl;
        const key = getInvoiceKey(inv);
        if (key && insuranceOverrides[key]) return insuranceOverrides[key].fileUrl;
        return undefined;
    };

    const handleViewPdf = (inv: Invoice) => {
        const url = inv.pdfUrl || inv.pdfURL;
        if (!url) return;

        const fullUrl = toFullFileUrl(url);
        const invoiceId = getInvoiceId(inv);
        const refreshKey = invoiceId ? (pdfRefreshKeys[invoiceId] || Date.now()) : Date.now();
        const separator = fullUrl.includes('?') ? '&' : '?';
        window.open(`${fullUrl}${separator}v=${refreshKey}`, '_blank');
    };

    const handleEditClick = (invoice: Invoice) => {
        const initialVehicleNumber = normalizeVehicleText(
            invoice.vehicleNumber || invoice.truckNumber || ''
        );
        const invoiceKind: AdminInvoiceKind = isBuyerInsuredInvoice(invoice)
            ? 'cash'
            : 'commission';
        const insuredName = invoiceKind === 'cash'
            ? (invoice.billToName || '')
            : (invoice.supplierName || '');
        const otherName = invoiceKind === 'cash'
            ? (invoice.supplierName || '')
            : (invoice.billToName || '');

        const linkedInsuredId =
            invoice.insuredPersonUserId ||
            invoice.customerUserId ||
            invoice.insuredPersonUser?.id ||
            invoice.customerUser?.id ||
            invoice.user?.id ||
            '';
        const matchedInsured =
            verifiedUsers.find((user) => user.id === linkedInsuredId) ||
            verifiedUsers.find(
                (user) => normalizePartyName(user.name || '') === normalizePartyName(insuredName),
            ) ||
            null;
        const matchedOther =
            verifiedUsers.find(
                (user) => normalizePartyName(user.name || '') === normalizePartyName(otherName),
            ) || null;

        setEditingInvoice(invoice);
        setEditInvoiceKind(invoiceKind);
        setEditInsuredUserId(matchedInsured?.id || '');
        setEditOtherPartyUserId(matchedOther?.id || '');
        setWeightmentSlip(null);
        setFormData({
            invoiceId: invoice.id,
            invoiceType: invoice.invoiceType || (invoiceKind === 'cash' ? 'BUYER_INVOICE' : 'SUPPLIER_INVOICE'),
            supplierName: invoice.supplierName,
            supplierAddress: Array.isArray(invoice.supplierAddress)
                ? invoice.supplierAddress.join('\n')
                : invoice.supplierAddress || '',
            placeOfSupply: invoice.placeOfSupply || '',
            billToName: invoice.billToName,
            billToAddress: (Array.isArray(invoice.billToAddress)
                ? invoice.billToAddress.join('\n')
                : invoice.billToAddress) || '',
            shipToName: invoice.shipToName || '',
            shipToAddress: Array.isArray(invoice.shipToAddress)
                ? invoice.shipToAddress.join('\n')
                : invoice.shipToAddress || '',
            productName: Array.isArray(invoice.productName)
                ? invoice.productName[0]
                : invoice.productName || '',
            hsnCode: invoice.hsnCode || '',
            quantity: invoice.quantity || 0,
            rate: invoice.rate || 0,
            amount: invoice.amount || 0,
            vehicleNumber: initialVehicleNumber,
            truckNumber: initialVehicleNumber,
            weighmentSlipNote: invoice.weighmentSlipNote || '',
            invoiceDate: invoice.createdAt
                ? invoice.createdAt.split('T')[0]
                : new Date().toISOString().split('T')[0],
            terms: invoice.terms || '',
            insuredPartyPhone: invoice.insuredPartyPhone || matchedInsured?.mobileNumber || '',
        });
        setIsEditing(true);
        setInvoiceDateInputType(invoice.createdAt ? 'date' : 'text');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result as string);
                setIsCropping(true);
                setIsCropperReady(false);
                setRotation(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const rotateImage = (degrees: number) => {
        setRotation((prev) => {
            const nextRotation = (prev + degrees) % 360;
            cropperRef.current?.cropper.rotateTo(nextRotation);
            return nextRotation;
        });
    };

    const closeCropper = () => {
        setIsCropping(false);
        setIsCropperReady(false);
        setImageSrc(null);
        setRotation(0);
    };

    const handleCropComplete = () => {
        const cropper = cropperRef.current?.cropper;
        if (!cropper) return;
        cropper.getCroppedCanvas({
            minWidth: 300, minHeight: 300, maxWidth: 4096, maxHeight: 4096,
            fillColor: '#fff', imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
        }).toBlob(blob => {
            if (blob) {
                setWeightmentSlip(new File([blob], 'updated-weightment-slip.jpg', { type: 'image/jpeg' }));
                closeCropper();
            }
        }, 'image/jpeg', 0.9);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next: Partial<RegenerateInvoicePayload> = {
                ...prev,
                [name]: value,
            };

            if (name === 'quantity' || name === 'rate') {
                const qty = Number(name === 'quantity' ? value : next.quantity) || 0;
                const rate = Number(name === 'rate' ? value : next.rate) || 0;
                next.amount = qty * rate;
            }

            return next;
        });
    };

    const executeRegenerate = async (blacklistOverrideToken?: string) => {
        if (!editingInvoice) return;

        const insuredUser = verifiedUsers.find((user) => user.id === editInsuredUserId) || null;
        if (!insuredUser) {
            toast.error('Select a registered verified user for the insured party before saving.');
            return;
        }

        const vehicleNumber = normalizeVehicleText(
            String(formData.vehicleNumber || formData.truckNumber || ''),
        );

        if (!blacklistOverrideToken) {
            try {
                const response = await adminApi.checkInvoiceBlacklistOverride({
                    invoiceId: editingInvoice.id,
                });
                const requirement = response?.data ?? response;
                if (requirement?.requiresOtp) {
                    openBlacklistOtpModal({
                        retryKind: 'regenerate',
                        action: 'edit_claim_invoice',
                        vehicleNumber: requirement.vehicleNumber || vehicleNumber,
                        invoiceId: editingInvoice.id,
                    });
                    return;
                }
            } catch (error) {
                console.error('Failed to check claim invoice OTP requirement:', error);
            }
        }

        setIsRegenerating(true);

        try {
            if (weightmentSlip) {
                await adminApi.uploadWeighmentSlips(editingInvoice.id, [weightmentSlip]);
            }

            const qty = Number(formData.quantity) || 0;
            const rate = Number(formData.rate) || 0;
            const computedAmount = qty * rate;
            const invoiceType = editInvoiceKind === 'cash' ? 'BUYER_INVOICE' : 'SUPPLIER_INVOICE';

            const payload: RegenerateInvoicePayload = {
                ...formData,
                invoiceId: editingInvoice.id,
                invoiceType,
                vehicleNumber,
                truckNumber: vehicleNumber,
                userId: insuredUser.id,
                customerUserId: insuredUser.id,
                buyerUserId: editInvoiceKind === 'cash' ? insuredUser.id : undefined,
                supplierUserId: editInvoiceKind === 'commission' ? insuredUser.id : undefined,
                weighmentSlipNote:
                    formData.weighmentSlipNote ||
                    (editInvoiceKind === 'cash' ? 'cash' : 'commission'),

                supplierAddress: typeof formData.supplierAddress === "string"
                    ? formData.supplierAddress.split("\n").filter(Boolean)
                    : formData.supplierAddress || [],

                billToAddress: typeof formData.billToAddress === "string"
                    ? formData.billToAddress.split("\n").filter(Boolean)
                    : formData.billToAddress || [],

                shipToAddress: typeof formData.shipToAddress === "string"
                    ? formData.shipToAddress.split("\n").filter(Boolean)
                    : formData.shipToAddress || [],

                quantity: qty,
                rate,
                amount: computedAmount,
                insuredPartyPhone:
                    formData.insuredPartyPhone || insuredUser.mobileNumber || undefined,
                blacklistOverrideToken,
            };

            const regenerateResponse = await adminApi.regenerateInvoice(payload);
            if (!regenerateResponse.success) {
                const message = typeof regenerateResponse.message === 'string'
                    ? regenerateResponse.message
                    : 'Failed to regenerate invoice';
                if (resolveBlacklistOtpPrompt(regenerateResponse.data || regenerateResponse, message, {
                    retryKind: 'regenerate',
                    action: 'edit_claim_invoice',
                    vehicleNumber,
                    invoiceId: editingInvoice.id,
                })) {
                    return;
                }
                throw new Error(message);
            }

            setPdfRefreshKeys((prev) => ({ ...prev, [editingInvoice.id]: Date.now() }));
            toast.success("Invoice updated & PDF regenerated");
            await refreshInvoiceAfterRegenerate(editingInvoice.id);
            closeModal();
        } catch (error: any) {
            console.error("Regenerate error:", error);
            toast.error(error?.message || "Failed to regenerate invoice");
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleRegenerate = async () => {
        await executeRegenerate();
    };

    const closeModal = () => {
        setIsEditing(false);
        setEditingInvoice(null);
        setEditInsuredUserId('');
        setEditOtherPartyUserId('');
        setEditInvoiceKind('commission');
        setInvoiceDateInputType('text');
        setFormData({});
        setWeightmentSlip(null);
        closeCropper();
    };

    const isBuyerInsuredInvoice = (inv: Invoice) => {
        if (inv.invoiceType) {
            return inv.invoiceType === 'BUYER_INVOICE';
        }
        const note = (inv.weighmentSlipNote || '').toLowerCase().trim();
        return (
            note.includes('cash') ||
            note.includes('nak') ||
            note.includes('nag')
        );
    };

    const getCanonicalPartyNames = (inv: Invoice) => {
        if (inv.insuredPersonDisplayName || inv.otherPartyDisplayName) {
            return {
                insured: inv.insuredPersonDisplayName || '',
                other: inv.otherPartyDisplayName || '',
            };
        }

        const isBuyerInsured = isBuyerInsuredInvoice(inv);
        return {
            insured: isBuyerInsured ? (inv.billToName || '') : (inv.supplierName || ''),
            other: isBuyerInsured ? (inv.supplierName || '') : (inv.billToName || ''),
        };
    };

    const getInsuredPersonName = (inv: Invoice) => getCanonicalPartyNames(inv).insured;

    const getOtherPartyName = (inv: Invoice) => getCanonicalPartyNames(inv).other;

    const getPaymentStatusLabelAndClasses = (inv: Invoice) => {
        const raw = inv.paymentStatus || '';
        const s = raw.toUpperCase();

        if (inv.isRejected) {
            return { label: 'NOT_REQUIRED', classes: 'border-slate-200 bg-slate-50 text-slate-700' };
        }

        if (s === 'PAID') {
            return { label: 'PAID', classes: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
        }
        if (s === 'PARTIAL') {
            return { label: 'PARTIAL', classes: 'border-orange-200 bg-orange-50 text-orange-700' };
        }
        if (s === 'FAILED') {
            return { label: 'FAILED', classes: 'border-rose-200 bg-rose-50 text-rose-700' };
        }
        if (s === 'REFUNDED') {
            return { label: 'REFUNDED', classes: 'border-slate-200 bg-slate-50 text-slate-700' };
        }
        if (s === 'PENDING') {
            return { label: 'PENDING', classes: 'border-red-200 bg-red-50 text-red-700' };
        }
        if (s === 'NOT_REQUIRED' || inv.isPaymentRequired === false) {
            return { label: 'NOT_REQUIRED', classes: 'border-slate-200 bg-slate-50 text-slate-700' };
        }

        return { label: raw || 'PENDING', classes: 'border-red-200 bg-red-50 text-red-700' };
    };

    const handleSendPaymentLink = (inv: Invoice) => {
        if (inv.isRejected) {
            toast.error('Rejected invoice cannot send payment link');
            return;
        }

        if (!inv.isVerified) {
            setModalInvoice(inv);
            setModalType('info');
            setModalTitle('Verify required');
            setModalMessage('Please verify the invoice before sending the payment link.');
            setModalPrimaryLabel('Verify invoice');
            setModalSecondaryLabel('Close');
            setModalOpen(true);
            return;
        }

        openSendPhoneModal(inv, 'payment_link');
    };

    const handleSendInvoiceCreatedMessage = (inv: Invoice) => {
        if (inv.isRejected) {
            toast.error('Rejected invoice cannot send this message');
            return;
        }

        openSendPhoneModal(inv, 'invoice_created_template');
    };

    const submitSendPaymentLink = async () => {
        if (sendingPaymentInvoiceId || !sendPhoneInvoice) return;

        const invoiceId = getInvoiceId(sendPhoneInvoice);
        if (!invoiceId) {
            toast.error('Invoice ID missing. Please refresh and try again.');
            return;
        }

        const phoneNumber = normalizePhoneInput(sendPhoneDraft);
        if (!phoneNumber) {
            toast.error('Enter a phone number to send the invoice.');
            return;
        }

        if (!isValidIndianPhone(phoneNumber)) {
            toast.error('Enter a valid Indian mobile number.');
            return;
        }

        try {
            setSendingPaymentInvoiceId(invoiceId);
            toast.loading(
                sendPhoneMode === 'payment_link'
                    ? 'Sending payment link...'
                    : 'Sending invoice message...',
                { toastId: 'send-phone-action' },
            );

            const res = sendPhoneMode === 'payment_link'
                ? await adminApi.verifyAndSendPaymentForInvoice(invoiceId, {
                    phoneNumber,
                })
                : await adminApi.sendInvoiceCreatedTemplate(invoiceId, {
                    phoneNumber,
                });
            if (!res.success) {
                throw new Error(
                    res.message ||
                    (sendPhoneMode === 'payment_link'
                        ? 'Failed to send payment link'
                        : 'Failed to send invoice message'),
                );
            }

            setInvoices((prev) =>
                prev.map((invoice) =>
                    getInvoiceId(invoice) === invoiceId
                        ? { ...invoice, insuredPartyPhone: phoneNumber }
                        : invoice,
                ),
            );

            toast.update('send-phone-action', {
                render:
                    sendPhoneMode === 'payment_link'
                        ? 'Payment link sent successfully'
                        : 'Invoice message sent successfully',
                type: 'success',
                isLoading: false,
                autoClose: 2000,
            });

            closeSendPhoneModal();
            await fetchInvoices();
        } catch (error: any) {
            toast.update('send-phone-action', {
                render:
                    error?.message ||
                    (sendPhoneMode === 'payment_link'
                        ? 'Failed to send payment link'
                        : 'Failed to send invoice message'),
                type: 'error',
                isLoading: false,
                autoClose: 3000,
            });
        } finally {
            setSendingPaymentInvoiceId(null);
        }
    };

    const getPaymentLinkSentLabel = (inv: Invoice) => {
        const count = typeof inv.paymentLinkSentCount === 'number' ? inv.paymentLinkSentCount : null;
        const hasAt = Boolean(inv.paymentLinkSentAt);
        const hasSent = hasAt || (count !== null && count > 0);

        if (!hasSent) return null;

        if (count !== null && count > 1) return `Sent (${count})`;
        return 'Sent';
    };

    const updateInvoiceMenuPlacement = (invoiceId: string, el: HTMLElement | null) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const menuApproxHeight = 240;
        const spaceBelow = viewportHeight - rect.bottom;
        const placement: 'up' | 'down' = spaceBelow < menuApproxHeight ? 'up' : 'down';

        setInvoiceMenuPlacement((prev) => (prev[invoiceId] === placement ? prev : { ...prev, [invoiceId]: placement }));
    };

    const totalPages = serverTotalPages;
    const paginatedInvoices = invoices;

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (
            desktopCreationAccess.ready &&
            !canCreateOnThisDevice &&
            createInvoiceOpen &&
            !createInvoiceSubmitting
        ) {
            setCreateInvoiceOpen(false);
            setCreateInvoiceBlockedNoticeOpen(true);
        }
    }, [
        canCreateOnThisDevice,
        createInvoiceOpen,
        createInvoiceSubmitting,
        desktopCreationAccess.ready,
    ]);

    return (
        <div className="min-h-screen bg-gray-50 py-4 sm:py-6">
            {createInvoiceBlockedNoticeOpen && (
                <DesktopRequiredNotice
                    variant="dialog"
                    onDismiss={() => setCreateInvoiceBlockedNoticeOpen(false)}
                />
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-[2100] flex items-center justify-center p-3 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={closeActionModal}
                    />
                    <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-slate-900 truncate">{modalTitle}</h3>
                                {modalMessage && (
                                    <p className="mt-1 text-sm text-slate-600">{modalMessage}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={closeActionModal}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            {modalType === 'reject' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Reason (optional)</label>
                                    <textarea
                                        value={rejectReasonDraft}
                                        onChange={(e) => setRejectReasonDraft(e.target.value)}
                                        rows={3}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/20"
                                        placeholder="Add a rejection reason..."
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                            <button
                                type="button"
                                onClick={closeActionModal}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                {modalSecondaryLabel || 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={handleModalPrimary}
                                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                                    modalType === 'reject'
                                        ? 'bg-rose-600 hover:bg-rose-700'
                                        : 'bg-[#4309ac] hover:bg-[#2f0679]'
                                }`}
                            >
                                {modalPrimaryLabel || 'Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {sendPhoneModalOpen && sendPhoneInvoice && (
                <div className="fixed inset-0 z-[2125] flex items-center justify-center p-3 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={closeSendPhoneModal}
                    />
                    <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-slate-900">
                                    {sendPhoneMode === 'payment_link'
                                        ? 'Send Payment Link'
                                        : 'Send Invoice Message'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    {sendPhoneMode === 'payment_link'
                                        ? `Enter the WhatsApp number for invoice ${sendPhoneInvoice.invoiceNumber}.`
                                        : `Enter the WhatsApp number to send the invoice-created template for ${sendPhoneInvoice.invoiceNumber}.`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSendPhoneModal}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-800">Phone number</label>
                                <input
                                    type="tel"
                                    value={sendPhoneDraft}
                                    onChange={(e) => setSendPhoneDraft(normalizePhoneInput(e.target.value))}
                                    placeholder="9876543210 or 919876543210"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/20"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                {sendPhoneMode === 'payment_link'
                                    ? 'This sends the existing Meta template message and payment link to the number you enter.'
                                    : 'This sends the invoice-created tracking template using the latest invoice details and the number you enter.'}
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                            <button
                                type="button"
                                onClick={closeSendPhoneModal}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitSendPaymentLink}
                                disabled={sendingPaymentInvoiceId === getInvoiceId(sendPhoneInvoice)}
                                className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1fa955] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {sendingPaymentInvoiceId === getInvoiceId(sendPhoneInvoice)
                                    ? 'Sending...'
                                    : sendPhoneMode === 'payment_link'
                                        ? 'Send'
                                        : 'Resend'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <div className="fixed inset-0 z-[2150] flex items-center justify-center p-3 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowExportModal(false)}
                    />
                    <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-slate-900">Select Export Columns</h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    Choose the invoice columns you want in the Excel export.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            <div className="mb-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedExportColumns(EXPORTABLE_INVOICE_COLUMNS.map((column) => column.key))}
                                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Select all
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedExportColumns([])}
                                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Clear all
                                </button>
                                <span className="self-center text-sm text-slate-500">
                                    {selectedExportColumns.length} columns selected
                                </span>
                            </div>

                            <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
                                {EXPORTABLE_INVOICE_COLUMNS.map((column) => (
                                    <label
                                        key={column.key}
                                        className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedExportColumns.includes(column.key)}
                                            onChange={() => toggleExportColumn(column.key)}
                                            className="h-4 w-4 rounded border-slate-300 text-[#4309ac] focus:ring-[#4309ac]"
                                        />
                                        <span>{column.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={exporting}
                                className="rounded-xl bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2f0679] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {exporting ? 'Exporting...' : 'Export Selected Columns'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {createInvoiceOpen && (
                <div className="fixed inset-0 z-[2160] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
                    <div className="relative flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-slate-50 shadow-2xl">
                        {createInvoiceParsing && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
                                <p className="mt-3 text-sm font-semibold text-slate-800">Extracting document details with Gemini OCR...</p>
                            </div>
                        )}
                        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-4 py-3">
                            <div className="absolute right-6 top-4 h-16 w-16 rounded-full bg-emerald-200/35 blur-2xl" />
                            <div className="relative flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-200">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-950">Create Invoice</h3>
                                        <p className="mt-0.5 text-sm text-slate-600">Choose invoice type first, upload documents, then review and create.</p>
                                    </div>
                                </div>
                                <button onClick={closeCreateInvoiceModal} disabled={createInvoiceSubmitting} className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-hidden px-4 py-3">
                            <div className="grid gap-3 lg:grid-cols-[0.9fr_1.4fr]">
                                <div className="space-y-3">
                                    <div className={createInvoicePanelClass}>
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle className="h-4 w-4 text-emerald-600" />Invoice type</h4>
                                        <label className={`mt-2 ${createInvoiceLabelClass}`}>
                                            Select before upload
                                            <select
                                                value={createInvoiceForm.invoiceKind}
                                                disabled={createInvoiceParsing}
                                                onChange={(e) => {
                                                    const invoiceKind = e.target.value as AdminInvoiceKind;
                                                    setCreateInvoiceForm((prev) => applyCreateInvoiceParties(selectedInsuredUser, selectedOtherPartyUser, invoiceKind, prev));
                                                }}
                                                className={createInvoiceFieldClass}
                                            >
                                                <option value="cash">Cash</option>
                                                <option value="commission">Commission</option>
                                            </select>
                                        </label>
                                    </div>

                                    <div className={createInvoicePanelClass}>
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Upload className="h-4 w-4 text-sky-600" />Documents</h4>
                                        <label className="mt-2 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={skipCreateInvoiceOcr}
                                                onChange={(e) => setSkipCreateInvoiceOcr(e.target.checked)}
                                                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>
                                                <span className="block font-medium text-slate-900">Do not use OCR</span>
                                                <span className="block text-xs text-slate-500">Uploaded files will be attached, but fields must be filled manually.</span>
                                            </span>
                                        </label>
                                        <label className={`mt-2 ${createInvoiceLabelClass}`}>
                                            Weighment slip
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                multiple
                                                disabled={createInvoiceParsing}
                                                onChange={(e) => handleCreateInvoiceDocumentChange(Array.from(e.target.files || []), createPurchaseBillFile)}
                                                className={createInvoiceFileFieldClass}
                                            />
                                        </label>
                                        <label className={`mt-2 ${createInvoiceLabelClass}`}>
                                            Purchase bill / previous invoice
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                disabled={createInvoiceParsing}
                                                onChange={(e) => handleCreateInvoiceDocumentChange(createWeighmentFiles, e.target.files?.[0] || null)}
                                                className={createInvoiceFileFieldClass}
                                            />
                                        </label>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {skipCreateInvoiceOcr
                                                ? 'OCR is skipped until you manually uncheck this option.'
                                                : createInvoiceParsing
                                                    ? 'Reading document text with Gemini OCR...'
                                                    : documentExtractText
                                                        ? 'Text extracted. Review fields.'
                                                        : 'Upload screenshots, images, or PDFs for OCR.'}
                                        </p>
                                    </div>

                                    <div className={createInvoicePanelClass}>
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><LinkIcon className="h-4 w-4 text-indigo-600" />Parties</h4>
                                        <label className={`mt-2 ${createInvoiceLabelClass}`}>
                                            Insured party name
                                            <select
                                                value={createInvoiceForm.insuredUserId}
                                                disabled={createInvoiceParsing}
                                                onChange={(e) => {
                                                    const insuredUser = verifiedUsers.find((user) => user.id === e.target.value) || null;
                                                    setCreateInvoiceForm((prev) => applyCreateInvoiceParties(insuredUser, selectedOtherPartyUser, prev.invoiceKind, { ...prev, insuredUserId: e.target.value }));
                                                }}
                                                className={createInvoiceFieldClass}
                                            >
                                                <option value="">Select registered verified user</option>
                                                {verifiedUsers.map((user) => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.name} - {user.mobileNumber} {user.walletType === 'UNPAID' ? '(Unpaid)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="mt-2">
                                            <PartyCombobox
                                                label="Select other party"
                                                options={otherPartyComboboxOptions}
                                                value={createInvoiceForm.invoiceKind === 'cash' ? createInvoiceForm.supplierName : createInvoiceForm.billToName}
                                                onChange={handleOtherPartyComboboxChange}
                                                disabled={createInvoiceParsing}
                                                loading={otherPartyHistoricalLoading}
                                                placeholder={createInvoiceForm.insuredUserId ? 'Search or type party name...' : 'Select insured party first'}
                                                emptyMessage={createInvoiceForm.insuredUserId ? 'No historical parties found — type a name above' : 'Select insured party first'}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Pencil className="h-4 w-4 text-emerald-600" />Invoice details</h4>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{createInvoiceForm.invoiceKind === 'cash' ? 'Cash invoice' : 'Commission invoice'}</span>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                    <label className={createInvoiceLabelClass}>Invoice date<input disabled={createInvoiceParsing} type="date" value={createInvoiceForm.invoiceDate} onChange={(e) => updateCreateInvoiceForm({ invoiceDate: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    <label className={createInvoiceLabelClass}>
                                        Driver mobile (optional)
                                        <input
                                            disabled={createInvoiceParsing}
                                            inputMode="numeric"
                                            value={createInvoiceForm.driverPhone}
                                            onChange={(e) => updateCreateInvoiceForm({ driverPhone: e.target.value })}
                                            className={createInvoiceFieldClass}
                                        />
                                        <span className="mt-1 block text-xs text-slate-500">Leave blank to skip tracking automation for this invoice.</span>
                                    </label>
                                    <label className={createInvoiceLabelClass}>
                                        Alternate driver mobile (optional)
                                        <input
                                            disabled={createInvoiceParsing}
                                            inputMode="numeric"
                                            value={createInvoiceForm.driverSecondaryPhone}
                                            onChange={(e) => updateCreateInvoiceForm({ driverSecondaryPhone: e.target.value })}
                                            className={createInvoiceFieldClass}
                                        />
                                        <span className="mt-1 block text-xs text-slate-500">Optional backup number for tracking.</span>
                                    </label>
                                    <label className={createInvoiceLabelClass}>
                                        Insured party phone
                                        <input
                                            disabled={createInvoiceParsing}
                                            value={createInvoiceForm.insuredPartyPhone}
                                            onChange={(e) => updateCreateInvoiceForm({ insuredPartyPhone: e.target.value })}
                                            className={createInvoiceFieldClass}
                                        />
                                        <span className="mt-1 block text-xs text-slate-500">Invoice message will be sent to this number. You can edit it before creating.</span>
                                    </label>
                                    <div className="sm:col-span-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                                        Tracking route uses supplier address as source and buyer/ship-to address as destination.
                                    </div>
                                    <label className={createInvoiceLabelClass}>Supplier name<input disabled={createInvoiceParsing} value={createInvoiceForm.supplierName} onChange={(e) => updateCreateInvoiceForm({ supplierName: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    <label className={createInvoiceLabelClass}>Place of supply<input disabled={createInvoiceParsing} value={createInvoiceForm.placeOfSupply} onChange={(e) => updateCreateInvoiceForm({ placeOfSupply: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    <label className={`${createInvoiceLabelClass} sm:col-span-2`}>Supplier address<textarea disabled={createInvoiceParsing} value={createInvoiceForm.supplierAddress} onChange={(e) => updateCreateInvoiceForm({ supplierAddress: e.target.value })} rows={1} className={createInvoiceTextareaClass} /></label>
                                    <label className={createInvoiceLabelClass}>Bill to name<input disabled={createInvoiceParsing} value={createInvoiceForm.billToName} onChange={(e) => updateCreateInvoiceForm({ billToName: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    <label className={createInvoiceLabelClass}>Ship to name<input disabled={createInvoiceParsing} value={createInvoiceForm.shipToName} onChange={(e) => updateCreateInvoiceForm({ shipToName: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    <label className={createInvoiceLabelClass}>Bill to address<textarea disabled={createInvoiceParsing} value={createInvoiceForm.billToAddress} onChange={(e) => updateCreateInvoiceForm({ billToAddress: e.target.value })} rows={1} className={createInvoiceTextareaClass} /></label>
                                    <label className={createInvoiceLabelClass}>Ship to address<textarea disabled={createInvoiceParsing} value={createInvoiceForm.shipToAddress} onChange={(e) => updateCreateInvoiceForm({ shipToAddress: e.target.value })} rows={1} className={createInvoiceTextareaClass} /></label>
                                    <label className={createInvoiceLabelClass}>
                                        Product
                                        <select
                                            disabled={createInvoiceParsing}
                                            value={createInvoiceForm.productName}
                                            onChange={(e) => updateCreateInvoiceProduct(e.target.value)}
                                            className={createInvoiceFieldClass}
                                        >
                                            <option value="">Select product</option>
                                            {itemsData.map((item) => (
                                                <option key={item.name} value={item.name}>{item.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className={createInvoiceLabelClass}>HSN<input disabled={createInvoiceParsing} value={createInvoiceForm.hsnCode} onChange={(e) => updateCreateInvoiceForm({ hsnCode: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    <label className={createInvoiceLabelClass}>Quantity<input disabled={createInvoiceParsing} type="number" step="0.01" value={createInvoiceForm.quantity} onChange={(e) => updateCreateInvoiceForm({ quantity: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    <label className={createInvoiceLabelClass}>Rate<input disabled={createInvoiceParsing} type="number" step="0.01" value={createInvoiceForm.rate} onChange={(e) => updateCreateInvoiceForm({ rate: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    <label className={createInvoiceLabelClass}>Vehicle number<input disabled={createInvoiceParsing} value={createInvoiceForm.vehicleNumber} onChange={(e) => updateCreateInvoiceForm({ vehicleNumber: e.target.value })} onBlur={(e) => validateCreateInvoiceVehicle(e.target.value)} className={createInvoiceFieldClass} /></label>
                                    <label className={createInvoiceLabelClass}>Owner name<input disabled={createInvoiceParsing} value={createInvoiceForm.ownerName} onChange={(e) => updateCreateInvoiceForm({ ownerName: e.target.value })} className={createInvoiceFieldClass} /></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1.5">
                                <p className="text-xs font-medium uppercase text-emerald-700">Amount</p>
                                <p className="text-base font-semibold text-slate-950">{formatCurrency((Number(createInvoiceForm.quantity) || 0) * (Number(createInvoiceForm.rate) || 0))}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={closeCreateInvoiceModal} disabled={createInvoiceSubmitting} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cancel</button>
                                <button onClick={handleCreateInvoiceSubmit} disabled={createInvoiceSubmitting || createInvoiceParsing} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60">
                                    {createInvoiceSubmitting ? 'Creating...' : 'Create & Send'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-none px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10">
                {/* Header - Responsive */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                            {appQueueMode ? 'App Invoices' : 'Invoices / Insurance Forms'}
                        </h1>
                        {appQueueMode ? (
                            <p className="mt-1 text-sm text-slate-500">
                                Review invoices submitted from the mobile app, edit details, regenerate PDFs, and send updates from the existing invoice flow.
                            </p>
                        ) : null}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        {!appQueueMode ? (
                            <button
                                onClick={openCreateInvoiceModal}
                                disabled={loading || !desktopCreationAccess.ready}
                                className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto ${
                                    desktopCreationAccess.ready && !canCreateOnThisDevice
                                        ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                        : 'bg-slate-800 text-white hover:bg-slate-900'
                                }`}
                            >
                                {desktopCreationAccess.ready && !canCreateOnThisDevice ? (
                                    <Monitor className="w-4 h-4" />
                                ) : (
                                    <FileText className="w-4 h-4" />
                                )}
                                {desktopCreationAccess.ready && !canCreateOnThisDevice
                                    ? 'Create Invoice · Desktop only'
                                    : 'Create Invoice'}
                            </button>
                        ) : null}
                        <button
                            onClick={openExportModal}
                            disabled={exporting || loading}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                        >
                            {exporting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <FileText className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export to Excel</span>
                                    <span className="sm:hidden">Export</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="bg-white text-black p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-10">
                        <select
                            name="invoiceType"
                            value={filters.invoiceType || ''}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        >
                            <option value="">All Invoices</option>
                            <option value="SUPPLIER_INVOICE">Supplier Invoice</option>
                            <option value="BUYER_INVOICE">Buyer Invoice</option>
                        </select>

                        <input
                            type="text"
                            name="invoiceNumber"
                            placeholder="Search Invoice #..."
                            value={filters.invoiceNumber || ''}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        />

                        <input
                            type="text"
                            name="vehicleNumber"
                            placeholder="Search Vehicle No..."
                            value={filters.vehicleNumber || ''}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        />

                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        />

                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        />

                        <input
                            type="text"
                            name="supplierName"
                            placeholder="Search Supplier..."
                            value={filters.supplierName}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        />

                        <input
                            type="text"
                            name="buyerName"
                            placeholder="Search Buyer..."
                            value={filters.buyerName}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        />

                        <select
                            name="productName"
                            value={filters.productName || ''}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        >
                            <option value="">All Products</option>
                            {productOptions.map((product) => (
                                <option key={product} value={product}>
                                    {product}
                                </option>
                            ))}
                        </select>

                        <select
                            name="verificationStatus"
                            value={filters.verificationStatus || ''}
                            onChange={handleFilterChange}
                            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                        >
                            <option value="">{appQueueMode ? 'All app statuses' : 'Status'}</option>
                            <option value="pending">Pending review</option>
                            {appQueueMode ? <option value="verified">Verified</option> : null}
                            <option value="rejected">Rejected</option>
                        </select>

                        {!appQueueMode ? (
                            <select
                                name="sourceSurface"
                                value={filters.sourceSurface || ''}
                                onChange={handleFilterChange}
                                className="border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500 w-full"
                            >
                                <option value="">All sources</option>
                                <option value="Admin">Admin</option>
                                <option value="App">App</option>
                                <option value="Web">Web</option>
                            </select>
                        ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs sm:text-sm text-slate-500">
                        <span>Showing {invoices.length} {appQueueMode ? 'app invoices' : 'invoices'}</span>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-4 p-3 sm:p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-md text-sm">
                        <p>{error}</p>
                    </div>
                )}

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-visible shadow ring-1 ring-black ring-opacity-5 rounded-lg bg-white pb-16">
                    {loading && invoices.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                        </div>
                    ) : (
                        <div className="relative isolate overflow-x-auto overflow-y-visible">
                            <table className="w-full min-w-[1400px] table-fixed divide-y divide-gray-200 border-separate border-spacing-0">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="sticky left-0 z-40 w-10 bg-slate-50 px-2 py-3 xl:px-2 xl:py-2 relative isolate"></th>
                                        <th className="sticky left-10 z-40 w-28 bg-slate-50 px-3 py-3 xl:px-2 xl:py-2 text-left text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider relative isolate">
                                            Invoice #
                                        </th>
                                        <th className="sticky left-[152px] z-40 w-24 bg-slate-50 px-3 py-3 xl:px-2 xl:py-2 text-left text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider relative isolate">
                                            Date
                                        </th>
                                        <th className="sticky left-[248px] z-40 w-32 bg-slate-50 px-3 py-3 xl:px-2 xl:py-2 text-left text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider relative isolate border-r border-slate-200">
                                            Insured Person
                                        </th>
                                        <th className="w-36 bg-slate-50 px-3 py-3 xl:px-2 xl:py-2 text-left text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider pl-6">
                                            Other Party
                                        </th>

                                        <th className="w-32 bg-slate-50 px-3 py-3 xl:px-2 xl:py-2 text-left text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider pl-4">Product</th>
                                        <th className="w-28 bg-slate-50 px-3 py-3 xl:px-2 xl:py-2 text-left text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider pl-4">Vehicle</th>
                                        <th className="w-20 bg-slate-50 px-2 py-3 xl:py-2 text-center text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Source</th>
                                        <th className="bg-slate-50 px-2 py-3 xl:py-2 text-center text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">PDF</th>
                                        <th className="bg-slate-50 px-2 py-3 xl:py-2 text-center text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Verify</th>
                                        <th className="bg-slate-50 px-2 py-3 xl:py-2 text-center text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Edit</th>
                                        <th className="bg-slate-50 px-2 py-3 xl:py-2 text-center text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Insurance</th>
                                        <th className="w-28 bg-slate-50 px-2 py-3 xl:py-2 text-center text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Premium Amount</th>
                                        <th className="w-28 bg-slate-50 px-2 py-3 xl:py-2 text-center text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Payment Status</th>
                                        <th className="w-36 bg-slate-50 px-2 py-3 xl:py-2 text-center text-xs xl:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Send Payment Link</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200">
                                    {paginatedInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={15} className="px-6 py-12 text-center text-sm text-gray-500">
                                                {loading ? 'Loading...' : 'No invoices found matching criteria.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedInvoices.map((inv) => (
                                            <Fragment key={inv.id}>
                                                <tr className={`transition-colors ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                                                    <td className={`sticky left-0 z-30 w-10 bg-white px-2 py-3 xl:px-2 xl:py-2 text-center align-top relative isolate ${expandedInvoiceId === inv.id ? 'bg-slate-50' : ''}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setExpandedInvoiceId((prev) => (prev === inv.id ? null : inv.id))
                                                            }
                                                            className={`inline-flex items-center justify-center w-6 h-6 transition-colors ${expandedInvoiceId === inv.id
                                                                ? 'text-[#4309ac]'
                                                                : 'text-gray-500 hover:text-gray-700'
                                                                }`}
                                                            title={expandedInvoiceId === inv.id ? 'Collapse' : 'Expand'}
                                                        >
                                                            <ChevronDown
                                                                className={`w-4 h-4 transition-transform ${expandedInvoiceId === inv.id ? 'rotate-180' : 'rotate-0'}`}
                                                            />
                                                        </button>
                                                    </td>
                                                    <td className={`sticky left-10 z-30 w-28 bg-white px-3 py-3 xl:px-2 xl:py-2 text-sm xl:text-[13px] font-semibold text-slate-900 align-top relative isolate ${expandedInvoiceId === inv.id ? 'bg-slate-50' : ''}`}>
                                                        <div className="whitespace-pre-line break-words leading-tight">
                                                            {String(inv.invoiceNumber || '').split('-').join('-\n')}
                                                        </div>
                                                    </td>
                                                    <td className={`sticky left-[152px] z-30 w-24 bg-white px-3 py-3 xl:px-2 xl:py-2 text-sm xl:text-[13px] text-slate-600 align-top relative isolate ${expandedInvoiceId === inv.id ? 'bg-slate-50' : ''}`}>
                                                        <div className="leading-tight">
                                                            <div>{new Date(inv.createdAt).toLocaleString('en-US', { month: 'short' })}</div>
                                                            <div>
                                                                {new Date(inv.createdAt).toLocaleString('en-US', { day: '2-digit' })},
                                                            </div>
                                                            <div>{new Date(inv.createdAt).toLocaleString('en-US', { year: 'numeric' })}</div>
                                                            <div className="mt-1">
                                                                {new Date(inv.createdAt).toLocaleString('en-US', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                    hour12: true,
                                                                    timeZone: 'Asia/Kolkata',
                                                                })}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className={`sticky left-[248px] z-30 w-32 bg-white px-3 py-3 xl:px-2 xl:py-2 text-sm xl:text-[13px] text-slate-700 align-top relative isolate border-r border-slate-200 ${expandedInvoiceId === inv.id ? 'bg-slate-50' : ''}`}>
                                                        <div className="whitespace-normal break-words leading-snug">{getInsuredPersonName(inv)}</div>
                                                    </td>
                                                    <td className={`w-36 px-3 py-3 xl:px-2 xl:py-2 text-sm xl:text-[13px] text-slate-700 align-top pl-6 ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <div className="whitespace-normal break-words leading-snug">{getOtherPartyName(inv)}</div>
                                                    </td>

                                                    <td className={`w-32 px-3 py-3 xl:px-2 xl:py-2 text-sm xl:text-[13px] text-slate-700 align-top pl-4 ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <div className="whitespace-normal break-words leading-snug">{Array.isArray(inv.productName) ? inv.productName[0] : inv.productName}</div>
                                                    </td>
                                                    <td className={`w-28 px-3 py-3 xl:px-2 xl:py-2 text-sm xl:text-[13px] text-slate-700 align-top pl-4 ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <div className="break-words leading-snug">{inv.vehicleNumber || '-'}</div>
                                                    </td>
                                                    <td className={`w-20 px-2 py-3 xl:py-2 text-center align-top ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                            {insuranceOriginLabel(inv.sourceSurface)}
                                                        </span>
                                                    </td>
                                                    <td className={`px-2 py-3 xl:py-2 text-center align-top ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        {(inv.pdfUrl || inv.pdfURL) ? (
                                                            <button
                                                                onClick={() => handleViewPdf(inv)}
                                                                className="inline-flex items-center justify-center w-9 h-9 text-[#4309ac] hover:bg-[#4309ac]/10 rounded-lg border border-[#4309ac]/20"
                                                                title="View Invoice PDF"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs">Pending</span>
                                                        )}
                                                    </td>
                                                    <td className={`px-2 py-3 xl:py-2 text-center align-top ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        {inv.isRejected ? (
                                                            <span
                                                                className="inline-flex items-center justify-center w-8 h-8 text-rose-600"
                                                                title={inv.rejectionReason ? `Rejected: ${inv.rejectionReason}` : 'Rejected'}
                                                                aria-label="Rejected"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </span>
                                                        ) : inv.isVerified ? (
                                                            <span
                                                                className="inline-flex items-center justify-center w-8 h-8 text-emerald-600"
                                                                title="Verified"
                                                                aria-label="Verified"
                                                            >
                                                                <CheckIcon className="w-4 h-4" />
                                                            </span>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => requestVerify(inv)}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    title="Verify Invoice"
                                                                    aria-label="Verify Invoice"
                                                                    disabled={verifyingInvoiceId === inv.id}
                                                                >
                                                                    <CheckIcon className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => requestReject(inv)}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    title="Reject Invoice"
                                                                    aria-label="Reject Invoice"
                                                                    disabled={rejectingInvoiceId === inv.id}
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`px-2 py-3 xl:py-2 text-center align-top ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <button
                                                            onClick={() => handleEditClick(inv)}
                                                            className="inline-flex items-center justify-center w-9 h-9 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200"
                                                            title="Edit Invoice"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                    <td className={`px-2 py-3 xl:py-2 align-top ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <div className="flex flex-col items-center gap-2">
                                                            {getInsuranceFileUrl(inv) ? (
                                                                <div className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                                                    <CheckCircle className="w-3 h-3" />
                                                                    <span>Uploaded</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    <span>Pending</span>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-2">
                                                                {getInsuranceFileUrl(inv) && (
                                                                    <button
                                                                        onClick={() => window.open(toFullFileUrl(getInsuranceFileUrl(inv)), '_blank')}
                                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200"
                                                                        title="View Insurance"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>
                                                                )}

                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedInvoiceForInsurance(inv);
                                                                        setShowInsuranceModal(true);
                                                                    }}
                                                                    className={`p-2 rounded-lg transition-colors group relative border ${getInsuranceFileUrl(inv)
                                                                        ? 'text-orange-600 hover:bg-orange-50 border-orange-200'
                                                                        : 'text-blue-600 hover:bg-blue-50 border-blue-200'
                                                                        }`}
                                                                    title={getInsuranceFileUrl(inv) ? 'Replace Insurance' : 'Upload Insurance'}
                                                                >
                                                                    {getInsuranceFileUrl(inv) ? (
                                                                        <RefreshCw className="w-4 h-4" />
                                                                    ) : (
                                                                        <Upload className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                            </div>

                                                            {inv.insurance?.uploadedAt && (
                                                                <span className="text-xs text-gray-500">
                                                                    {new Date(inv.insurance.uploadedAt).toLocaleDateString('en-IN', {
                                                                        day: '2-digit',
                                                                        month: 'short'
                                                                    })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={`px-2 py-3 xl:py-2 text-center align-top ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <span className="text-sm xl:text-[13px] font-semibold text-slate-900">
                                                            {Number.isFinite(Number(inv.premiumAmount))
                                                                ? formatCurrency(Number(inv.premiumAmount))
                                                                : formatCurrency(0)}
                                                        </span>
                                                    </td>
                                                    <td className={`px-2 py-3 xl:py-2 text-center align-top ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        {(() => {
                                                            const s = getPaymentStatusLabelAndClasses(inv);
                                                            return (
                                                                <span className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${s.classes}`}>
                                                                    {s.label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className={`px-2 py-3 xl:py-2 text-center align-top ${expandedInvoiceId === inv.id ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <div className="flex items-center justify-center gap-2">
                                                            {getPaymentLinkSentLabel(inv) ? (
                                                                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                                                    {getPaymentLinkSentLabel(inv)}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSendPaymentLink(inv)}
                                                                    disabled={sendingPaymentInvoiceId === inv.id || inv.isRejected}
                                                                    className="inline-flex items-center justify-center w-10 h-10 text-[#25D366] hover:bg-[#25D366]/10 rounded-lg border border-[#25D366]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    title="Send Payment Link"
                                                                >
                                                                    <svg viewBox="0 0 448 512" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                                                                        <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                                                                    </svg>
                                                                </button>
                                                            )}

                                                            <Menu as="div" className="relative inline-block text-left">
                                                                <Menu.Button
                                                                    className="inline-flex items-center justify-center w-10 h-10 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    title="Actions"
                                                                    onClick={(e) => updateInvoiceMenuPlacement(inv.id, e.currentTarget)}
                                                                    disabled={
                                                                        verifyingInvoiceId === inv.id ||
                                                                        rejectingInvoiceId === inv.id ||
                                                                        sendingPaymentInvoiceId === inv.id
                                                                    }
                                                                >
                                                                    <MoreVertical className="w-4 h-4" />
                                                                </Menu.Button>

                                                                <Transition
                                                                    as={Fragment}
                                                                    enter="transition ease-out duration-100"
                                                                    enterFrom="transform opacity-0 scale-95"
                                                                    enterTo="transform opacity-100 scale-100"
                                                                    leave="transition ease-in duration-75"
                                                                    leaveFrom="transform opacity-100 scale-100"
                                                                    leaveTo="transform opacity-0 scale-95"
                                                                >
                                                                    <Menu.Items
                                                                        className={`absolute right-0 z-50 w-56 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none ${
                                                                            invoiceMenuPlacement[inv.id] === 'up'
                                                                                ? 'bottom-full mb-2 origin-bottom-right'
                                                                                : 'top-full mt-2 origin-top-right'
                                                                        }`}
                                                                    >
                                                                        {!inv.isRejected && !inv.isVerified && (
                                                                            <>
                                                                                <Menu.Item>
                                                                                    {({ active }) => (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => requestVerify(inv)}
                                                                                            className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                                        >
                                                                                            <CheckIcon className="w-4 h-4 text-emerald-600" />
                                                                                            Verify
                                                                                        </button>
                                                                                    )}
                                                                                </Menu.Item>
                                                                                <Menu.Item>
                                                                                    {({ active }) => (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => requestReject(inv)}
                                                                                            className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                                        >
                                                                                            <XCircle className="w-4 h-4 text-rose-600" />
                                                                                            Reject
                                                                                        </button>
                                                                                    )}
                                                                                </Menu.Item>
                                                                            </>
                                                                        )}

                                                                        {!inv.isRejected && inv.isVerified && (
                                                                            <Menu.Item>
                                                                                {({ active }) => (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => requestReject(inv)}
                                                                                        className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                                    >
                                                                                        <XCircle className="w-4 h-4 text-rose-600" />
                                                                                        Reject
                                                                                    </button>
                                                                                )}
                                                                            </Menu.Item>
                                                                        )}

                                                                        {inv.isRejected && (
                                                                            <Menu.Item>
                                                                                {({ active }) => (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => requestVerify(inv)}
                                                                                        className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                                    >
                                                                                        <RotateCcw className="w-4 h-4 text-emerald-600" />
                                                                                        Verify
                                                                                    </button>
                                                                                )}
                                                                            </Menu.Item>
                                                                        )}

                                                                        {!inv.isRejected && (
                                                                            <Menu.Item>
                                                                                {({ active }) => (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleSendPaymentLink(inv)}
                                                                                        className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                                    >
                                                                                        {getPaymentLinkSentLabel(inv) ? (
                                                                                            <RotateCcw className="w-4 h-4 text-[#25D366]" />
                                                                                        ) : (
                                                                                            <LinkIcon className="w-4 h-4 text-[#25D366]" />
                                                                                        )}
                                                                                        {getPaymentLinkSentLabel(inv) ? 'Resend payment link' : 'Send payment link'}
                                                                                    </button>
                                                                                )}
                                                                            </Menu.Item>
                                                                        )}
                                                                        {!inv.isRejected && (
                                                                            <Menu.Item>
                                                                                {({ active }) => (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleSendInvoiceCreatedMessage(inv)}
                                                                                        className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                                    >
                                                                                        <RotateCcw className="w-4 h-4 text-[#25D366]" />
                                                                                        Resend invoice message
                                                                                    </button>
                                                                                )}
                                                                            </Menu.Item>
                                                                        )}
                                                                        {getInsuranceFileUrl(inv) && (
                                                                            <Menu.Item>
                                                                                {({ active }) => (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => openSendPdfModal(inv)}
                                                                                        className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                                    >
                                                                                        <FileText className="w-4 h-4 text-blue-600" />
                                                                                        Send insurance PDF
                                                                                    </button>
                                                                                )}
                                                                            </Menu.Item>
                                                                        )}
                                                                    </Menu.Items>
                                                                </Transition>
                                                            </Menu>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {expandedInvoiceId === inv.id && (
                                                    <tr className="bg-slate-50/60">
                                                        <td colSpan={15} className="px-4 pb-4">
                                                            <div className="sticky left-0 z-10 mt-3 w-full max-w-[min(100%,calc(100vw-18rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                                                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-semibold text-slate-900">Details</p>
                                                                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                                                                            {inv.invoiceNumber}
                                                                        </p>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${inv.isVerified
                                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                            : 'border-slate-200 bg-white text-slate-700'
                                                                            }`}>
                                                                            {inv.isVerified ? (
                                                                                <CheckIcon className="h-3.5 w-3.5" />
                                                                            ) : (
                                                                                <AlertCircle className="h-3.5 w-3.5" />
                                                                            )}
                                                                            {inv.isVerified ? 'Verified' : 'Not Verified'}
                                                                        </span>
                                                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${getInsuranceFileUrl(inv)
                                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                            : 'border-amber-200 bg-amber-50 text-amber-700'
                                                                            }`}>
                                                                            {getInsuranceFileUrl(inv) ? (
                                                                                <CheckCircle className="h-3.5 w-3.5" />
                                                                            ) : (
                                                                                <AlertCircle className="h-3.5 w-3.5" />
                                                                            )}
                                                                            {getInsuranceFileUrl(inv) ? 'Insurance Uploaded' : 'Insurance Pending'}
                                                                        </span>
                                                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${(inv.pdfUrl || inv.pdfURL)
                                                                            ? 'border-[#4309ac]/20 bg-[#4309ac]/10 text-[#4309ac]'
                                                                            : 'border-slate-200 bg-slate-50 text-slate-700'
                                                                            }`}>
                                                                            <FileText className="h-3.5 w-3.5" />
                                                                            {(inv.pdfUrl || inv.pdfURL) ? 'PDF Ready' : 'PDF Pending'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="p-4">
                                                                <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
                                                                    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-2 lg:flex-[0.7_1_0%] lg:self-stretch flex-1">
                                                                        <p className="text-sm font-semibold text-slate-900">Applicant Details</p>
                                                                        <dl className="mt-3 space-y-2">
                                                                            <div className="flex items-start justify-between gap-3">
                                                                                <dt className="text-xs font-semibold text-slate-500">Place of Supply</dt>
                                                                                <dd className="text-sm text-slate-900 text-right break-words">{inv.placeOfSupply || '-'}</dd>
                                                                            </div>

                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <dt className="text-xs font-semibold text-slate-500">Supplier Address</dt>
                                                                                    <dd className="text-sm text-slate-900 text-right break-words">
                                                                                        {Array.isArray(inv.supplierAddress) && inv.supplierAddress.length > 0
                                                                                            ? inv.supplierAddress.join(', ')
                                                                                            : '-'}
                                                                                    </dd>
                                                                                </div>
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <dt className="text-xs font-semibold text-slate-500">Bill To Address</dt>
                                                                                    <dd className="text-sm text-slate-900 text-right break-words">
                                                                                        {Array.isArray(inv.billToAddress) && inv.billToAddress.length > 0
                                                                                            ? inv.billToAddress.join(', ')
                                                                                            : '-'}
                                                                                    </dd>
                                                                                </div>
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <dt className="text-xs font-semibold text-slate-500">Ship To Name</dt>
                                                                                    <dd className="text-sm text-slate-900 text-right break-words">{inv.shipToName || '-'}</dd>
                                                                                </div>
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <dt className="text-xs font-semibold text-slate-500">Ship To Address</dt>
                                                                                    <dd className="text-sm text-slate-900 text-right break-words">
                                                                                        {Array.isArray(inv.shipToAddress) && inv.shipToAddress.length > 0
                                                                                            ? inv.shipToAddress.join(', ')
                                                                                            : '-'}
                                                                                    </dd>
                                                                                </div>
                                                                            </dl>
                                                                    </div>

                                                                    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-2 lg:flex-[1_1_0%] lg:self-stretch flex-1">
                                                                        <p className="text-sm font-semibold text-slate-900">Invoice Details</p>
                                                                        <dl className="mt-3 space-y-2">
                                                                            <div className="flex items-start justify-between gap-3">
                                                                                <dt className="text-xs font-semibold text-slate-500">HSN</dt>
                                                                                <dd className="text-sm text-slate-900 text-right break-words">{inv.hsnCode || '-'}</dd>
                                                                            </div>

                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <dt className="text-xs font-semibold text-slate-500">Quantity</dt>
                                                                                    <dd className="text-sm text-slate-900 text-right break-words">{inv.quantity ?? '-'}</dd>
                                                                                </div>
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <dt className="text-xs font-semibold text-slate-500">Rate</dt>
                                                                                    <dd className="text-sm text-slate-900 text-right break-words">
                                                                                        {typeof inv.rate === 'number' ? formatCurrency(inv.rate) : '-'}
                                                                                    </dd>
                                                                                </div>
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <dt className="text-xs font-semibold text-slate-500">Amount</dt>
                                                                                    <dd className="text-sm font-semibold text-slate-900 text-right break-words">{formatCurrency(inv.amount)}</dd>
                                                                                </div>
                                                                        </dl>
                                                                    </div>

                                                                    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-2 lg:flex-[0.8_1_0%] lg:self-stretch flex-1">
                                                                        <p className="text-sm font-semibold text-slate-900">Documents</p>
                                                                        <div className="mt-3 space-y-3">
                                                                            <div className="flex items-center justify-between gap-3">
                                                                                <p className="text-xs font-semibold text-slate-500">Invoice PDF</p>
                                                                                {(inv.pdfUrl || inv.pdfURL) ? (
                                                                                    <button
                                                                                        onClick={() => handleViewPdf(inv)}
                                                                                        className="inline-flex items-center gap-2 rounded-lg border border-[#4309ac]/20 px-3 py-2 text-sm font-semibold text-[#4309ac] hover:bg-[#4309ac]/10"
                                                                                    >
                                                                                        <FileText className="w-4 h-4" />
                                                                                        View
                                                                                    </button>
                                                                                ) : (
                                                                                    <span className="text-sm text-slate-600">Pending</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center justify-between gap-3">
                                                                                <p className="text-xs font-semibold text-slate-500">Insurance</p>
                                                                                {getInsuranceFileUrl(inv) ? (
                                                                                    <button
                                                                                        onClick={() => window.open(toFullFileUrl(getInsuranceFileUrl(inv)), '_blank')}
                                                                                        className="inline-flex items-center gap-2 rounded-lg border border-[#4309ac]/20 px-3 py-2 text-sm font-semibold text-[#4309ac] hover:bg-[#4309ac]/10"
                                                                                    >
                                                                                        <Eye className="w-4 h-4" />
                                                                                        View
                                                                                    </button>
                                                                                ) : (
                                                                                    <span className="text-sm text-slate-600">Pending</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-start justify-between gap-3">
                                                                                <p className="text-xs font-semibold text-slate-500">Weighment Slip Note</p>
                                                                                <p className="text-sm text-slate-900 text-right break-words">{inv.weighmentSlipNote || '-'}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                )}
                                            </Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="lg:hidden space-y-3 sm:space-y-4">
                    {loading && invoices.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                        </div>
                    ) : paginatedInvoices.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                            {loading ? 'Loading...' : 'No invoices found matching criteria.'}
                        </div>
                    ) : (
                        paginatedInvoices.map((inv) => (
                            <div key={inv.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                {/* Card Header */}
                                <div className="bg-gray-50 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                                {inv.invoiceNumber}
                                            </h3>
                                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                                                {formatDateOnly(inv.createdAt)} {formatTimeOnly(inv.createdAt)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 sm:gap-2 ml-2">
                                            {(inv.pdfUrl || inv.pdfURL) && (
                                                <button
                                                    onClick={() => handleViewPdf(inv)}
                                                    className="p-1.5 sm:p-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200"
                                                    title="View PDF"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {getPaymentLinkSentLabel(inv) ? (
                                                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                                        {getPaymentLinkSentLabel(inv)}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendPaymentLink(inv)}
                                                        disabled={sendingPaymentInvoiceId === inv.id || inv.isRejected}
                                                        className="inline-flex items-center justify-center w-9 h-9 text-[#25D366] hover:bg-[#25D366]/10 rounded-lg border border-[#25D366]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Send Payment Link"
                                                    >
                                                        <svg viewBox="0 0 448 512" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                                                            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                                                        </svg>
                                                    </button>
                                                )}

                                                <Menu as="div" className="relative inline-block text-left">
                                                    <Menu.Button
                                                        className="inline-flex items-center justify-center w-9 h-9 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Actions"
                                                        onClick={(e) => updateInvoiceMenuPlacement(inv.id, e.currentTarget)}
                                                        disabled={sendingPaymentInvoiceId === inv.id}
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Menu.Button>

                                                    <Transition
                                                        as={Fragment}
                                                        enter="transition ease-out duration-100"
                                                        enterFrom="transform opacity-0 scale-95"
                                                        enterTo="transform opacity-100 scale-100"
                                                        leave="transition ease-in duration-75"
                                                        leaveFrom="transform opacity-100 scale-100"
                                                        leaveTo="transform opacity-0 scale-95"
                                                    >
                                                        <Menu.Items
                                                            className={`absolute right-0 z-50 w-56 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none ${
                                                                invoiceMenuPlacement[inv.id] === 'up'
                                                                    ? 'bottom-full mb-2 origin-bottom-right'
                                                                    : 'top-full mt-2 origin-top-right'
                                                            }`}
                                                        >
                                                            {!inv.isRejected && !inv.isVerified && (
                                                                <>
                                                                    <Menu.Item>
                                                                        {({ active }) => (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => requestVerify(inv)}
                                                                                className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                            >
                                                                                <CheckIcon className="w-4 h-4 text-emerald-600" />
                                                                                Verify
                                                                            </button>
                                                                        )}
                                                                    </Menu.Item>
                                                                    <Menu.Item>
                                                                        {({ active }) => (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => requestReject(inv)}
                                                                                className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                            >
                                                                                <XCircle className="w-4 h-4 text-rose-600" />
                                                                                Reject
                                                                            </button>
                                                                        )}
                                                                    </Menu.Item>
                                                                </>
                                                            )}

                                                            {!inv.isRejected && inv.isVerified && (
                                                                <Menu.Item>
                                                                    {({ active }) => (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => requestReject(inv)}
                                                                            className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                        >
                                                                            <XCircle className="w-4 h-4 text-rose-600" />
                                                                            Reject
                                                                        </button>
                                                                    )}
                                                                </Menu.Item>
                                                            )}

                                                            {inv.isRejected && (
                                                                <Menu.Item>
                                                                    {({ active }) => (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => requestVerify(inv)}
                                                                            className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                        >
                                                                            <RotateCcw className="w-4 h-4 text-emerald-600" />
                                                                            Verify
                                                                        </button>
                                                                    )}
                                                                </Menu.Item>
                                                            )}

                                                            {!inv.isRejected && (
                                                                <Menu.Item>
                                                                    {({ active }) => (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSendPaymentLink(inv)}
                                                                            className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                        >
                                                                            {getPaymentLinkSentLabel(inv) ? (
                                                                                <RotateCcw className="w-4 h-4 text-[#25D366]" />
                                                                            ) : (
                                                                                <LinkIcon className="w-4 h-4 text-[#25D366]" />
                                                                            )}
                                                                            {getPaymentLinkSentLabel(inv) ? 'Resend payment link' : 'Send payment link'}
                                                                        </button>
                                                                    )}
                                                                </Menu.Item>
                                                            )}
                                                            {!inv.isRejected && (
                                                                <Menu.Item>
                                                                    {({ active }) => (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSendInvoiceCreatedMessage(inv)}
                                                                            className={`${active ? 'bg-gray-100' : ''} flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700`}
                                                                        >
                                                                            <RotateCcw className="w-4 h-4 text-[#25D366]" />
                                                                            Resend invoice message
                                                                        </button>
                                                                    )}
                                                                </Menu.Item>
                                                            )}
                                                        </Menu.Items>
                                                    </Transition>
                                                </Menu>
                                            </div>

                                            <button
                                                onClick={() => handleEditClick(inv)}
                                                className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                                                title="Edit"
                                            >
                                                ✏️
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="px-3 sm:px-4 py-3 space-y-2.5 sm:space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Insured Person</p>
                                            <p className="text-sm font-medium text-gray-900 truncate">{getInsuredPersonName(inv)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Other Party</p>
                                            <p className="text-sm font-medium text-gray-900 truncate">{getOtherPartyName(inv)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Product</p>
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {Array.isArray(inv.productName) ? inv.productName[0] : inv.productName}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Vehicle</p>
                                            <p className="text-sm font-medium text-gray-900">{inv.vehicleNumber || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Source</p>
                                            <p className="text-sm font-medium text-gray-900">
                                                {insuranceOriginLabel(inv.sourceSurface)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Verification Status */}
                                    <div className="pt-2 border-t border-gray-100">
                                        {inv.isRejected ? (
                                            <div className="flex items-center gap-2 text-red-700">
                                                <XCircle className="w-4 h-4" />
                                                <span className="text-sm font-medium">Rejected</span>
                                            </div>
                                        ) : inv.isVerified ? (
                                            <div className="flex items-center gap-2 text-green-700">
                                                <CheckCircle className="w-4 h-4" />
                                                <span className="text-sm font-medium">Verified</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => requestVerify(inv)}
                                                    disabled={verifyingInvoiceId === inv.id}
                                                    className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Verify Invoice
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => requestReject(inv)}
                                                    disabled={rejectingInvoiceId === inv.id}
                                                    className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                    title="Reject Invoice"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Insurance Section */}
                                    <div className="pt-2 border-t border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs text-gray-500 font-medium">Insurance Status</p>
                                            {getInsuranceFileUrl(inv) ? (
                                                <div className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                                    <CheckCircle className="w-3 h-3" />
                                                    <span>Uploaded</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span>Pending</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            {getInsuranceFileUrl(inv) && (
                                                <button
                                                    onClick={() => window.open(toFullFileUrl(getInsuranceFileUrl(inv)), '_blank')}
                                                    className="flex-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200 text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    View
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setSelectedInvoiceForInsurance(inv);
                                                    setShowInsuranceModal(true);
                                                }}
                                                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${getInsuranceFileUrl(inv)
                                                    ? 'text-orange-600 hover:bg-orange-50 border-orange-200'
                                                    : 'text-blue-600 hover:bg-blue-50 border-blue-200'
                                                    }`}
                                            >
                                                {getInsuranceFileUrl(inv) ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4" />
                                                        Replace
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="w-4 h-4" />
                                                        Upload
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {inv.insurance?.uploadedAt && (
                                            <p className="text-xs text-gray-500 mt-1.5 text-center">
                                                Uploaded: {new Date(inv.insurance.uploadedAt).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination Controls - Responsive */}
                {totalPages > 1 && (
                    <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1 || loading}
                            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-700">
                            Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                            {serverTotal > 0 && <span className="text-gray-500 ml-2">({serverTotal} total)</span>}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || loading}
                            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Edit Invoice Modal - Responsive */}
            {isEditing && editingInvoice && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] p-3 sm:p-4">
                    <div className="relative bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] sm:max-h-[80vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center rounded-t-2xl sm:rounded-t-3xl z-10">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-800">Update Invoice</h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-500 hover:text-gray-700 p-1"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                            {/* Image Upload Section */}
                            <div className="border border-gray-300 rounded-xl p-3 sm:p-4">
                                <label className="block text-sm font-medium text-slate-800 mb-2">Upload Weighment Slip</label>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                <div className="flex flex-col gap-3">
                                    {weightmentSlip ? (
                                        <div className="text-green-700 text-sm bg-green-50 p-2 rounded">{weightmentSlip?.name ?? ''}</div>
                                    ) : (
                                        <div className="text-gray-500 text-sm text-center">No new slip selected</div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                                    >
                                        📸 {weightmentSlip ? 'Replace Photo' : 'Upload New Photo'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                                Invoice: <span className="font-semibold">{editingInvoice?.invoiceNumber ?? ''}</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Invoice kind</label>
                                    <select
                                        value={editInvoiceKind}
                                        onChange={(e) => {
                                            const invoiceKind = e.target.value as AdminInvoiceKind;
                                            const insuredUser =
                                                verifiedUsers.find((user) => user.id === editInsuredUserId) || null;
                                            const otherPartyUser =
                                                verifiedUsers.find((user) => user.id === editOtherPartyUserId) || null;
                                            setEditInvoiceKind(invoiceKind);
                                            setFormData((prev) =>
                                                applyEditInvoiceParties(
                                                    insuredUser,
                                                    otherPartyUser,
                                                    invoiceKind,
                                                    prev,
                                                ),
                                            );
                                        }}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                    >
                                        <option value="commission">Commission (supplier insured)</option>
                                        <option value="cash">Cash (buyer insured)</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-800 mb-1">
                                        Insured party (verified user)
                                    </label>
                                    <select
                                        value={editInsuredUserId}
                                        onChange={(e) => {
                                            const insuredUser =
                                                verifiedUsers.find((user) => user.id === e.target.value) || null;
                                            const otherPartyUser =
                                                verifiedUsers.find((user) => user.id === editOtherPartyUserId) || null;
                                            setEditInsuredUserId(e.target.value);
                                            setFormData((prev) =>
                                                applyEditInvoiceParties(
                                                    insuredUser,
                                                    otherPartyUser,
                                                    editInvoiceKind,
                                                    prev,
                                                ),
                                            );
                                        }}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                    >
                                        <option value="">Select registered verified user</option>
                                        {verifiedUsers.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.name} - {user.mobileNumber}{' '}
                                                {user.walletType === 'UNPAID' ? '(Unpaid)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Changing this remounts the invoice to that trader for exports and wallet ownership.
                                    </p>
                                </div>

                                <div className="sm:col-span-2">
                                    <PartyCombobox
                                        label="Other party"
                                        options={otherPartyComboboxOptions}
                                        value={
                                            editInvoiceKind === 'cash'
                                                ? String(formData.supplierName || '')
                                                : String(formData.billToName || '')
                                        }
                                        onChange={handleEditOtherPartyComboboxChange}
                                        loading={otherPartyHistoricalLoading}
                                        placeholder={
                                            editInsuredUserId
                                                ? 'Search or type party name...'
                                                : 'Select insured party first'
                                        }
                                        emptyMessage={
                                            editInsuredUserId
                                                ? 'No historical parties found — type a name above'
                                                : 'Select insured party first'
                                        }
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Supplier Name</label>
                                    <input
                                        type="text"
                                        value={formData.supplierName}
                                        onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Enter supplier name"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Supplier Address</label>
                                    <textarea
                                        value={Array.isArray(formData.supplierAddress) ? (formData.supplierAddress[0] ?? '') : (formData.supplierAddress ?? '')}
                                        onChange={(e) => setFormData({ ...formData, supplierAddress: [e.target.value] })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Enter supplier address"
                                        rows={2}
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Bill To Name</label>
                                    <input
                                        type="text"
                                        value={formData.billToName}
                                        onChange={(e) => setFormData({ ...formData, billToName: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Enter buyer name"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Bill To Address</label>
                                    <textarea
                                        value={Array.isArray(formData.billToAddress) ? (formData.billToAddress[0] ?? '') : (formData.billToAddress ?? '')}
                                        onChange={(e) => setFormData({ ...formData, billToAddress: [e.target.value] })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Enter buyer address"
                                        rows={2}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Ship To Name</label>
                                    <input
                                        type="text"
                                        value={formData.shipToName}
                                        onChange={(e) => setFormData({ ...formData, shipToName: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Ship to name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Place of Supply</label>
                                    <input
                                        type="text"
                                        value={formData.placeOfSupply}
                                        onChange={(e) => setFormData({ ...formData, placeOfSupply: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Place of supply"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Ship To Address</label>
                                    <textarea
                                        value={(Array.isArray(formData.shipToAddress) ? formData.shipToAddress[0] : formData.shipToAddress) ?? ''}
                                        onChange={(e) => setFormData({ ...formData, shipToAddress: [e.target.value] })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Shipping address"
                                        rows={2}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Product Name</label>
                                    <input
                                        type="text"
                                        value={formData.productName}
                                        onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Product name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">HSN Code</label>
                                    <input
                                        type="text"
                                        value={formData.hsnCode}
                                        onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="HSN code"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Rate (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.rate}
                                        onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Vehicle Number</label>
                                    <input
                                        type="text"
                                        value={formData.vehicleNumber}
                                        onChange={(e) => {
                                            const vehicleNumber = normalizeVehicleText(e.target.value);
                                            setFormData({
                                                ...formData,
                                                vehicleNumber,
                                                truckNumber: vehicleNumber,
                                            });
                                        }}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Vehicle number"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Truck Number</label>
                                    <input
                                        type="text"
                                        value={formData.truckNumber || formData.vehicleNumber || ''}
                                        readOnly
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-slate-500 text-sm"
                                        placeholder="Truck number"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Weighment Slip Note</label>
                                    <textarea
                                        value={formData.weighmentSlipNote}
                                        onChange={(e) => setFormData({ ...formData, weighmentSlipNote: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Additional notes"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Invoice Date</label>
                                    <input
                                        type={invoiceDateInputType}
                                        placeholder="DD-MM-YYYY"
                                        value={formData.invoiceDate}
                                        onFocus={() => setInvoiceDateInputType('date')}
                                        onBlur={() => {
                                            if (!formData.invoiceDate) setInvoiceDateInputType('text');
                                        }}
                                        onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">Terms</label>
                                    <input
                                        type="text"
                                        value={formData.terms}
                                        onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 bg-white text-sm"
                                        placeholder="Terms"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sticky bottom-0 bg-white rounded-b-2xl sm:rounded-b-3xl">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 text-sm sm:text-base"
                                disabled={isRegenerating}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRegenerate}
                                className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 bg-[#4309ac] text-white rounded-xl font-medium hover:bg-[#350889] disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                                disabled={isRegenerating}
                            >
                                {isRegenerating ? 'Updating...' : 'Update & Regenerate PDF'}
                            </button>
                        </div>

                        {isCropping && imageSrc && (
                            <div className="absolute inset-0 z-30 flex flex-col rounded-2xl sm:rounded-3xl bg-black/80 backdrop-blur-[1px]">
                                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white sm:px-6">
                                    <div>
                                        <p className="text-sm font-semibold">Crop Weighment Slip</p>
                                        <p className="text-xs text-white/70">Adjust the image before regenerating the invoice PDF.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeCropper}
                                        className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="relative min-h-[320px] flex-1 bg-black">
                                    <Cropper
                                        src={imageSrc}
                                        style={{ height: '100%', width: '100%' }}
                                        ref={cropperRef}
                                        guides={true}
                                        viewMode={1}
                                        dragMode="move"
                                        autoCropArea={1}
                                        checkOrientation={true}
                                        ready={() => {
                                            setIsCropperReady(true);
                                            setRotation(0);
                                        }}
                                    />
                                </div>

                                <div className="flex items-center justify-between border-t border-white/10 bg-black/90 px-4 py-3 sm:px-6">
                                    <div className="flex gap-3 text-white">
                                        <button
                                            type="button"
                                            onClick={() => rotateImage(-90)}
                                            className="rounded-full p-2 transition hover:bg-white/10"
                                            aria-label="Rotate left"
                                        >
                                            <ArrowPathIcon className="h-5 w-5 rotate-90 transform sm:h-6 sm:w-6" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => rotateImage(90)}
                                            className="rounded-full p-2 transition hover:bg-white/10"
                                            aria-label="Rotate right"
                                        >
                                            <ArrowPathIcon className="h-5 w-5 -scale-x-100 rotate-90 transform sm:h-6 sm:w-6" />
                                        </button>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={closeCropper}
                                            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCropComplete}
                                            disabled={!isCropperReady}
                                            className="rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1ebe5d] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Apply Crop
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Send Insurance PDF Modal */}
            {sendPdfModalOpen && sendPdfInvoice && (
                <div className="fixed inset-0 z-[2125] flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={closeSendPdfModal} />
                    <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-slate-900">Send Insurance PDF</h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    Send insurance PDF for {sendPdfInvoice.invoiceNumber} via WhatsApp bot.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSendPdfModal}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-800">Phone number</label>
                                <input
                                    type="tel"
                                    value={sendPdfPhone}
                                    onChange={(e) => setSendPdfPhone(normalizePhoneInput(e.target.value))}
                                    placeholder="9876543210 or 919876543210"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/20"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                The insurance PDF will be sent to this WhatsApp number via the backend template.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                            <button
                                type="button"
                                onClick={closeSendPdfModal}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitSendInsurancePdf}
                                disabled={sendingPdfInvoiceId === getInvoiceId(sendPdfInvoice)}
                                className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1fa955] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {sendingPdfInvoiceId === getInvoiceId(sendPdfInvoice) ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Insurance Upload Modal */}
            {showInsuranceModal && selectedInvoiceForInsurance && (
                <InsuranceUploadModal
                    invoice={selectedInvoiceForInsurance}
                    onClose={() => {
                        setShowInsuranceModal(false);
                        setSelectedInvoiceForInsurance(null);
                    }}
                    onSuccess={async (updatedInvoice?: any, uploadedFile?: File) => {
                        const baseInvoice = selectedInvoiceForInsurance;
                        const fileUrl =
                            updatedInvoice?.fileUrl ??
                            updatedInvoice?.data?.fileUrl ??
                            updatedInvoice?.insurance?.fileUrl ??
                            undefined;
                        const invoiceId = baseInvoice?.id;
                        const invoiceKey = baseInvoice
                            ? getInvoiceKey(baseInvoice)
                            : invoiceId;

                        if (invoiceKey && fileUrl) {
                            const uploadedAt = new Date().toISOString();
                            setInsuranceOverrides((prev) => ({
                                ...prev,
                                [invoiceKey]: { fileUrl, uploadedAt, fileType: 'application/pdf' },
                            }));
                            setInvoices((prev) =>
                                prev.map((i) =>
                                    getInvoiceKey(i) === invoiceKey
                                        ? {
                                            ...i,
                                            insurance: {
                                                fileUrl,
                                                uploadedAt,
                                                fileType: 'application/pdf',
                                            },
                                        }
                                        : i,
                                ),
                            );
                        } else if (updatedInvoice?.id || updatedInvoice?._id) {
                            setInvoices((prev) =>
                                prev.map((i) =>
                                    getInvoiceKey(i) === getInvoiceKey(updatedInvoice)
                                        ? { ...i, ...updatedInvoice }
                                        : i,
                                ),
                            );
                        }

                        setShowInsuranceModal(false);

                        // After upload, open the send PDF modal pre-filled
                        if (baseInvoice) {
                            const mergedInvoiceForSend: Invoice = {
                                ...baseInvoice,
                                ...(updatedInvoice || {}),
                                insurance: fileUrl
                                    ? {
                                        fileUrl,
                                        uploadedAt: updatedInvoice?.insurance?.uploadedAt || new Date().toISOString(),
                                        fileType: updatedInvoice?.insurance?.fileType || 'application/pdf',
                                    }
                                    : (updatedInvoice?.insurance ?? baseInvoice.insurance ?? null),
                            };

                            setSendPdfInvoice(mergedInvoiceForSend);
                            setSendPdfPhone(mergedInvoiceForSend.insuredPartyPhone || '');
                            if (uploadedFile) setSendPdfFile(uploadedFile);
                            setSendPdfModalOpen(true);
                        }

                        setSelectedInvoiceForInsurance(null);
                        await fetchInvoices();
                    }}
                />
            )}

            <BlacklistOverrideOtpModal
                open={blacklistOtpOpen}
                onClose={() => setBlacklistOtpOpen(false)}
                action={blacklistOtpAction}
                vehicleNumber={blacklistOtpVehicleNumber}
                invoiceId={blacklistOtpInvoiceId}
                title={
                    blacklistOtpAction === 'edit_claim_invoice'
                        ? 'Verify Owner to Edit Claim Invoice'
                        : 'Verify Owner for Blacklisted Vehicle'
                }
                description={
                    blacklistOtpAction === 'edit_claim_invoice'
                        ? 'Enter the authorized owner mobile number. If it matches, you will receive an OTP to confirm this edit.'
                        : 'Enter the authorized owner mobile number. If it matches, you will receive an OTP to create this invoice.'
                }
                requestOtp={async (input) => {
                    const response = await adminApi.requestInvoiceBlacklistOverrideOtp({
                        action: input.action,
                        ownerMobile: input.ownerMobile,
                        vehicleNumber: input.vehicleNumber ?? undefined,
                        invoiceId: input.invoiceId ?? undefined,
                        reason: input.reason,
                    });
                    return response?.data ?? response;
                }}
                verifyOtp={async (input) => {
                    const response = await adminApi.verifyInvoiceBlacklistOverrideOtp(input);
                    return response?.data ?? response;
                }}
                onVerified={async (overrideToken) => {
                    if (blacklistOtpRetryKind === 'create') {
                        await executeCreateInvoice(overrideToken);
                        return;
                    }
                    await executeRegenerate(overrideToken);
                }}
            />
        </div>
    );
}

export default function InsuranceFormsPage() {
    return <InsuranceFormsPageContent />;
}

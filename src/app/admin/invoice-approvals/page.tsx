'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { adminApi, type InvoiceApprovalAutofillChange } from '@/features/admin/api/admin.api';
import AsyncSearchableSelect from '@/features/admin/components/AsyncSearchableSelect';
import { itemsData } from '@/features/insurance/productCatalog';
import axios from 'axios';
import toast from 'react-hot-toast';

const BOT_BASE_URL =
  process.env.NEXT_PUBLIC_BOT_API_BASE_URL || 'http://localhost:8000';

type CollectionStatus = 'pending' | 'done' | 'rejected';
type DetailTab = 'review' | 'history' | 'chat';

interface InvoiceCollection {
  id: string;
  phone: string;
  status: CollectionStatus;
  window_started_at: string | null;
  window_closed_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  ai_draft: AiDraft | null;
  display_name: string;
  message_count: number;
}

interface AiDraft {
  commodity?: string;
  itemName?: string;
  productName?: string;
  quantity?: number;
  rate?: number;
  total_amount?: number;
  amount?: number;
  buyer_name?: string;
  billToName?: string;
  shipToName?: string;
  seller_name?: string;
  supplierName?: string;
  vehicle_number?: string;
  vehicleNumber?: string;
  invoice_date?: string;
  invoiceDate?: string;
  hsn_code?: string;
  hsn?: string;
  hsnCode?: string;
  confidence?: string;
  buyer_id?: string;
  customerUserId?: string;
  customer_user_id?: string;
  seller_id?: string;
  buyer_phone?: string;
  seller_phone?: string;
  buyer_address?: string;
  buyerAddress?: string;
  billToAddress?: string | string[];
  shipToAddress?: string | string[];
  supplier_address?: string;
  supplierAddress?: string | string[];
  place_of_supply?: string;
  placeOfSupply?: string;
  invoice_type?: string;
  invoiceType?: string;
  truck_number?: string;
  truckNumber?: string;
  owner_name?: string;
  ownerName?: string;
  weighment_slip_note?: string;
  weighmentSlipNote?: string;
  notes?: string;
  insured_party_phone?: string;
  insuredPartyPhone?: string;
  driver_phone?: string;
  driverPhone?: string;
  driver_secondary_phone?: string;
  driverSecondaryPhone?: string;
  invoice_number?: string;
  _weighment_slip_file?: File;
  autofill_meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface CollectionMessage {
  id: string;
  phone: string;
  direction: string;
  message_type: string;
  text_content: string | null;
  payload: any;
  created_at: string;
}

function getBotAdminToken() {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('botChatAdminToken') ||
    process.env.NEXT_PUBLIC_BOT_CHAT_ADMIN_TOKEN ||
    ''
  );
}

function botHeaders() {
  return { 'x-admin-token': getBotAdminToken() };
}

function formatTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(value?: number | null) {
  if (!value && value !== 0) return '-';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function confidenceBadge(confidence?: string) {
  const c = (confidence || 'unknown').toLowerCase();
  if (c === 'high') return { label: 'High', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (c === 'medium') return { label: 'Medium', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (c === 'low') return { label: 'Low', bg: 'bg-red-50 text-red-700 border-red-200' };
  return { label: 'Unknown', bg: 'bg-gray-50 text-gray-500 border-gray-200' };
}

function invoiceTypeFromDraftNote(note?: string | null) {
  const normalized = String(note || '').trim().toLowerCase();
  if (/(^|[^a-z0-9])(cash|nak|nag)([^a-z0-9]|$)/i.test(normalized)) {
    return 'BUYER_INVOICE';
  }
  if (normalized.includes('commission') || normalized.includes('commision')) {
    return 'SUPPLIER_INVOICE';
  }
  return 'BUYER_INVOICE';
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const text = firstText(...value);
      if (text) return text;
      continue;
    }
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return undefined;
}

function modeLabelFromInvoiceType(invoiceType?: string | null) {
  return String(invoiceType || '').toUpperCase() === 'BUYER_INVOICE'
    ? 'Cash'
    : invoiceType
    ? 'Commission'
    : 'Cash';
}

function invoiceTypeFromMode(mode?: string | null) {
  return String(mode || '').trim().toLowerCase() === 'cash'
    ? 'BUYER_INVOICE'
    : 'SUPPLIER_INVOICE';
}

function getCalculatedAmount(draft?: AiDraft | null): number | undefined {
  const qty = Number(draft?.quantity);
  const rate = Number(draft?.rate);
  if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
    return Math.round(qty * rate * 100) / 100;
  }
  return firstNumber(draft?.total_amount, draft?.amount);
}

function getAmountMismatch(draft?: AiDraft | null) {
  const declared = firstNumber(draft?.total_amount, draft?.amount);
  const calculated = getCalculatedAmount(draft);
  if (!declared || !calculated) return null;
  if (Math.abs(declared - calculated) < 1) return null;
  return { declared, calculated };
}

function isTomatoProduct(product?: string | null) {
  return /\btomato\b/i.test(String(product || ''));
}

function normalizeApprovalDraft(draft: AiDraft = {}): AiDraft {
  const invoiceType =
    firstText(draft.invoice_type, draft.invoiceType) ||
    invoiceTypeFromDraftNote(firstText(draft.notes, draft.weighment_slip_note, draft.weighmentSlipNote));
  const mode = firstText(draft.notes, draft.weighment_slip_note, draft.weighmentSlipNote) || modeLabelFromInvoiceType(invoiceType);
  const product = firstText(draft.commodity, draft.itemName, draft.productName);
  const hsn = firstText(draft.hsn_code, draft.hsn, draft.hsnCode);
  const amount = firstNumber(draft.total_amount, draft.amount);
  const buyerAddress = firstText(draft.buyer_address, draft.buyerAddress, draft.billToAddress, draft.shipToAddress);
  const supplierAddress = firstText(draft.supplier_address, draft.supplierAddress);
  const placeOfSupply = firstText(draft.place_of_supply, draft.placeOfSupply);
  const vehicle = firstText(draft.vehicle_number, draft.vehicleNumber, draft.truck_number, draft.truckNumber);
  const truck = firstText(draft.truck_number, draft.truckNumber, draft.vehicle_number, draft.vehicleNumber);
  const owner = firstText(draft.owner_name, draft.ownerName);
  const invoiceDate = firstText(draft.invoice_date, draft.invoiceDate);
  const insuredPhone = firstText(draft.insured_party_phone, draft.insuredPartyPhone);
  const driverPhone = firstText(draft.driver_phone, draft.driverPhone);
  const driverSecondaryPhone = firstText(draft.driver_secondary_phone, draft.driverSecondaryPhone);
  const supplierName = firstText(draft.seller_name, draft.supplierName);
  const buyerName = firstText(draft.buyer_name, draft.billToName, draft.shipToName);
  const customerId = firstText(draft.customer_user_id, draft.customerUserId, draft.buyer_id);

  return {
    ...draft,
    commodity: product,
    itemName: product,
    productName: product,
    hsn_code: hsn,
    hsn,
    hsnCode: hsn,
    total_amount: amount,
    amount,
    buyer_name: buyerName,
    billToName: buyerName,
    shipToName: buyerName,
    seller_name: supplierName,
    supplierName,
    buyer_address: buyerAddress,
    buyerAddress,
    billToAddress: buyerAddress ? [buyerAddress] : draft.billToAddress,
    shipToAddress: buyerAddress ? [buyerAddress] : draft.shipToAddress,
    supplier_address: supplierAddress,
    supplierAddress: supplierAddress ? [supplierAddress] : draft.supplierAddress,
    place_of_supply: placeOfSupply,
    placeOfSupply,
    invoice_type: invoiceType,
    invoiceType,
    notes: mode,
    weighment_slip_note: mode,
    weighmentSlipNote: mode,
    vehicle_number: vehicle,
    vehicleNumber: vehicle,
    truck_number: truck,
    truckNumber: truck,
    owner_name: owner,
    ownerName: owner,
    invoice_date: invoiceDate,
    invoiceDate,
    insured_party_phone: insuredPhone,
    insuredPartyPhone: insuredPhone,
    driver_phone: driverPhone,
    driverPhone,
    driver_secondary_phone: driverSecondaryPhone,
    driverSecondaryPhone,
    customer_user_id: customerId,
    customerUserId: customerId,
  };
}

function openPdfInNewTab(url?: string | null) {
  if (!url) return;
  if (typeof window === 'undefined') return;
  window.open(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, '_blank', 'noopener,noreferrer');
}

function serializableDraft(draft: AiDraft) {
  const rest = normalizeApprovalDraft(draft);
  const calculatedAmount = getCalculatedAmount(rest);
  if (calculatedAmount) {
    if (rest.total_amount && Math.abs(Number(rest.total_amount) - calculatedAmount) >= 1) {
      rest.declared_total_amount = rest.total_amount;
    }
    rest.total_amount = calculatedAmount;
    rest.amount = calculatedAmount;
  }
  delete rest._weighment_slip_file;
  return rest;
}

async function searchUsersForSelect(query: string) {
  const res = await adminApi.searchUsers(query, 20);
  if (!res.success || !Array.isArray(res.data)) return [];
  return res.data.map((u) => ({
    value: u.id,
    label: `${u.name || ''} | ${u.mobileNumber || ''}`.trim(),
  }));
}

export default function InvoiceApprovalsPage() {
  const { isAuthenticated } = useAdmin();
  const [collections, setCollections] = useState<InvoiceCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CollectionMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [editDraft, setEditDraft] = useState<AiDraft | null>(null);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillSummary, setAutofillSummary] = useState<{
    collectionId: string;
    changes: InvoiceApprovalAutofillChange[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'done' | 'rejected' | 'all'>('pending');
  const [approvedPdfUrl, setApprovedPdfUrl] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const autofillRequestRef = useRef(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Tab state
  const [activeTab, setActiveTab] = useState<DetailTab>('review');

  // History tab state
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Chat tab state
  const [fullChatMessages, setFullChatMessages] = useState<CollectionMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Active sessions (real-time: collecting in progress)
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  const filteredCollections = useMemo(() => {
    let result = collections;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) => c.display_name.toLowerCase().includes(q) || c.phone.includes(q)
      );
    }
    if (dateFrom) {
      result = result.filter((c) => c.window_closed_at && c.window_closed_at >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(
        (c) => c.window_closed_at && c.window_closed_at <= dateTo + 'T23:59:59'
      );
    }
    if (confidenceFilter !== 'all') {
      result = result.filter(
        (c) => c.ai_draft?.confidence?.toLowerCase() === confidenceFilter
      );
    }
    return result;
  }, [collections, searchQuery, dateFrom, dateTo, confidenceFilter]);

  const fetchCollections = useCallback(async () => {
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter };
      const res = await axios.get(`${BOT_BASE_URL}/admin/invoice-collections`, {
        headers: botHeaders(),
        params,
      });
      const items = (res.data.items || []).map((item: any) => ({
        ...item,
        ai_draft: typeof item.ai_draft === 'string' ? JSON.parse(item.ai_draft) : item.ai_draft,
      }));
      setCollections(items);
    } catch {
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (isAuthenticated) fetchCollections();
  }, [isAuthenticated, fetchCollections]);

  // Poll for active sessions and refresh collections every 15s
  useEffect(() => {
    if (!isAuthenticated) return;
    const poll = async () => {
      try {
        const res = await axios.get(`${BOT_BASE_URL}/admin/active-sessions`, { headers: botHeaders() });
        setActiveSessions(res.data.items || []);
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(() => { poll(); fetchCollections(); }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const fetchMessages = useCallback(async (id: string) => {
    setMessagesLoading(true);
    try {
      const res = await axios.get(
        `${BOT_BASE_URL}/admin/invoice-collections/${id}/messages`,
        { headers: botHeaders() }
      );
      setMessages(res.data.items || []);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const fetchCustomerHistory = useCallback(async (phone: string) => {
    setHistoryLoading(true);
    try {
      const searchPhone = phone.length > 10 ? phone.slice(-10) : phone;
      const userRes = await adminApi.searchUsers(searchPhone, 1);
      const user = userRes.data?.[0];
      if (!user) {
        setCustomerInvoices([]);
        return;
      }
      const invRes = await adminApi.filterInvoices({ userId: user.id || (user as any)._id });
      setCustomerInvoices(invRes.data || []);
    } catch {
      setCustomerInvoices([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchFullChat = useCallback(async (phone: string) => {
    setChatLoading(true);
    try {
      const res = await axios.get(
        `${BOT_BASE_URL}/admin/chat/conversations/${phone}/messages?limit=500`,
        { headers: botHeaders() }
      );
      setFullChatMessages(res.data.items || []);
    } catch {
      setFullChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  const autofillDraftForCollection = useCallback(async (col: InvoiceCollection) => {
    const requestId = autofillRequestRef.current + 1;
    autofillRequestRef.current = requestId;

    if (col.status !== 'pending') {
      setAutofillLoading(false);
      setAutofillSummary(null);
      return;
    }

    const baseDraft = col.ai_draft ? serializableDraft({ ...col.ai_draft }) : {};
    setAutofillLoading(true);
    setAutofillSummary(null);

    try {
      const result = await adminApi.autofillInvoiceApprovalDraft({
        draft: baseDraft,
        phone: col.phone,
      });

      if (autofillRequestRef.current !== requestId) return;
      const payload = result.data;
      if (!result.success || !payload?.draft) {
        setAutofillSummary({ collectionId: col.id, changes: [] });
        return;
      }

      const enrichedDraft = normalizeApprovalDraft(payload.draft as AiDraft);
      setEditDraft((prev) => {
        if (autofillRequestRef.current !== requestId) return prev;
        return { ...(prev || {}), ...enrichedDraft };
      });
      setAutofillSummary({ collectionId: col.id, changes: payload.changes || [] });

      if ((payload.changes || []).length > 0) {
        const saveRes = await axios.patch(
          `${BOT_BASE_URL}/admin/invoice-collections/${col.id}/draft`,
          { ai_draft: serializableDraft(enrichedDraft) },
          { headers: botHeaders() }
        );
        if (autofillRequestRef.current !== requestId) return;
        setCollections((prev) =>
          prev.map((item) =>
            item.id === col.id ? { ...item, ai_draft: saveRes.data.ai_draft } : item
          )
        );
      }
    } catch {
      if (autofillRequestRef.current === requestId) {
        setAutofillSummary({ collectionId: col.id, changes: [] });
      }
    } finally {
      if (autofillRequestRef.current === requestId) {
        setAutofillLoading(false);
      }
    }
  }, []);

  const selectCollection = useCallback(
    (col: InvoiceCollection) => {
      setSelectedId(col.id);
      setEditDraft(col.ai_draft ? normalizeApprovalDraft({ ...col.ai_draft }) : {});
      setAutofillSummary(null);
      setActiveTab('review');
      setApprovedPdfUrl(null);
      setCustomerInvoices([]);
      setFullChatMessages([]);
      fetchMessages(col.id);
      void autofillDraftForCollection(col);
      if (detailRef.current) {
        detailRef.current.scrollTo({ top: 0 });
      }
    },
    [autofillDraftForCollection, fetchMessages]
  );

  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedId) || null,
    [collections, selectedId]
  );

  useEffect(() => {
    if (!selectedCollection) return;
    const phone = selectedCollection.phone;
    if (activeTab === 'history' && customerInvoices.length === 0 && !historyLoading) {
      fetchCustomerHistory(phone);
    }
    if (activeTab === 'chat' && fullChatMessages.length === 0 && !chatLoading) {
      fetchFullChat(phone);
    }
  }, [activeTab, selectedCollection?.id]);

  const handleDraftChange = (field: string, value: any) => {
    setEditDraft((prev) => {
      const next = normalizeApprovalDraft(prev ? { ...prev } : {});
      if (field === 'commodity' || field === 'itemName' || field === 'productName') {
        const product = String(value || '');
        const catalogItem = itemsData.find(
          (item) => item.name.trim().toLowerCase() === product.trim().toLowerCase()
        );
        next.commodity = product;
        next.itemName = product;
        next.productName = product;
        if (catalogItem?.hsn) {
          next.hsn_code = catalogItem.hsn;
          next.hsn = catalogItem.hsn;
          next.hsnCode = catalogItem.hsn;
        }
        return normalizeApprovalDraft(next);
      }
      if (field === 'hsn_code' || field === 'hsn' || field === 'hsnCode') {
        next.hsn_code = value;
        next.hsn = value;
        next.hsnCode = value;
        return normalizeApprovalDraft(next);
      }
      if (field === 'total_amount' || field === 'amount') {
        next.total_amount = value;
        next.amount = value;
        return normalizeApprovalDraft(next);
      }
      if (field === 'invoice_type' || field === 'invoiceType') {
        const invoiceType = String(value || 'SUPPLIER_INVOICE');
        const mode = modeLabelFromInvoiceType(invoiceType);
        next.invoice_type = invoiceType;
        next.invoiceType = invoiceType;
        next.notes = mode;
        next.weighment_slip_note = mode;
        next.weighmentSlipNote = mode;
        return normalizeApprovalDraft(next);
      }
      if (field === 'notes' || field === 'weighment_slip_note' || field === 'weighmentSlipNote') {
        const mode = String(value || '');
        const invoiceType = invoiceTypeFromMode(mode);
        next.notes = mode;
        next.weighment_slip_note = mode;
        next.weighmentSlipNote = mode;
        next.invoice_type = invoiceType;
        next.invoiceType = invoiceType;
        return normalizeApprovalDraft(next);
      }
      return normalizeApprovalDraft({ ...next, [field]: value });
    });
  };

  const saveDraft = async () => {
    if (!selectedId || !editDraft) return;
    setSaving(true);
    try {
      const res = await axios.patch(
        `${BOT_BASE_URL}/admin/invoice-collections/${selectedId}/draft`,
        { ai_draft: serializableDraft(editDraft) },
        { headers: botHeaders() }
      );
      setCollections((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, ai_draft: res.data.ai_draft } : c))
      );
      toast.success('Draft saved');
    } catch {
      toast.error('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const [postSendStatus, setPostSendStatus] = useState<{ invoiceNumber?: string; pdfGenerated?: boolean; whatsappSent?: boolean; paymentLink?: boolean } | null>(null);

  const approveCollection = async () => {
    if (!selectedId) return;
    setApproving(true);
    setPostSendStatus(null);
    try {
      if (editDraft) {
        const saveRes = await axios.patch(
          `${BOT_BASE_URL}/admin/invoice-collections/${selectedId}/draft`,
          { ai_draft: serializableDraft(editDraft) },
          { headers: botHeaders() }
        );
        setCollections((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, ai_draft: saveRes.data.ai_draft } : c))
        );
      }

      // Step 1: Create invoice via bot using the latest visible draft
      const res = await axios.post(
        `${BOT_BASE_URL}/admin/invoice-collections/${selectedId}/approve`,
        { approved_by: 'admin_dashboard' },
        { headers: botHeaders() }
      );
      const invoiceData = res.data?.invoice;
      const invoiceId = invoiceData?.id;
      if (invoiceData?.pdfUrl) {
        setApprovedPdfUrl(invoiceData.pdfUrl);
      }

      const status: {
        invoiceNumber?: string;
        pdfGenerated?: boolean;
        whatsappSent?: boolean;
        paymentLink?: boolean;
      } = { invoiceNumber: invoiceData?.invoiceNumber, pdfGenerated: !!invoiceData?.pdfUrl };

      // Step 2: Upload weighment slip if present
      if (invoiceId && editDraft?._weighment_slip_file instanceof File) {
        try {
          await adminApi.uploadWeighmentSlips(invoiceId, [editDraft._weighment_slip_file]);
        } catch { /* non-blocking */ }
      }

      // Step 3: Verify + send invoice PDF to customer. Payment links are sent
      // manually from the insurance page.
      if (invoiceId) {
        try {
          await adminApi.verifyInvoice(invoiceId);
          status.whatsappSent = true;
        } catch {
          status.whatsappSent = false;
        }
      }

      setPostSendStatus(status);
      toast.success('Invoice sent to customer!');
      fetchCollections();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const rejectCollection = async () => {
    if (!selectedId) return;
    const reason = window.prompt('Rejection reason (optional):') || 'rejected_by_admin';
    setRejecting(true);
    try {
      await axios.post(
        `${BOT_BASE_URL}/admin/invoice-collections/${selectedId}/reject`,
        { reason, rejected_by: 'admin_dashboard' },
        { headers: botHeaders() }
      );
      toast.success('Rejected');
      setSelectedId(null);
      setMessages([]);
      setEditDraft(null);
      fetchCollections();
    } catch {
      toast.error('Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!selectedId || !selectedCollection) return;
      if (selectedCollection.status !== 'pending') return;
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); approveCollection(); }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); rejectCollection(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, selectedCollection]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!filteredCollections.length) return;
      const currentIdx = filteredCollections.findIndex((c) => c.id === selectedId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIdx < filteredCollections.length - 1 ? currentIdx + 1 : 0;
        selectCollection(filteredCollections[next]);
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : filteredCollections.length - 1;
        selectCollection(filteredCollections[prev]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredCollections, selectedId, selectCollection]);

  const pendingCount = collections.filter((c) => c.status === 'pending').length;
  const today = new Date().toISOString().split('T')[0];
  const todayCollections = collections.filter((c) => c.window_closed_at?.startsWith(today));
  const todayHighConf = todayCollections.filter((c) => c.ai_draft?.confidence === 'high').length;
  const todayNeedsReview = todayCollections.filter((c) => c.ai_draft?.confidence === 'low' || c.ai_draft?.confidence === 'medium').length;

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col lg:h-[calc(100vh-64px)]">
      {/* Header + Insights + Filter bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Invoice Approvals</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {pendingCount} pending &middot; {filteredCollections.length} shown
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => { setDateFrom(today); setDateTo(today); }}
              className="rounded-md bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Today
            </button>
            <button
              onClick={fetchCollections}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Refresh
            </button>
          </div>
        </div>
        {/* Insight cards */}
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Pending</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{pendingCount}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Today&apos;s Invoices</div>
            <div className="mt-1 text-xl font-semibold text-emerald-700">{todayCollections.length}</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-green-600">High Confidence</div>
            <div className="mt-1 text-xl font-semibold text-green-700">{todayHighConf}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Needs Review</div>
            <div className="mt-1 text-xl font-semibold text-amber-700">{todayNeedsReview}</div>
          </div>
        </div>
        {/* Horizontal filter bar */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
            <input
              type="text"
              placeholder="Search by name / phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 lg:w-[180px]"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none lg:w-[140px]"
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none lg:w-[140px]"
              title="To date"
            />
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value as any)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none lg:w-auto"
            >
              <option value="all">All Confidence</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none lg:w-auto"
            >
              <option value="pending">Pending</option>
              <option value="done">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Status</option>
            </select>
            {(searchQuery || dateFrom || dateTo || confidenceFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setDateFrom(''); setDateTo(''); setConfidenceFilter('all'); }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content: split pane */}
      <div className="flex min-h-0 flex-1 flex-col overflow-visible lg:flex-row lg:overflow-hidden">
        {/* Left: Queue list */}
        <div className="max-h-[340px] w-full shrink-0 overflow-y-auto border-b border-gray-200 bg-gray-50 lg:max-h-none lg:w-96 lg:border-b-0 lg:border-r">
          {/* Active sessions - live collecting */}
          {activeSessions.length > 0 && (
            <div className="border-b border-indigo-100 bg-indigo-50/50 px-4 py-2">
              <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                Collecting Now
              </p>
              {activeSessions.map((s: any) => (
                <div key={s.phone} className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-indigo-900">{s.display_name || s.phone}</span>
                  <span className="text-[10px] text-indigo-500">processing...</span>
                </div>
              ))}
            </div>
          )}
          {filteredCollections.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">
              No collections match filters
            </div>
          ) : (
            filteredCollections.map((col) => (
              <button
                key={col.id}
                onClick={() => selectCollection(col)}
                className={`w-full border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-white ${
                  selectedId === col.id ? 'bg-white ring-1 ring-inset ring-indigo-200' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                    {col.display_name}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      col.status === 'pending'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : col.status === 'rejected'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-green-200 bg-green-50 text-green-700'
                    }`}
                  >
                    {col.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>{col.message_count} msgs</span>
                  <span>&middot;</span>
                  <span>{formatTime(col.window_closed_at)}</span>
                  {col.ai_draft?.total_amount ? (
                    <>
                      <span>&middot;</span>
                      <span className="font-medium text-gray-700">
                        {formatCurrency(col.ai_draft.total_amount)}
                      </span>
                    </>
                  ) : null}
                </div>
                {col.ai_draft?.confidence && (
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                        confidenceBadge(col.ai_draft.confidence).bg
                      }`}
                    >
                      {confidenceBadge(col.ai_draft.confidence).label} confidence
                    </span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Right: Detail view with tabs */}
        <div className="flex min-h-0 flex-1 flex-col overflow-visible bg-white lg:overflow-hidden">
          {!selectedCollection ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Select a collection from the left to review
            </div>
          ) : (
            <>
              <div className="flex shrink-0 overflow-x-auto border-b border-gray-200 px-4 pt-2 sm:px-6">
                {(['review', 'history', 'chat'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab === 'review' ? 'Review' : tab === 'history' ? 'History' : 'Chat'}
                  </button>
                ))}
              </div>
              <div ref={detailRef} className="flex-1 overflow-visible lg:overflow-y-auto">
                {activeTab === 'review' && (
                  <ReviewTab
                    selectedCollection={selectedCollection}
                    messages={messages}
                    messagesLoading={messagesLoading}
                    editDraft={editDraft}
                    autofillLoading={autofillLoading}
                    autofillChanges={
                      autofillSummary?.collectionId === selectedCollection.id
                        ? autofillSummary.changes
                        : []
                    }
                    handleDraftChange={handleDraftChange}
                    saveDraft={saveDraft}
                    saving={saving}
                    approveCollection={approveCollection}
                    approving={approving}
                    rejectCollection={rejectCollection}
                    rejecting={rejecting}
                    approvedPdfUrl={approvedPdfUrl}
                    postSendStatus={postSendStatus}
                    handleDownload={async () => {
                      if (!editDraft) return;
                      try {
                        const formData = new FormData();
                        formData.append('ai_draft', JSON.stringify(editDraft));
                        const slipFile = editDraft._weighment_slip_file;
                        if (slipFile instanceof File) {
                          formData.append('weighment_slip', slipFile);
                        }
                        const res = await axios.post(
                          `${BOT_BASE_URL}/admin/invoice-collections/preview-pdf`,
                          formData,
                          { headers: { ...botHeaders() }, responseType: 'blob' }
                        );
                        const url = URL.createObjectURL(res.data);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `invoice-preview-${selectedCollection?.display_name || 'draft'}.pdf`;
                        link.click();
                        URL.revokeObjectURL(url);
                        toast.success('PDF downloaded');
                      } catch {
                        toast.error('Failed to generate preview PDF');
                      }
                    }}
                  />
                )}
                {activeTab === 'history' && (
                  <HistoryTab customerInvoices={customerInvoices} historyLoading={historyLoading} customerName={selectedCollection.display_name} />
                )}
                {activeTab === 'chat' && (
                  <ChatTab messages={fullChatMessages} chatLoading={chatLoading} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Review Tab ─────────────────────────────────────────────────────────────

function ReviewTab({
  selectedCollection, messages, messagesLoading, editDraft, autofillLoading, autofillChanges, handleDraftChange,
  saveDraft, saving, approveCollection, approving, rejectCollection, rejecting, approvedPdfUrl, handleDownload, postSendStatus,
}: {
  selectedCollection: InvoiceCollection; messages: CollectionMessage[]; messagesLoading: boolean;
  editDraft: AiDraft | null; autofillLoading: boolean; autofillChanges: InvoiceApprovalAutofillChange[];
  handleDraftChange: (field: string, value: any) => void;
  saveDraft: () => void; saving: boolean; approveCollection: () => void; approving: boolean;
  rejectCollection: () => void; rejecting: boolean; approvedPdfUrl: string | null; handleDownload: () => void;
  postSendStatus: { invoiceNumber?: string; pdfGenerated?: boolean; whatsappSent?: boolean; paymentLink?: boolean } | null;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const amountMismatch = getAmountMismatch(editDraft);
  const effectiveAmount = getCalculatedAmount(editDraft);
  const showDriverFields = isTomatoProduct(editDraft?.commodity);

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      {/* Source messages */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Customer Messages</h2>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-48 overflow-y-auto">
          {messagesLoading ? (
            <div className="text-xs text-gray-400">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-xs text-gray-400">No messages found for this window</div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-gray-400 mr-2">{formatTime(msg.created_at)}</span>
                    {msg.message_type !== 'text' && (
                      <span className="inline-flex items-center rounded bg-gray-200 px-1 py-0.5 text-[9px] font-medium text-gray-600 uppercase mr-2">
                        {msg.message_type}
                      </span>
                    )}
                    {msg.text_content ? (
                      <span className="text-sm text-gray-800">{msg.text_content}</span>
                    ) : (
                      <span className="text-xs italic text-gray-400">[{msg.message_type} attachment]</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Draft - editable fields (matches AdminCreateInvoicePayload) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">AI-Generated Invoice</h2>
          {editDraft?.confidence && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceBadge(editDraft.confidence).bg}`}>
              {confidenceBadge(editDraft.confidence).label} confidence
            </span>
          )}
        </div>
        {(autofillLoading || autofillChanges.length > 0) && (
          <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            {autofillLoading ? (
              <span>Checking insurance learning and invoice history...</span>
            ) : (
              <span>
                Auto-filled {autofillChanges.length} blank field{autofillChanges.length === 1 ? '' : 's'} from history:
                {' '}
                {autofillChanges.slice(0, 6).map((change) => change.field.replace(/_/g, ' ')).join(', ')}
                {autofillChanges.length > 6 ? '...' : ''}
              </span>
            )}
          </div>
        )}
        {amountMismatch && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Customer message had total {formatCurrency(amountMismatch.declared)}, but quantity x rate is {formatCurrency(amountMismatch.calculated)}.
            Invoice will follow quantity x rate like the /insurance form.
          </div>
        )}
        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-4 sm:p-4">
          {/* Section: Invoice Mode */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Invoice Mode</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cash ya Commission</label>
                <select
                  value={editDraft?.notes || modeLabelFromInvoiceType(editDraft?.invoice_type)}
                  onChange={(e) => handleDraftChange('notes', e.target.value)}
                  disabled={selectedCollection.status !== 'pending'}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Commission">Commission</option>
                </select>
              </div>
              <DraftField label="Invoice Date" value={editDraft?.invoice_date || ''} onChange={(v) => handleDraftChange('invoice_date', v)} placeholder="DD/MM/YYYY" disabled={selectedCollection.status !== 'pending'} />
            </div>
          </div>

          {/* Section: Product & Pricing */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Product & Pricing</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ProductDraftField value={editDraft?.commodity || ''} onChange={(v) => handleDraftChange('commodity', v)} disabled={selectedCollection.status !== 'pending'} />
              <DraftField label="Quantity" value={editDraft?.quantity?.toString() || ''} onChange={(v) => handleDraftChange('quantity', parseFloat(v) || 0)} type="number" disabled={selectedCollection.status !== 'pending'} />
              <DraftField label="Rate" value={editDraft?.rate?.toString() || ''} onChange={(v) => handleDraftChange('rate', parseFloat(v) || 0)} type="number" disabled={selectedCollection.status !== 'pending'} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Amount: <span className="font-medium text-gray-700">{formatCurrency(effectiveAmount)}</span>
              {editDraft?.hsn_code ? <span> &middot; HSN mapped from product: {editDraft.hsn_code}</span> : null}
            </p>
          </div>

          {/* Section: Buyer / Seller */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Buyer & Seller</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Party Ka Naam / Buyer Name</label>
                {selectedCollection.status === 'pending' ? (
                  <AsyncSearchableSelect
                    label=""
                    value={editDraft?.buyer_id || ''}
                    onChange={(val) => handleDraftChange('buyer_id', val)}
                    placeholder={editDraft?.buyer_name || 'Search buyer...'}
                    searchPlaceholder="Search by name or phone..."
                    onSearch={searchUsersForSelect}
                    className="w-full"
                  />
                ) : (
                  <input type="text" value={editDraft?.buyer_name || ''} disabled className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
                )}
                <input type="text" value={editDraft?.buyer_name || ''} onChange={(e) => handleDraftChange('buyer_name', e.target.value)} placeholder="Or type manually" disabled={selectedCollection.status !== 'pending'} className="mt-1 w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Supplier Kaun / Seller Name</label>
                {selectedCollection.status === 'pending' ? (
                  <AsyncSearchableSelect
                    label=""
                    value={editDraft?.seller_id || ''}
                    onChange={(val) => handleDraftChange('seller_id', val)}
                    placeholder={editDraft?.seller_name || 'Search seller...'}
                    searchPlaceholder="Search by name or phone..."
                    onSearch={searchUsersForSelect}
                    className="w-full"
                  />
                ) : (
                  <input type="text" value={editDraft?.seller_name || ''} disabled className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
                )}
                <input type="text" value={editDraft?.seller_name || ''} onChange={(e) => handleDraftChange('seller_name', e.target.value)} placeholder="Or type manually" disabled={selectedCollection.status !== 'pending'} className="mt-1 w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none disabled:text-gray-400" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3">
              <DraftField label="Party Address / Destination" value={editDraft?.buyer_address || ''} onChange={(v) => handleDraftChange('buyer_address', v)} placeholder="State / City" disabled={selectedCollection.status !== 'pending'} />
              <DraftField label="Supplier Address / Source" value={editDraft?.supplier_address || ''} onChange={(v) => handleDraftChange('supplier_address', v)} placeholder="State / City" disabled={selectedCollection.status !== 'pending'} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3">
              <DraftField label="Place of Supply" value={editDraft?.place_of_supply || ''} onChange={(v) => handleDraftChange('place_of_supply', v)} placeholder="e.g. KARNATAKA" disabled={selectedCollection.status !== 'pending'} />
            </div>
          </div>

          {/* Section: Transport & Vehicle */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Transport & Vehicle</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DraftField label="Vehicle Number" value={editDraft?.vehicle_number || ''} onChange={(v) => handleDraftChange('vehicle_number', v)} placeholder="e.g. KA05MN3344" disabled={selectedCollection.status !== 'pending'} />
              <DraftField label="Owner / Transporter Name" value={editDraft?.owner_name || ''} onChange={(v) => handleDraftChange('owner_name', v)} disabled={selectedCollection.status !== 'pending'} />
            </div>
            {showDriverFields && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3">
                <DraftField label="Driver Mobile Number" value={editDraft?.driver_phone || ''} onChange={(v) => handleDraftChange('driver_phone', v)} placeholder="Required for Tomato if available" disabled={selectedCollection.status !== 'pending'} />
                <DraftField label="Alternate Driver Mobile" value={editDraft?.driver_secondary_phone || ''} onChange={(v) => handleDraftChange('driver_secondary_phone', v)} placeholder="Optional" disabled={selectedCollection.status !== 'pending'} />
              </div>
            )}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Weighment Slip (Upload)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                disabled={selectedCollection.status !== 'pending'}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDraftChange('_weighment_slip_file', file);
                }}
                className="w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Section: Insurance */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Insurance</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DraftField label="Insured Party Phone" value={editDraft?.insured_party_phone || ''} onChange={(v) => handleDraftChange('insured_party_phone', v)} placeholder="10-digit mobile" disabled={selectedCollection.status !== 'pending'} />
              <DraftField label="Premium Amount (user rate)" value="Calculated on creation" onChange={() => {}} disabled={true} />
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Preview - collapsed by default */}
      {editDraft?.commodity && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowPreview((value) => !value)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <span>Invoice Preview</span>
            <span className="text-xs text-gray-500">{showPreview ? 'Hide' : 'Show'}</span>
          </button>
          {showPreview && (
            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[760px]">
                <InvoicePreviewCard draft={editDraft} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* PDF embed after approval */}
      {approvedPdfUrl && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Generated Invoice PDF</h2>
            <div className="flex gap-2">
              <button onClick={() => openPdfInNewTab(approvedPdfUrl)} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors">
                Send
              </button>
              <a href={approvedPdfUrl} download className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Download
              </a>
            </div>
          </div>
          <iframe src={`${approvedPdfUrl}?t=${Date.now()}`} className="w-full h-[600px] border border-gray-300" title="Invoice PDF" />
        </div>
      )}

      {/* Action buttons */}
      {selectedCollection.status === 'pending' && (
        <div className="border-t border-gray-100 pt-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <button onClick={approveCollection} disabled={approving} className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {approving ? 'Sending...' : 'Send'}
            </button>
            <button onClick={handleDownload} disabled={approving} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Download
            </button>
            <button onClick={saveDraft} disabled={saving} className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Edits'}
            </button>
            <button onClick={rejectCollection} disabled={rejecting} className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors">
              {rejecting ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      )}
      {selectedCollection.status !== 'pending' && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">
            This collection was <span className="font-medium">{selectedCollection.status === 'done' ? 'approved' : 'rejected'}</span> by {selectedCollection.completed_by || 'unknown'} on {formatTime(selectedCollection.completed_at)}
          </p>
        </div>
      )}

      {/* Post-send status tracker */}
      {postSendStatus && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-2">Invoice Sent Successfully</p>
          <div className="space-y-1 text-sm">
            {postSendStatus.invoiceNumber && <p className="text-emerald-700">✓ Invoice created: {postSendStatus.invoiceNumber}</p>}
            {postSendStatus.pdfGenerated && <p className="text-emerald-700">✓ PDF generated</p>}
            {postSendStatus.whatsappSent && <p className="text-emerald-700">✓ WhatsApp sent to customer</p>}
            {postSendStatus.paymentLink && <p className="text-emerald-700">✓ Payment link created</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Preview Card (matches actual PDF layout) ───────────────────────

function InvoicePreviewCard({ draft }: { draft: AiDraft }) {
  const normalizedDraft = normalizeApprovalDraft(draft);
  const previewAmount = getCalculatedAmount(normalizedDraft) || 0;
  const insuredName =
    normalizedDraft.invoice_type === 'BUYER_INVOICE'
      ? normalizedDraft.buyer_name || '-'
      : normalizedDraft.seller_name || '-';

  return (
    <div className="border border-gray-400 bg-white overflow-hidden text-xs" style={{ fontFamily: 'serif' }}>
      {/* Header */}
      <div className="border-b border-gray-400 px-6 py-4 flex items-start justify-between">
        <div>
          <p className="text-base font-bold text-indigo-700" style={{ fontFamily: 'sans-serif' }}>MandiPlus</p>
          <p className="font-bold text-gray-900 text-sm">ENP FARMS PVT LTD</p>
          <p className="text-gray-600 text-[11px]"># 51/4, Glass Factory Layout, Anandapur, Electronic City, Karnataka 560099</p>
        </div>
        <div className="border-2 border-gray-800 rounded px-4 py-2 text-sm font-bold text-gray-900">
          INVOICE
        </div>
      </div>

      {/* Meta: Invoice details + Supplier */}
      <div className="grid grid-cols-2 border-b border-gray-400">
        <div className="border-r border-gray-400 p-4 space-y-1.5">
          <div><span className="font-semibold">Invoice Number &nbsp;&nbsp;: &nbsp;</span><span className="font-bold">{normalizedDraft.invoice_number || 'INV-XXXX-XXXXXX'}</span></div>
          <div><span className="font-semibold">Invoice Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;</span><span className="font-bold">{normalizedDraft.invoice_date || '-'}</span></div>
          <div><span className="font-semibold">Terms &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;</span><span className="font-bold">CUSTOM</span></div>
        </div>
        <div className="p-4 space-y-1.5">
          <div><span className="font-semibold">Supplier Name &nbsp;&nbsp;&nbsp;: &nbsp;</span><span className="font-bold">{normalizedDraft.seller_name || '-'}</span></div>
          <div><span className="font-semibold">Place of Supply &nbsp;: &nbsp;</span><span className="font-bold">{normalizedDraft.place_of_supply || '-'}</span></div>
        </div>
      </div>

      {/* Bill To / Ship To */}
      <div className="grid grid-cols-2 border-b border-gray-400">
        <div className="border-r border-gray-400 p-4">
          <p className="text-[10px] font-semibold text-gray-600 uppercase mb-1">Bill To</p>
          <p className="font-bold text-gray-900 text-sm">{normalizedDraft.buyer_name || '-'}</p>
          <p className="text-gray-700">{normalizedDraft.buyer_address || '-'}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold text-gray-600 uppercase mb-1">Ship To</p>
          <p className="font-bold text-gray-900 text-sm">{normalizedDraft.buyer_name || '-'}</p>
          <p className="text-gray-700">{normalizedDraft.buyer_address || '-'}</p>
        </div>
      </div>

      {/* Items table */}
      <div className="border-b border-gray-400">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400 text-[11px] font-bold text-gray-900">
              <th className="px-3 py-2 text-left border-r border-gray-300 w-8">#</th>
              <th className="px-3 py-2 text-left border-r border-gray-300">Item & Description</th>
              <th className="px-3 py-2 text-left border-r border-gray-300">HSN/SAC</th>
              <th className="px-3 py-2 text-center border-r border-gray-300">Qty</th>
              <th className="px-3 py-2 text-right border-r border-gray-300">Rate</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-3 border-r border-gray-300">1</td>
              <td className="px-3 py-3 border-r border-gray-300">{normalizedDraft.commodity || '-'}</td>
              <td className="px-3 py-3 border-r border-gray-300">{normalizedDraft.hsn_code || '-'}</td>
              <td className="px-3 py-3 text-center border-r border-gray-300">{normalizedDraft.quantity || 0}</td>
              <td className="px-3 py-3 text-right border-r border-gray-300">Rs. {Number(normalizedDraft.rate || 0).toFixed(2)}</td>
              <td className="px-3 py-3 text-right font-semibold">Rs. {Number(previewAmount || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes + Total */}
      <div className="grid grid-cols-2 border-b border-gray-400">
        <div className="border-r border-gray-400 p-4">
          <p className="font-bold text-gray-900 mb-2">Notes</p>
          <p>Vehicle No : <span className="font-semibold">{normalizedDraft.vehicle_number || '-'}</span></p>
          <p>Transporter Name : <span className="font-semibold">{normalizedDraft.owner_name || '-'}</span></p>
          <p className="mt-2 text-[10px] text-gray-700 leading-relaxed">
            This vehicle is transporting {normalizedDraft.commodity} from Supplier: {normalizedDraft.seller_name || '-'} to Buyer: {normalizedDraft.buyer_name || '-'}.
          </p>
          <p className="mt-1 text-[10px] text-gray-700 leading-relaxed">
            In case of any accident, loss, or damage during transit, {insuredName} shall be treated as the insured person and will be entitled to receive all claim amounts for the damaged goods.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <div className="border border-gray-300 rounded p-3 text-center">
            <p className="text-[10px] text-gray-500 mb-0.5">Total</p>
            <p className="text-base font-bold text-gray-900">Rs. {Number(previewAmount || 0).toFixed(2)}</p>
          </div>
          <div className="border border-gray-300 rounded p-3 text-center">
            <p className="text-[10px] text-gray-500 mb-0.5">Insurance Amount (user rate)</p>
            <p className="text-sm font-semibold text-gray-900">Calculated on creation</p>
          </div>
        </div>
      </div>

      {/* Weighment Slip + Insurance T&C */}
      <div className="grid grid-cols-2 border-b border-gray-400">
        <div className="border-r border-gray-400 p-4">
          <p className="font-bold text-gray-900 text-[11px] mb-2">Weighment Slip</p>
          <div className="h-24 border border-dashed border-gray-300 rounded flex items-center justify-center">
            <span className="text-[10px] text-gray-400 italic">Weighment slip image area</span>
          </div>
        </div>
        <div className="p-4">
          <p className="font-bold text-gray-900 text-[11px] mb-2">Insurance Terms and Conditions</p>
          <div className="text-[9px] text-gray-700 leading-relaxed space-y-1">
            <p className="font-semibold">1. Scope of Claim Eligibility :</p>
            <p>&bull; Vehicle accident, collision, or overturning during transit.</p>
            <p>&bull; Theft, hijacking, or unlawful removal of the cargo.</p>
            <p>&bull; Shortage or Missing Goods (admissible only when difference exceeds 2 Tons).</p>
            <p className="font-semibold mt-1">2. Mandatory Documentation :</p>
            <p>&bull; Photos/videos of damaged goods &bull; FIR &bull; Original Invoice</p>
            <p className="font-semibold mt-1">3. Dispute Resolution :</p>
            <p>support@mandiplus.com &nbsp; Mob: +91 99001 86757</p>
          </div>
        </div>
      </div>

      {/* Payment Details footer */}
      <div className="bg-gray-900 text-white text-center py-2 text-[11px] font-bold uppercase tracking-wider">
        Payment Details
      </div>
    </div>
  );
}

// ─── History Tab ────────────────────────────────────────────────────────────

function HistoryTab({ customerInvoices, historyLoading, customerName }: { customerInvoices: any[]; historyLoading: boolean; customerName: string }) {
  if (historyLoading) {
    return <div className="flex h-40 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" /></div>;
  }
  if (customerInvoices.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-gray-400">No previous invoices found for {customerName}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Previous Invoices for {customerName}</h2>
        <span className="text-xs text-gray-400">{customerInvoices.length} invoices</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-xs text-gray-500 uppercase">
              <th className="px-3 py-2.5 text-left font-medium">Invoice #</th>
              <th className="px-3 py-2.5 text-left font-medium">Date</th>
              <th className="px-3 py-2.5 text-left font-medium">Product</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="px-3 py-2.5 text-left font-medium">Vehicle</th>
              <th className="px-3 py-2.5 text-center font-medium">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customerInvoices.map((inv: any) => (
              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 font-medium text-indigo-600">{inv.invoiceNumber || '-'}</td>
                <td className="px-3 py-2.5 text-gray-600">{formatDate(inv.invoiceDate || inv.createdAt)}</td>
                <td className="px-3 py-2.5 text-gray-700">{inv.productName || '-'}</td>
                <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(inv.amount)}</td>
                <td className="px-3 py-2.5 text-gray-600">{inv.vehicleNumber || '-'}</td>
                <td className="px-3 py-2.5 text-center">
                  {(inv.pdfUrl || inv.pdfURL) ? (
                    <button onClick={() => openPdfInNewTab(inv.pdfUrl || inv.pdfURL)} className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
                      View PDF
                    </button>
                  ) : <span className="text-xs text-gray-300">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Chat Tab ───────────────────────────────────────────────────────────────

function ChatTab({ messages, chatLoading }: { messages: CollectionMessage[]; chatLoading: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0 && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length]);

  if (chatLoading) {
    return <div className="flex h-40 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" /></div>;
  }
  if (messages.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-gray-400">No messages found</div>;
  }

  return (
    <div className="p-4 space-y-2">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${msg.direction === 'outbound' ? 'bg-emerald-100 text-gray-900' : 'bg-gray-100 text-gray-900'}`}>
            {msg.text_content && <p className="whitespace-pre-wrap break-words">{msg.text_content}</p>}
            {!msg.text_content && msg.message_type !== 'text' && <p className="text-xs italic text-gray-500">[{msg.message_type} attachment]</p>}
            <p className="text-[10px] text-gray-400 mt-1 text-right">{formatTime(msg.created_at)}</p>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ─── Shared ─────────────────────────────────────────────────────────────────

function ProductDraftField({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Select Item</label>
      <input
        list="invoice-approval-product-catalog"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Commodity / Product"
        disabled={disabled}
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-500"
      />
      <datalist id="invoice-approval-product-catalog">
        {itemsData.map((item) => (
          <option key={`${item.name}-${item.hsn}`} value={item.name}>
            {item.hsn}
          </option>
        ))}
      </datalist>
    </div>
  );
}

function DraftField({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  );
}

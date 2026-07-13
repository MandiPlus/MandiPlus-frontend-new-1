'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  PaperClipIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminLedgerUser,
  AdminQuickDetail,
  AdminQuickDetailMedia,
  adminApi,
} from '@/features/admin/api/admin.api';
import { getHsnForProduct, itemsData } from '@/features/insurance/productCatalog';
import { getVehicleRecentInvoiceStatus } from '@/features/insurance/api';

type InvoiceKind = 'cash' | 'commission';

type QuickInvoiceForm = {
  invoiceKind: InvoiceKind;
  insuredUserId: string;
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
  ownerName: string;
  insuredPartyPhone: string;
  driverPhone: string;
  driverSecondaryPhone: string;
};

const INDIAN_PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;
const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500';
const fileFieldClass = `${fieldClass} cursor-pointer p-0 text-slate-500 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-slate-200 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-200`;
const labelClass = 'block text-xs font-bold uppercase tracking-wide text-slate-600';

const emptyForm = (): QuickInvoiceForm => ({
  invoiceKind: 'cash',
  insuredUserId: '',
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
  ownerName: '',
  insuredPartyPhone: '',
  driverPhone: '',
  driverSecondaryPhone: '',
});

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhone(value?: string | null) {
  const cleaned = String(value || '').replace(/\D/g, '');
  if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  return value || '-';
}

function formatDuration(milliseconds?: number | null) {
  const seconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function normalizePhoneInput(value: string) {
  return value.replace(/[^\d+]/g, '').trim();
}

function isValidIndianPhone(value: string) {
  return INDIAN_PHONE_REGEX.test(value.trim());
}

function normalizeVehicleText(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function userAddressText(user?: Partial<AdminLedgerUser> | null) {
  if (!user) return '';
  const userRecord = user as Partial<AdminLedgerUser> & Record<string, unknown>;
  const fields = ['destinationShopAddress', 'loadingPoint', 'officeAddress', 'destinationAddress', 'route', 'mandiName'];
  for (const field of fields) {
    const lines = normalizeLines(userRecord[field]);
    if (lines.length > 0) return lines.join('\n');
  }
  return String(user.state || '').replace(/_/g, ' ');
}

function userPlaceOfSupply(user?: Partial<AdminLedgerUser> | null) {
  return userAddressText(user).split('\n').find(Boolean) || String(user?.state || '').replace(/_/g, ' ');
}

function applyInsuredUser(form: QuickInvoiceForm, user: AdminLedgerUser | null): QuickInvoiceForm {
  const address = userAddressText(user);
  const base = {
    ...form,
    insuredUserId: user?.id || '',
    insuredPartyPhone: user?.mobileNumber || form.insuredPartyPhone,
    placeOfSupply: form.placeOfSupply || userPlaceOfSupply(user),
  };
  if (form.invoiceKind === 'cash') {
    return {
      ...base,
      billToName: user?.name || '',
      billToAddress: address,
      shipToName: user?.name || '',
      shipToAddress: address,
    };
  }
  return {
    ...base,
    supplierName: user?.name || '',
    supplierAddress: address,
  };
}

function MediaTile({ media }: { media: AdminQuickDetailMedia }) {
  if (media.kind === 'image') {
    return (
      <a href={media.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.url} alt={media.name || 'Quick detail image'} className="h-40 w-full object-cover" />
      </a>
    );
  }

  if (media.kind === 'audio') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-600">
          <MicrophoneIcon className="h-4 w-4" />
          Voice note
        </div>
        <audio controls src={media.url} className="w-full" />
      </div>
    );
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-20 items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
    >
      <DocumentTextIcon className="h-5 w-5 shrink-0 text-slate-500" />
      <span className="min-w-0 truncate">{media.name || (media.kind === 'pdf' ? 'PDF' : 'File')}</span>
    </a>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value || '-'}</p>
    </div>
  );
}

export default function AdminQuickDetailDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const [detail, setDetail] = useState<AdminQuickDetail | null>(null);
  const [verifiedUsers, setVerifiedUsers] = useState<AdminLedgerUser[]>([]);
  const [form, setForm] = useState<QuickInvoiceForm>(() => emptyForm());
  const [weighmentSlips, setWeighmentSlips] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedInsuredUser = useMemo(
    () => verifiedUsers.find((user) => user.id === form.insuredUserId) || null,
    [form.insuredUserId, verifiedUsers],
  );

  const updateForm = (patch: Partial<QuickInvoiceForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const loadPage = useCallback(async () => {
    if (!isAuthenticated || !canAccessSection('app-quick-details') || !params?.id) return;
    setLoading(true);
    setError(null);
    const [detailResponse, usersResponse] = await Promise.all([
      adminApi.getAdminQuickDetail(params.id),
      adminApi.getAdminLedgerUsers(),
    ]);

    if (!detailResponse.success || !detailResponse.data) {
      setError(detailResponse.message || 'Failed to load quick detail.');
      setLoading(false);
      return;
    }

    const users = usersResponse.success && Array.isArray(usersResponse.data)
      ? usersResponse.data
          .filter((user) => user.isLedgerMasterVerified && !user.isMerged && user.id === user.canonicalUserId)
          .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
      : [];

    const matchedUser = users.find((user) => user.id === detailResponse.data?.user?.id) || null;
    setVerifiedUsers(users);
    setDetail(detailResponse.data);
    setForm((current) => applyInsuredUser(current, matchedUser));
    setLoading(false);
  }, [canAccessSection, isAuthenticated, params?.id]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handleProductChange = (productName: string) => {
    updateForm({ productName, hsnCode: getHsnForProduct(productName) });
  };

  const handleInvoiceKindChange = (invoiceKind: InvoiceKind) => {
    setForm((current) => applyInsuredUser({ ...current, invoiceKind }, selectedInsuredUser));
  };

  const validateVehicle = async (vehicleNumber: string) => {
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to verify recent vehicle invoice status.');
    }
  };

  const handleSubmit = async () => {
    const insuredUser = selectedInsuredUser;
    if (!insuredUser) {
      toast.error('Select a registered verified insured party.');
      return;
    }

    const qty = Number(form.quantity || 0);
    const rate = Number(form.rate || 0);
    const amount = Number((qty * rate).toFixed(2));
    if (!form.supplierName.trim() || !form.billToName.trim()) {
      toast.error('Supplier and bill-to details are required.');
      return;
    }
    if (!form.productName.trim() || qty <= 0 || rate <= 0) {
      toast.error('Fill product, quantity, and rate before creating invoice.');
      return;
    }
    if (!isValidIndianPhone(form.insuredPartyPhone)) {
      toast.error('Insured party phone must be a valid Indian mobile number.');
      return;
    }

    const normalizedDriverPhone = normalizePhoneInput(form.driverPhone);
    const normalizedDriverSecondaryPhone = normalizePhoneInput(form.driverSecondaryPhone);
    if (form.driverPhone.trim() && !isValidIndianPhone(form.driverPhone)) {
      toast.error('Driver mobile number must be a valid Indian mobile number.');
      return;
    }
    if (form.driverSecondaryPhone.trim() && !isValidIndianPhone(form.driverSecondaryPhone)) {
      toast.error('Alternate driver mobile number must be a valid Indian mobile number.');
      return;
    }
    if (normalizedDriverPhone && normalizedDriverSecondaryPhone && normalizedDriverPhone === normalizedDriverSecondaryPhone) {
      toast.error('Alternate driver mobile number must be different from primary driver number.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await adminApi.createAdminInvoice({
        userId: insuredUser.id,
        customerUserId: insuredUser.id,
        buyerUserId: form.invoiceKind === 'cash' ? insuredUser.id : undefined,
        supplierUserId: form.invoiceKind === 'commission' ? insuredUser.id : undefined,
        invoiceDate: form.invoiceDate,
        invoiceType: form.invoiceKind === 'cash' ? 'BUYER_INVOICE' : 'SUPPLIER_INVOICE',
        supplierName: form.supplierName.trim(),
        supplierAddress: normalizeLines(form.supplierAddress),
        placeOfSupply: form.placeOfSupply.trim() || userPlaceOfSupply(insuredUser),
        billToName: form.billToName.trim(),
        billToAddress: normalizeLines(form.billToAddress),
        shipToName: form.shipToName.trim(),
        shipToAddress: normalizeLines(form.shipToAddress),
        productName: form.productName.trim(),
        hsnCode: form.hsnCode.trim() || undefined,
        quantity: qty,
        rate,
        amount,
        vehicleNumber: normalizeVehicleText(form.vehicleNumber),
        truckNumber: normalizeVehicleText(form.vehicleNumber),
        ownerName: form.ownerName.trim() || undefined,
        insuredPartyPhone: normalizePhoneInput(form.insuredPartyPhone),
        driverPhone: normalizedDriverPhone || undefined,
        driverSecondaryPhone: normalizedDriverSecondaryPhone || undefined,
        weighmentSlipNote: form.invoiceKind === 'cash' ? 'cash' : 'commission',
        sourceSurface: 'ADMIN_QUICK_DETAILS',
        weighmentSlips,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to create invoice');
      }

      toast.success('Invoice created. It will show in insurance forms.');
      router.push('/admin/insurance-forms');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!detail || !window.confirm(`Delete quick detail from ${detail.user?.name || 'this user'}?`)) return;
    setDeleting(true);
    const response = await adminApi.deleteAdminQuickDetail(detail.id);
    setDeleting(false);
    if (!response.success) {
      toast.error(response.message || 'Failed to delete quick detail.');
      return;
    }
    toast.success('Quick detail deleted.');
    router.push('/admin/quick-details');
  };

  if (!authLoading && (!isAuthenticated || !canAccessSection('app-quick-details'))) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          You do not have access to Quick Details.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4 text-sm font-bold text-slate-500">Loading quick detail</div>;
  }

  if (error || !detail) {
    return (
      <div className="p-4">
        <button type="button" onClick={() => router.push('/admin/quick-details')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error || 'Quick detail not found.'}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" onClick={() => router.push('/admin/quick-details')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950">
              <ArrowLeftIcon className="h-4 w-4" />
              Quick Details
            </button>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Create invoice from quick detail</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">Submitted {formatDateTime(detail.createdAt)}</p>
          </div>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Invoice form</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Same invoice fields used by the insurance flow.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
              {form.invoiceKind === 'cash' ? 'Cash' : 'Commission'}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Invoice type
              <select value={form.invoiceKind} onChange={(event) => handleInvoiceKindChange(event.target.value as InvoiceKind)} className={fieldClass}>
                <option value="cash">Cash</option>
                <option value="commission">Commission</option>
              </select>
            </label>
            <label className={labelClass}>
              Invoice date
              <input type="date" value={form.invoiceDate} onChange={(event) => updateForm({ invoiceDate: event.target.value })} className={fieldClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Insured party
              <select
                value={form.insuredUserId}
                onChange={(event) => {
                  const user = verifiedUsers.find((item) => item.id === event.target.value) || null;
                  setForm((current) => applyInsuredUser(current, user));
                }}
                className={fieldClass}
              >
                <option value="">Select registered verified user</option>
                {verifiedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.mobileNumber} {user.walletType === 'UNPAID' ? '(Unpaid)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Driver mobile
              <input inputMode="numeric" value={form.driverPhone} onChange={(event) => updateForm({ driverPhone: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Alternate driver mobile
              <input inputMode="numeric" value={form.driverSecondaryPhone} onChange={(event) => updateForm({ driverSecondaryPhone: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Insured party phone
              <input value={form.insuredPartyPhone} onChange={(event) => updateForm({ insuredPartyPhone: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Place of supply
              <input value={form.placeOfSupply} onChange={(event) => updateForm({ placeOfSupply: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Supplier name
              <input value={form.supplierName} onChange={(event) => updateForm({ supplierName: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Bill to name
              <input value={form.billToName} onChange={(event) => updateForm({ billToName: event.target.value })} className={fieldClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Supplier address
              <textarea value={form.supplierAddress} onChange={(event) => updateForm({ supplierAddress: event.target.value })} rows={2} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Bill to address
              <textarea value={form.billToAddress} onChange={(event) => updateForm({ billToAddress: event.target.value })} rows={2} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Ship to address
              <textarea value={form.shipToAddress} onChange={(event) => updateForm({ shipToAddress: event.target.value })} rows={2} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Ship to name
              <input value={form.shipToName} onChange={(event) => updateForm({ shipToName: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Product
              <select value={form.productName} onChange={(event) => handleProductChange(event.target.value)} className={fieldClass}>
                <option value="">Select product</option>
                {itemsData.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              HSN
              <input value={form.hsnCode} onChange={(event) => updateForm({ hsnCode: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Quantity
              <input type="number" step="0.01" value={form.quantity} onChange={(event) => updateForm({ quantity: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Rate
              <input type="number" step="0.01" value={form.rate} onChange={(event) => updateForm({ rate: event.target.value })} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Vehicle number
              <input value={form.vehicleNumber} onChange={(event) => updateForm({ vehicleNumber: event.target.value })} onBlur={(event) => validateVehicle(event.target.value)} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Owner name
              <input value={form.ownerName} onChange={(event) => updateForm({ ownerName: event.target.value })} className={fieldClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Weighment slip / supporting files
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(event) => setWeighmentSlips(Array.from(event.target.files || []))}
                className={fileFieldClass}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Amount</p>
              <p className="text-lg font-black text-slate-950">
                {((Number(form.quantity) || 0) * (Number(form.rate) || 0)).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                })}
              </p>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? 'Creating invoice...' : 'Create invoice'}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">User provided details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <DetailField label="User" value={detail.user?.name || 'Unknown user'} />
              <DetailField label="Mobile" value={formatPhone(detail.user?.mobileNumber)} />
              <DetailField label="Identity" value={detail.user?.identity || '-'} />
              <DetailField label="State" value={detail.user?.state || '-'} />
              <DetailField label="Submitted" value={formatDateTime(detail.createdAt)} />
              {detail.audioDurationMillis ? <DetailField label="Voice duration" value={formatDuration(detail.audioDurationMillis)} /> : null}
            </div>
            {detail.details ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Details</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">{detail.details}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <PaperClipIcon className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-black text-slate-950">Attachments</h2>
            </div>
            {detail.media?.length ? (
              <div className="mt-4 grid gap-3">
                {detail.media.map((media, index) => (
                  <MediaTile key={`${detail.id}-${media.url}-${index}`} media={media} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-bold text-slate-500">No attachments provided.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

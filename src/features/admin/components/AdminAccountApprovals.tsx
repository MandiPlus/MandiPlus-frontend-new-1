'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { adminApi, AdminAccountRow } from '../api/admin.api';
import { ADMIN_NAV_ITEMS } from '../access';
import { useAdmin } from '../context/AdminContext';

const assignableSections = ADMIN_NAV_ITEMS
  .filter((item) => item.section !== 'app-invoices')
  .map((item) => ({
    value: item.section,
    label: item.name,
  }));
const ALL_SECTION_VALUES = assignableSections.map((item) => item.value);
const FULL_ACCESS_VALUE = '__full_access__';

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN');
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

function getActionAvailability(status: AdminAccountRow['status']) {
  return {
    canEditSections: status === 'PENDING' || status === 'APPROVED',
    canApprove: status === 'PENDING',
    canReject: status === 'PENDING',
    canSuspend: status === 'APPROVED',
    canUpdateAccess: status === 'APPROVED',
  };
}

function isFullAccessSelection(sections: string[]) {
  return ALL_SECTION_VALUES.every((section) => sections.includes(section));
}

function getSectionSummaryLabel(sections: string[]) {
  if (sections.length === 0) return 'Select sections';
  if (isFullAccessSelection(sections)) return 'Full Access';
  return `${sections.length} section${sections.length > 1 ? 's' : ''} selected`;
}

export default function AdminAccountApprovals({
  searchTerm,
}: {
  searchTerm: string;
}) {
  const { accessProfile } = useAdmin();
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string[]>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [openSectionPickerId, setOpenSectionPickerId] = useState<string | null>(null);

  const isFullAdmin = Boolean(accessProfile?.isFullAdmin);

  const loadAccounts = async () => {
    const response = await adminApi.getAdminAccounts();
    if (!response.success || !Array.isArray(response.data)) {
      toast.error(response.message || 'Failed to load admin account requests');
      setLoading(false);
      return;
    }

    setAccounts(response.data);
    setSectionDrafts(
      Object.fromEntries(
        response.data.map((account) => [account.id, account.assignedSections || []]),
      ),
    );
    setRejectionReasons(
      Object.fromEntries(
        response.data.map((account) => [account.id, account.rejectionReason || '']),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!isFullAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void loadAccounts();
  }, [isFullAdmin]);

  const filteredAccounts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return accounts;

    return accounts.filter((account) =>
      [
        account.fullName,
        account.username,
        account.mobileNumber,
        account.requestedRole,
        account.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [accounts, searchTerm]);

  const pendingCount = useMemo(
    () => accounts.filter((account) => account.status === 'PENDING').length,
    [accounts],
  );

  const toggleSection = (accountId: string, section: string) => {
    setSectionDrafts((prev) => {
      const current = prev[accountId] || [];

      if (section === FULL_ACCESS_VALUE) {
        return {
          ...prev,
          [accountId]: isFullAccessSelection(current) ? [] : [...ALL_SECTION_VALUES],
        };
      }

      return {
        ...prev,
        [accountId]: current.includes(section)
          ? current.filter((item) => item !== section)
          : [...current, section],
      };
    });
  };

  const updateStatus = async (
    account: AdminAccountRow,
    status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    successMessage?: string,
  ) => {
    setSavingId(account.id);
    const response = await adminApi.updateAdminAccountApproval(account.id, {
      status,
      assignedSections: status === 'APPROVED' ? sectionDrafts[account.id] || [] : undefined,
      rejectionReason:
        status === 'REJECTED' ? rejectionReasons[account.id]?.trim() || 'Rejected by admin' : undefined,
    });
    setSavingId(null);

    if (!response.success) {
      toast.error(response.message || 'Failed to update admin account');
      return;
    }

    toast.success(
      successMessage ||
        (status === 'APPROVED'
          ? 'Admin account approved'
          : status === 'REJECTED'
            ? 'Admin account rejected'
            : 'Admin account suspended'),
    );
    setOpenSectionPickerId(null);
    await loadAccounts();
  };

  if (!isFullAdmin) {
    return null;
  }

  return (
    <div className="mt-8 flex flex-col">
      <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Admin Requests</h2>
                <p className="text-sm text-slate-600">
                  Review limited-admin requests and manage their dashboard permissions.
                </p>
              </div>
              <div className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                Pending: {pendingCount}
              </div>
            </div>

            {loading ? (
              <div className="px-5 py-8 text-sm text-slate-500">Loading requests...</div>
            ) : filteredAccounts.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-500">No admin requests found.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Username</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Mobile</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Mapped Role</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Allowed Sections</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Requested On</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Reviewed On</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Rejection Reason</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAccounts.map((account) => {
                    const selectedSections = sectionDrafts[account.id] || [];
                    const hasFullAccess = isFullAccessSelection(selectedSections);
                    const pickerOpen = openSectionPickerId === account.id;
                    const actionAvailability = getActionAvailability(account.status);
                    const sectionsChanged =
                      JSON.stringify([...selectedSections].sort()) !==
                      JSON.stringify([...(account.assignedSections || [])].sort());

                    return (
                      <tr key={account.id} className="align-top">
                        <td className="px-4 py-4 text-sm text-slate-900">{account.fullName}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{account.username}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{account.mobileNumber || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{account.requestedRole}</td>
                        <td className="px-4 py-4 text-sm">
                          <span
                            className={classNames(
                              'rounded-full px-2.5 py-1 text-xs font-semibold',
                              account.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : account.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-700'
                                  : account.status === 'SUSPENDED'
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-amber-100 text-amber-700',
                            )}
                          >
                            {account.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <div className="relative min-w-[240px]">
                            <button
                              type="button"
                              disabled={!actionAvailability.canEditSections}
                              onClick={() =>
                                setOpenSectionPickerId((prev) => (prev === account.id ? null : account.id))
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {getSectionSummaryLabel(selectedSections)}
                            </button>
                            {pickerOpen ? (
                              <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                <label
                                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={hasFullAccess}
                                    disabled={!actionAvailability.canEditSections}
                                    onChange={() => toggleSection(account.id, FULL_ACCESS_VALUE)}
                                  />
                                  <span>Full Access</span>
                                </label>
                                <div className="my-1 border-t border-slate-100" />
                                {assignableSections.map((section) => (
                                  <label
                                    key={section.value}
                                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedSections.includes(section.value)}
                                      disabled={!actionAvailability.canEditSections}
                                      onChange={() => toggleSection(account.id, section.value)}
                                    />
                                    <span>{section.label}</span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                            {selectedSections.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {hasFullAccess ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                    Full Access
                                  </span>
                                ) : (
                                  selectedSections.map((section) => {
                                    const label =
                                      assignableSections.find((item) => item.value === section)?.label || section;
                                    return (
                                      <span
                                        key={section}
                                        className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                      >
                                        {label}
                                      </span>
                                    );
                                  })
                                )}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDateTime(account.createdAt)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDateTime(account.approvedAt)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <input
                            type="text"
                            value={rejectionReasons[account.id] || ''}
                            disabled={!actionAvailability.canReject}
                            onChange={(event) =>
                              setRejectionReasons((prev) => ({
                                ...prev,
                                [account.id]: event.target.value,
                              }))
                            }
                            placeholder="Optional note"
                            className="w-full min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-[220px] flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={savingId === account.id || !actionAvailability.canApprove}
                              onClick={() => void updateStatus(account, 'APPROVED')}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={savingId === account.id || !actionAvailability.canReject}
                              onClick={() => void updateStatus(account, 'REJECTED')}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={savingId === account.id || !actionAvailability.canSuspend}
                              onClick={() => void updateStatus(account, 'SUSPENDED')}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                            >
                              Suspend
                            </button>
                            <button
                              type="button"
                              disabled={
                                savingId === account.id ||
                                !actionAvailability.canUpdateAccess ||
                                !sectionsChanged
                              }
                              onClick={() =>
                                void updateStatus(
                                  account,
                                  'APPROVED',
                                  'Admin access updated',
                                )
                              }
                              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              Update Access
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

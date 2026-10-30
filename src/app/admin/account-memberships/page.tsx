'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  AdminLedgerUser,
  CustomerAccountMembership,
  CustomerAccountMembershipStatus,
  CustomerAccountRole,
  adminApi,
} from '@/features/admin/api/admin.api';

const roles: Array<{ value: CustomerAccountRole; label: string }> = [
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'OWNER', label: 'Owner' },
];

const statusClasses: Record<CustomerAccountMembershipStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INVITED: 'bg-blue-50 text-blue-700 ring-blue-200',
  SUSPENDED: 'bg-amber-50 text-amber-800 ring-amber-200',
  REVOKED: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getUserId(user?: AdminLedgerUser | null) {
  return user?.id || user?._id || '';
}

function displayName(user?: AdminLedgerUser | CustomerAccountMembership['memberUser'] | null) {
  return user?.name || 'Unnamed user';
}

function formatPhone(value?: string | null) {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return value;
}

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

function StatusPill({ status }: { status: CustomerAccountMembershipStatus }) {
  return (
    <span className={classNames('inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1', statusClasses[status])}>
      {status}
    </span>
  );
}

function UserResultButton({
  user,
  onSelect,
  disabled,
  note,
}: {
  user: AdminLedgerUser;
  onSelect: (user: AdminLedgerUser) => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(user)}
      className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-55"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100">
        <UserCircleIcon className="h-5 w-5 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{displayName(user)}</p>
        <p className="text-xs font-semibold text-slate-500">
          {formatPhone(user.mobileNumber)} {user.identity ? `| ${user.identity}` : ''}
          {user.state ? ` | ${user.state}` : ''}
        </p>
      </div>
      {note ? <span className="shrink-0 text-xs font-bold text-slate-400">{note}</span> : null}
      {user.isLedgerMasterVerified ? <ShieldCheckIcon className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
    </button>
  );
}

function UserSearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-[#4309ac] focus-within:ring-2 focus-within:ring-[#4309ac]/15">
      <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-slate-400" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

function PrimaryAccountSelector({
  query,
  selectedAccount,
  results,
  loading,
  onQueryChange,
  onSelect,
  onClear,
}: {
  query: string;
  selectedAccount: AdminLedgerUser | null;
  results: AdminLedgerUser[];
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (user: AdminLedgerUser) => void;
  onClear: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.08em] text-slate-700">Primary account</h2>
            {selectedAccount ? (
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {displayName(selectedAccount)} | {formatPhone(selectedAccount.mobileNumber)}
              </p>
            ) : null}
          </div>
          {selectedAccount ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <XMarkIcon className="h-5 w-5" />
              Change
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        {selectedAccount ? (
          <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#4309ac]/10">
              <UserCircleIcon className="h-7 w-7 text-[#4309ac]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-slate-950">{displayName(selectedAccount)}</p>
              <p className="text-sm font-semibold text-slate-500">
                {formatPhone(selectedAccount.mobileNumber)} {selectedAccount.identity ? `| ${selectedAccount.identity}` : ''}
                {selectedAccount.state ? ` | ${selectedAccount.state}` : ''}
              </p>
            </div>
            {selectedAccount.isLedgerMasterVerified ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                <ShieldCheckIcon className="h-4 w-4" />
                Verified
              </span>
            ) : null}
          </div>
        ) : (
          <div>
            <UserSearchInput
              value={query}
              onChange={onQueryChange}
              placeholder="Search account by name or mobile"
              autoFocus
            />
            <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
              {loading ? (
                <div className="px-3 py-4 text-sm font-semibold text-slate-500">Searching...</div>
              ) : results.length > 0 ? (
                results.map((user) => (
                  <UserResultButton key={getUserId(user)} user={user} onSelect={onSelect} />
                ))
              ) : query.trim().length >= 2 ? (
                <div className="px-3 py-4 text-sm font-semibold text-slate-500">No users found.</div>
              ) : (
                <div className="px-3 py-4 text-sm font-semibold text-slate-500">Type at least 2 characters.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AssignUserPanel({
  open,
  onClose,
  memberQuery,
  onMemberQueryChange,
  memberResults,
  selectedMember,
  onSelectMember,
  onClearMember,
  loading,
  role,
  onRoleChange,
  onSubmit,
  submitting,
  selectedAccountId,
  linkedMemberIds,
}: {
  open: boolean;
  onClose: () => void;
  memberQuery: string;
  onMemberQueryChange: (value: string) => void;
  memberResults: AdminLedgerUser[];
  selectedMember: AdminLedgerUser | null;
  onSelectMember: (user: AdminLedgerUser) => void;
  onClearMember: () => void;
  loading: boolean;
  role: CustomerAccountRole;
  onRoleChange: (role: CustomerAccountRole) => void;
  onSubmit: () => void;
  submitting: boolean;
  selectedAccountId: string;
  linkedMemberIds: Set<string>;
}) {
  if (!open) return null;

  const selectedMemberId = getUserId(selectedMember);
  const selectedMemberAlreadyLinked = Boolean(selectedMemberId && linkedMemberIds.has(selectedMemberId));
  const canSubmit =
    Boolean(selectedAccountId) &&
    Boolean(selectedMemberId) &&
    selectedAccountId !== selectedMemberId &&
    !selectedMemberAlreadyLinked &&
    !submitting;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close assign user panel"
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Assign user</h3>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">Select a registered user and role.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">User</label>
              <div className="mt-2">
                {selectedMember ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#4309ac]/10">
                        <UserCircleIcon className="h-6 w-6 text-[#4309ac]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950">{displayName(selectedMember)}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {formatPhone(selectedMember.mobileNumber)} {selectedMember.identity ? `| ${selectedMember.identity}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onClearMember}
                        className="rounded-md p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                    {selectedMemberAlreadyLinked ? (
                      <p className="mt-2 text-xs font-bold text-amber-700">This user is already linked to this account.</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <UserSearchInput
                      value={memberQuery}
                      onChange={onMemberQueryChange}
                      placeholder="Search user by name or mobile"
                    />
                    <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
                      {loading ? (
                        <div className="px-3 py-4 text-sm font-semibold text-slate-500">Searching...</div>
                      ) : memberResults.length > 0 ? (
                        memberResults.map((user) => {
                          const userId = getUserId(user);
                          const isSelf = userId === selectedAccountId;
                          const isLinked = linkedMemberIds.has(userId);
                          return (
                            <UserResultButton
                              key={userId}
                              user={user}
                              disabled={isSelf || isLinked}
                              note={isSelf ? 'Self' : isLinked ? 'Linked' : undefined}
                              onSelect={onSelectMember}
                            />
                          );
                        })
                      ) : memberQuery.trim().length >= 2 ? (
                        <div className="px-3 py-4 text-sm font-semibold text-slate-500">No users found.</div>
                      ) : (
                        <div className="px-3 py-4 text-sm font-semibold text-slate-500">Type at least 2 characters.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Role</label>
              <select
                value={role}
                onChange={(event) => onRoleChange(event.target.value as CustomerAccountRole)}
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15"
              >
                {roles.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#4309ac] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#360888] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <LinkIcon className="h-5 w-5" />}
            Add user
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function AccountMembershipsPage() {
  const [accountQuery, setAccountQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [accountResults, setAccountResults] = useState<AdminLedgerUser[]>([]);
  const [memberResults, setMemberResults] = useState<AdminLedgerUser[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AdminLedgerUser | null>(null);
  const [selectedMember, setSelectedMember] = useState<AdminLedgerUser | null>(null);
  const [role, setRole] = useState<CustomerAccountRole>('MANAGER');
  const [memberships, setMemberships] = useState<CustomerAccountMembership[]>([]);
  const [loadingAccountSearch, setLoadingAccountSearch] = useState(false);
  const [loadingMemberSearch, setLoadingMemberSearch] = useState(false);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const selectedAccountId = getUserId(selectedAccount);
  const selectedMemberId = getUserId(selectedMember);

  const activeCount = useMemo(
    () => memberships.filter((membership) => membership.status === 'ACTIVE').length,
    [memberships],
  );

  const linkedMemberIds = useMemo(
    () => new Set(memberships.map((membership) => membership.memberUserId)),
    [memberships],
  );

  const runSearch = useCallback(
    async (
      query: string,
      setLoading: (loading: boolean) => void,
      setResults: (users: AdminLedgerUser[]) => void,
    ) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      const response = await adminApi.searchUsers(trimmed, 12);
      setLoading(false);

      if (!response.success) {
        toast.error(response.message || 'User search failed');
        setResults([]);
        return;
      }

      setResults(response.data || []);
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedAccount) {
        void runSearch(accountQuery, setLoadingAccountSearch, setAccountResults);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [accountQuery, runSearch, selectedAccount]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (assignOpen && !selectedMember) {
        void runSearch(memberQuery, setLoadingMemberSearch, setMemberResults);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [assignOpen, memberQuery, runSearch, selectedMember]);

  const loadMemberships = useCallback(async () => {
    if (!selectedAccountId) {
      setMemberships([]);
      return;
    }

    setLoadingMemberships(true);
    const response = await adminApi.getCustomerAccountMemberships(selectedAccountId);
    setLoadingMemberships(false);

    if (!response.success) {
      toast.error(response.message || 'Failed to load memberships');
      setMemberships([]);
      return;
    }

    setMemberships(response.data || []);
  }, [selectedAccountId]);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  const resetAssignForm = () => {
    setSelectedMember(null);
    setMemberQuery('');
    setMemberResults([]);
    setRole('MANAGER');
  };

  const closeAssignPanel = () => {
    setAssignOpen(false);
    resetAssignForm();
  };

  const handleAttach = async () => {
    if (!selectedAccountId || !selectedMemberId) {
      toast.error('Select a user first');
      return;
    }

    if (selectedAccountId === selectedMemberId) {
      toast.error('Select a different user');
      return;
    }

    if (linkedMemberIds.has(selectedMemberId)) {
      toast.error('This user is already linked');
      return;
    }

    setSubmitting(true);
    const response = await adminApi.createCustomerAccountMembership({
      accountUserId: selectedAccountId,
      memberUserId: selectedMemberId,
      role,
    });
    setSubmitting(false);

    if (!response.success) {
      toast.error(response.message || 'Failed to assign user');
      return;
    }

    toast.success('User assigned');
    closeAssignPanel();
    await loadMemberships();
  };

  const updateMembership = async (
    membership: CustomerAccountMembership,
    payload: Partial<{
      role: CustomerAccountRole;
      status: CustomerAccountMembershipStatus;
      isDefault: boolean;
    }>,
  ) => {
    setUpdatingId(membership.id);
    const response = await adminApi.updateCustomerAccountMembership(membership.id, payload);
    setUpdatingId(null);

    if (!response.success) {
      toast.error(response.message || 'Failed to update membership');
      return;
    }

    await loadMemberships();
  };

  const revokeMembership = async (membership: CustomerAccountMembership) => {
    setUpdatingId(membership.id);
    const response = await adminApi.revokeCustomerAccountMembership(membership.id);
    setUpdatingId(null);

    if (!response.success) {
      toast.error(response.message || 'Failed to revoke membership');
      return;
    }

    toast.success('Membership revoked');
    await loadMemberships();
  };

  return (
    <div className="space-y-4 py-4">
      <PrimaryAccountSelector
        query={accountQuery}
        selectedAccount={selectedAccount}
        results={accountResults}
        loading={loadingAccountSearch}
        onQueryChange={(value) => {
          setAccountQuery(value);
          setSelectedAccount(null);
        }}
        onSelect={(user) => {
          setSelectedAccount(user);
          setAccountQuery(`${user.name || ''} ${user.mobileNumber || ''}`.trim());
          setAccountResults([]);
        }}
        onClear={() => {
          setSelectedAccount(null);
          setAccountQuery('');
          setAccountResults([]);
          setMemberships([]);
          closeAssignPanel();
        }}
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.08em] text-slate-700">Members</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {selectedAccount
                ? `${memberships.length} linked | ${activeCount} active`
                : 'Select an account'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={loadMemberships}
              disabled={!selectedAccountId || loadingMemberships}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <ArrowPathIcon className={classNames('h-5 w-5', loadingMemberships && 'animate-spin')} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              disabled={!selectedAccountId}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#4309ac] px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-[#360888] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <PlusIcon className="h-5 w-5" />
              Assign user
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-slate-500">Member</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-slate-500">Default</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-slate-500">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.08em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {!selectedAccountId ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                    Search and select a primary account.
                  </td>
                </tr>
              ) : loadingMemberships ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                    Loading memberships...
                  </td>
                </tr>
              ) : memberships.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-slate-100">
                        <LinkIcon className="h-5 w-5 text-slate-500" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-700">No linked users</p>
                      <button
                        type="button"
                        onClick={() => setAssignOpen(true)}
                        className="mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-[#4309ac] px-3 py-2 text-sm font-black text-white hover:bg-[#360888]"
                      >
                        <PlusIcon className="h-5 w-5" />
                        Assign user
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                memberships.map((membership) => {
                  const isSelf = membership.accountUserId === membership.memberUserId;
                  const isUpdating = updatingId === membership.id;
                  const disabled = isUpdating || isSelf;

                  return (
                    <tr key={membership.id} className={classNames(membership.status === 'REVOKED' && 'bg-slate-50/70')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100">
                            <UserCircleIcon className="h-5 w-5 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-950">
                              {displayName(membership.memberUser)} {isSelf ? '(self)' : ''}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              {formatPhone(membership.memberUser?.mobileNumber)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={membership.role}
                          disabled={disabled || membership.status === 'REVOKED'}
                          onChange={(event) =>
                            void updateMembership(membership, {
                              role: event.target.value as CustomerAccountRole,
                            })
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {roles.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={membership.status} />
                      </td>
                      <td className="px-4 py-3">
                        {membership.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#4309ac]/10 px-2 py-1 text-xs font-bold text-[#4309ac]">
                            <CheckCircleIcon className="h-4 w-4" />
                            Default
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-500">
                        {formatDateTime(membership.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {membership.status === 'ACTIVE' ? (
                            <>
                              <button
                                type="button"
                                disabled={isUpdating || membership.isDefault}
                                onClick={() => void updateMembership(membership, { isDefault: true })}
                                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                              >
                                Make default
                              </button>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => void updateMembership(membership, { status: 'SUSPENDED' })}
                                className="rounded-md border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-300"
                              >
                                Suspend
                              </button>
                            </>
                          ) : membership.status === 'SUSPENDED' || membership.status === 'REVOKED' ? (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => void updateMembership(membership, { status: 'ACTIVE', isDefault: true })}
                              className="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              Reactivate
                            </button>
                          ) : null}

                          <button
                            type="button"
                            disabled={disabled || membership.status === 'REVOKED'}
                            onClick={() => void revokeMembership(membership)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            <NoSymbolIcon className="h-4 w-4" />
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AssignUserPanel
        open={assignOpen}
        onClose={closeAssignPanel}
        memberQuery={memberQuery}
        onMemberQueryChange={(value) => {
          setMemberQuery(value);
          setSelectedMember(null);
        }}
        memberResults={memberResults}
        selectedMember={selectedMember}
        onSelectMember={(user) => {
          setSelectedMember(user);
          setMemberQuery(`${user.name || ''} ${user.mobileNumber || ''}`.trim());
          setMemberResults([]);
        }}
        onClearMember={() => {
          setSelectedMember(null);
          setMemberQuery('');
          setMemberResults([]);
        }}
        loading={loadingMemberSearch}
        role={role}
        onRoleChange={setRole}
        onSubmit={handleAttach}
        submitting={submitting}
        selectedAccountId={selectedAccountId}
        linkedMemberIds={linkedMemberIds}
      />
    </div>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  createTrackingChild,
  deleteTrackingChild,
  listTrackingChildren,
  searchTrackingChildInsuredUsers,
  TrackingChildInsuredUser,
  TrackingNotifyChildRow,
  updateTrackingChild,
} from '@/features/admin/api/tracking.api';

export default function TrackingChildrenPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackingChildInsuredUser[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [selectedInsured, setSelectedInsured] =
    useState<TrackingChildInsuredUser | null>(null);

  const [children, setChildren] = useState<TrackingNotifyChildRow[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [childPhone, setChildPhone] = useState('');
  const [childLabel, setChildLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const loadChildren = useCallback(async (insuredUserId: string) => {
    setLoadingChildren(true);
    setError('');
    const response = await listTrackingChildren({ insuredUserId });
    if (!response.success || !response.data) {
      setError(response.message || 'Failed to load children');
      setChildren([]);
      setLoadingChildren(false);
      return;
    }
    setChildren(response.data);
    setLoadingChildren(false);
  }, []);

  useEffect(() => {
    if (!selectedInsured?.id) {
      setChildren([]);
      return;
    }
    void loadChildren(selectedInsured.id);
  }, [selectedInsured?.id, loadChildren]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const response = await searchTrackingChildInsuredUsers(q, 15);
      if (response.success && response.data) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
      setSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onSelectInsured = (user: TrackingChildInsuredUser) => {
    setSelectedInsured(user);
    setSearchQuery(`${user.name} · ${user.mobileNumber}`);
    setSearchResults([]);
    setError('');
    setSuccess('');
  };

  const onAddChild = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedInsured) {
      setError('Select an insured person first');
      return;
    }
    const phone = childPhone.trim();
    if (!phone) {
      setError('Enter a colleague mobile number');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    const response = await createTrackingChild({
      insuredUserId: selectedInsured.id,
      phone,
      label: childLabel.trim() || undefined,
    });
    setSaving(false);

    if (!response.success) {
      setError(response.message || 'Failed to add number');
      return;
    }

    setChildPhone('');
    setChildLabel('');
    setSuccess('Colleague number added for vehicle tracking WhatsApp only');
    await loadChildren(selectedInsured.id);
  };

  const onToggleActive = async (child: TrackingNotifyChildRow) => {
    setError('');
    setSuccess('');
    const response = await updateTrackingChild(child.id, {
      isActive: !child.isActive,
    });
    if (!response.success) {
      setError(response.message || 'Failed to update');
      return;
    }
    if (selectedInsured) {
      await loadChildren(selectedInsured.id);
    }
  };

  const onRemove = async (child: TrackingNotifyChildRow) => {
    if (
      !window.confirm(
        `Remove ${child.phone} from tracking WhatsApp for this insured person?`,
      )
    ) {
      return;
    }
    setError('');
    setSuccess('');
    const response = await deleteTrackingChild(child.id);
    if (!response.success) {
      setError(response.message || 'Failed to remove');
      return;
    }
    setSuccess('Removed');
    if (selectedInsured) {
      await loadChildren(selectedInsured.id);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#4309ac] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-1 py-2">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Add Children
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Attach colleague numbers under an insured person. They receive the
          same vehicle tracking WhatsApp only — never invoices or payment links.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <label
          htmlFor="insured-search"
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Insured person
        </label>
        <input
          id="insured-search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setSelectedInsured(null);
          }}
          placeholder="Search by name or mobile"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-[#4309ac]/40 placeholder:text-slate-300 focus:ring-2"
        />
        {searching ? (
          <p className="mt-2 text-xs text-slate-400">Searching…</p>
        ) : null}
        {searchResults.length > 0 && !selectedInsured ? (
          <ul className="mt-3 max-h-56 overflow-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
            {searchResults.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => onSelectInsured(user)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {user.name}
                    </span>
                    <span className="block font-mono text-xs text-slate-500">
                      {user.mobileNumber}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-[#4309ac]">
                    Select
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selectedInsured ? (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Selected:{' '}
            <span className="font-medium">{selectedInsured.name}</span>{' '}
            <span className="font-mono text-slate-500">
              ({selectedInsured.mobileNumber})
            </span>
          </div>
        ) : null}
      </section>

      {selectedInsured ? (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            Add colleague number
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Max 5 active numbers. Not onboarded as app users.
          </p>
          <form onSubmit={onAddChild} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="child-phone"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Mobile number
              </label>
              <input
                id="child-phone"
                value={childPhone}
                onChange={(event) => setChildPhone(event.target.value)}
                placeholder="10-digit mobile"
                inputMode="tel"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none ring-[#4309ac]/40 focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="child-label"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Label (optional)
              </label>
              <input
                id="child-label"
                value={childLabel}
                onChange={(event) => setChildLabel(event.target.value)}
                placeholder="e.g. Godown manager"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none ring-[#4309ac]/40 focus:ring-2"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#4309ac] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Adding…' : 'Add number'}
            </button>
          </form>
        </section>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {selectedInsured ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Attached numbers
            </h2>
            <span className="text-xs text-slate-400">
              {children.filter((c) => c.isActive).length} active /{' '}
              {children.length} total
            </span>
          </div>

          {loadingChildren ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Loading…
            </div>
          ) : children.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              No colleague numbers yet
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {children.map((child) => (
                <li
                  key={child.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-medium text-slate-900">
                      {child.phone}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {child.label || 'No label'} ·{' '}
                      {child.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void onToggleActive(child)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {child.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRemove(child)}
                      className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

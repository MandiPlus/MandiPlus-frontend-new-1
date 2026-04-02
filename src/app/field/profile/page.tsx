'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getFieldProfile, FieldProfile } from '@/features/field/api';
import { useAuth } from '@/features/auth/context/AuthContext';

export default function FieldProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<FieldProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError('');
        setProfile(await getFieldProfile());
      } catch (error: unknown) {
        setError(
          axios.isAxiosError(error)
            ? error.response?.data?.message || 'Failed to load profile'
            : 'Failed to load profile',
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  if (loading) {
    return (
      <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'Unable to load profile'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          My profile
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {profile.user.name}
        </h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Mobile</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {profile.user.mobileNumber}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Role</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {profile.role.replace('_', ' ')}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">State</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {profile.user.state}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Access</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {profile.accessPending ? 'Pending admin assignment' : 'Active'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

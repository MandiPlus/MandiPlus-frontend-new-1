'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  LinkIcon,
  ShieldCheckIcon,
  TrashIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  associateLiveVehicle,
  createDeveloperTestInvoice,
  DeveloperTestInvoice,
  getLiveVehicles,
  getVehicleAssociations,
  LiveVehicle,
  removeVehicleAssociation,
  VehicleAssociation,
} from '@/features/admin/api/developer-tools.api';

function errorMessage(error: unknown) {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return value?.response?.data?.message || value?.message || 'Something went wrong';
}

function cleanMobile(value: string) {
  return value.replace(/\D/g, '').slice(-10);
}

export default function DeveloperToolsPage() {
  const [mobile, setMobile] = useState('');
  const [invoice, setInvoice] = useState<DeveloperTestInvoice | null>(null);
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [associations, setAssociations] = useState<VehicleAssociation[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [associating, setAssociating] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  const normalizedMobile = cleanMobile(mobile);
  const validMobile = /^[6-9]\d{9}$/.test(normalizedMobile);
  const chosenTrip = useMemo(
    () => vehicles.find((vehicle) => vehicle.vehicleNumber === selectedVehicle),
    [selectedVehicle, vehicles],
  );

  const refreshVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    try {
      const rows = await getLiveVehicles();
      setVehicles(rows);
      setSelectedVehicle((current) =>
        rows.length && !rows.some((row) => row.vehicleNumber === current)
          ? rows[0].vehicleNumber
          : current,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    void refreshVehicles();
  }, [refreshVehicles]);

  async function loadAssociations() {
    if (!validMobile) return;
    try {
      setAssociations(await getVehicleAssociations(normalizedMobile));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleCreateInvoice() {
    if (!validMobile) return toast.error('Enter a valid 10-digit mobile number');
    setCreatingInvoice(true);
    try {
      const created = await createDeveloperTestInvoice(normalizedMobile);
      setInvoice(created);
      toast.success(`${created.invoiceNumber} created`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCreatingInvoice(false);
    }
  }

  async function handleAssociate() {
    if (!validMobile) return toast.error('Enter a valid 10-digit mobile number');
    if (!selectedVehicle) return toast.error('Choose a live vehicle');
    setAssociating(true);
    try {
      const created = await associateLiveVehicle(
        normalizedMobile,
        selectedVehicle,
        durationHours,
      );
      setAssociations((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      toast.success(`${selectedVehicle} is visible in the app`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAssociating(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeVehicleAssociation(id);
      setAssociations((current) => current.filter((item) => item.id !== id));
      toast.success('Vehicle access removed');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Developer tools
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Create test invoices and temporarily show a live vehicle in a user account.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
            <ShieldCheckIcon className="h-4 w-4" />
            No wallet, ownership or profile changes
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="developer-mobile" className="text-sm font-semibold text-slate-800">
            Mobile number
          </label>
          <p className="mt-1 text-xs text-slate-500">
            The invoice and temporary vehicle access will appear in this account.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
              <span className="border-r border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500">+91</span>
              <input
                id="developer-mobile"
                value={mobile}
                onChange={(event) => setMobile(cleanMobile(event.target.value))}
                onBlur={() => void loadAssociations()}
                inputMode="numeric"
                placeholder="9876543210"
                className="w-full rounded-r-lg px-3 py-2.5 text-sm font-medium text-slate-900 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadAssociations()}
              disabled={!validMobile}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load account
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <DocumentTextIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">Create test invoice</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Verified Tender Coconut invoice with ₹5 insurance payable.
                </p>
              </div>
            </div>

            <dl className="mt-5 divide-y divide-slate-100 rounded-lg bg-slate-50 px-4">
              {[
                ['Buyer', 'MandiPlus Test Buyer'],
                ['Supplier', 'MandiPlus Test Supplier'],
                ['Invoice value', '₹2,500'],
                ['Insurance payable', '₹5'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              onClick={() => void handleCreateInvoice()}
              disabled={!validMobile || creatingInvoice}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingInvoice ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <DocumentTextIcon className="h-4 w-4" />
              )}
              {creatingInvoice ? 'Creating…' : 'Create verified invoice'}
            </button>

            {invoice && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-emerald-900">{invoice.invoiceNumber} created</p>
                  <p className="mt-0.5 text-xs text-emerald-700">
                    Verified immediately. PDF generation continues in the background.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <TruckIcon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-950">Show live vehicle</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add temporary app visibility without changing the owner.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void refreshVehicles()}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Refresh live vehicles"
              >
                <ArrowPathIcon className={`h-4 w-4 ${loadingVehicles ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="mt-5">
              <label htmlFor="live-vehicle" className="text-sm font-medium text-slate-700">
                Live vehicle
              </label>
              <select
                id="live-vehicle"
                value={selectedVehicle}
                onChange={(event) => setSelectedVehicle(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {!vehicles.length && <option value="">No live vehicles found</option>}
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.vehicleNumber}>
                    {vehicle.vehicleNumber} · {vehicle.route || vehicle.status}
                  </option>
                ))}
              </select>
            </div>

            {chosenTrip && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <p className="font-medium text-slate-800">
                  {chosenTrip.sourceName || 'Origin'} → {chosenTrip.destinationName || 'Destination'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {chosenTrip.product || 'Live trip'} · {chosenTrip.status}
                </p>
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="access-duration" className="text-sm font-medium text-slate-700">
                Access duration
              </label>
              <select
                id="access-duration"
                value={durationHours}
                onChange={(event) => setDurationHours(Number(event.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value={1}>1 hour</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => void handleAssociate()}
              disabled={!validMobile || !selectedVehicle || associating}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {associating ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <LinkIcon className="h-4 w-4" />
              )}
              {associating ? 'Adding…' : 'Show vehicle in app'}
            </button>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-950">Active vehicle access</h2>
              <p className="mt-0.5 text-xs text-slate-500">Temporary associations for the selected account</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {associations.length}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {!associations.length && (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Enter a mobile number and load the account to view active access.
              </p>
            )}
            {associations.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                    <TruckIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{item.vehicleNumber}</p>
                    <p className="truncate text-xs text-slate-500">
                      {item.userName} · Expires {new Date(item.expiresAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemove(item.id)}
                  className="rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove access to ${item.vehicleNumber}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

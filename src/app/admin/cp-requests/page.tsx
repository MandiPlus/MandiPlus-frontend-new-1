"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  adminApi,
  type ChannelPartnerRequestPayload,
  type ChannelPartnerRequestStatus,
} from "@/features/admin/api/admin.api";
import { useAdmin } from "@/features/admin/context/AdminContext";

const filters: Array<{ value: ChannelPartnerRequestStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(value?: string | null) {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  }
  return value;
}

function statusClass(status: ChannelPartnerRequestStatus) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AdminCpRequestsPage() {
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const [rows, setRows] = useState<ChannelPartnerRequestPayload[]>([]);
  const [status, setStatus] = useState<ChannelPartnerRequestStatus | "ALL">("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const canAccess = canAccessSection("cp-requests") || canAccessSection("channel-partners");

  const loadRequests = useCallback(async () => {
    if (!isAuthenticated || !canAccess) return;
    setLoading(true);
    const response = await adminApi.getChannelPartnerRequests(status);
    if (response.success) {
      setRows(response.data || []);
    } else {
      toast.error(response.message || "Failed to load requests");
    }
    setLoading(false);
  }, [canAccess, isAuthenticated, status]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.name, row.mobileNumber, row.state, row.status, row.user?.name, row.user?.mobileNumber]
        .some((value) => String(value || "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const summary = useMemo(() => ({
    pending: rows.filter((row) => row.status === "PENDING").length,
    approved: rows.filter((row) => row.status === "APPROVED").length,
    rejected: rows.filter((row) => row.status === "REJECTED").length,
  }), [rows]);

  const updateRequest = async (
    request: ChannelPartnerRequestPayload,
    nextStatus: Extract<ChannelPartnerRequestStatus, "APPROVED" | "REJECTED">,
  ) => {
    setUpdatingId(request.id);
    const response = await adminApi.updateChannelPartnerRequest(request.id, nextStatus);
    if (response.success) {
      toast.success(nextStatus === "APPROVED" ? "Channel partner approved" : "Request rejected");
      await loadRequests();
    } else {
      toast.error(response.message || "Failed to update request");
    }
    setUpdatingId(null);
  };

  if (!authLoading && (!isAuthenticated || !canAccess)) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          You do not have access to channel partner requests.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">App requests</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Channel Partner Requests</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Review app-submitted requests and enable partner access only after approval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRequests()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={classNames("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric icon={Clock3} label="Pending" value={summary.pending} tone="amber" />
          <Metric icon={ShieldCheck} label="Approved" value={summary.approved} tone="emerald" />
          <Metric icon={XCircle} label="Rejected" value={summary.rejected} tone="rose" />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatus(item.value)}
                  className={classNames(
                    "rounded-full px-3 py-1.5 text-xs font-bold ring-1",
                    status === item.value
                      ? "bg-slate-950 text-white ring-slate-950"
                      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, phone, state"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-black">Requester</th>
                  <th className="px-4 py-3 text-left font-black">Mobile</th>
                  <th className="px-4 py-3 text-left font-black">State</th>
                  <th className="px-4 py-3 text-left font-black">Submitted</th>
                  <th className="px-4 py-3 text-left font-black">Status</th>
                  <th className="px-4 py-3 text-right font-black">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                      Loading requests...
                    </td>
                  </tr>
                ) : filteredRows.length ? (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-950">{row.name || row.user?.name || "Unnamed user"}</div>
                        <div className="mt-0.5 text-xs font-semibold text-slate-500">User ID {row.userId}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">{formatPhone(row.mobileNumber || row.user?.mobileNumber)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{row.state.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={classNames("inline-flex rounded-md px-2 py-1 text-xs font-black ring-1", statusClass(row.status))}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={updatingId === row.id}
                              onClick={() => void updateRequest(row, "APPROVED")}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === row.id}
                              onClick={() => void updateRequest(row, "REJECTED")}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-right text-xs font-semibold text-slate-500">
                            Reviewed {formatDate(row.reviewedAt)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                      No channel partner requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: number;
  tone: "amber" | "emerald" | "rose";
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value.toLocaleString("en-IN")}</p>
        </div>
        <div className={classNames("rounded-lg p-2 ring-1", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

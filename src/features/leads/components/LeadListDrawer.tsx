"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { getOverviewLeads, type OverviewLead } from "../api";

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONFIRMED_BUYER: "Confirmed buyer",
  INTERESTED: "Interested",
  FOLLOW_UP: "Follow-up",
  DEMO_BOOKED: "Demo booked",
  CONVERTED: "Customer",
  NOT_INTERESTED: "Not interested",
  NOT_REACHABLE: "Not connected",
  NOT_RELEVANT: "Not relevant",
  INVALID: "Wrong number",
};

/**
 * The leads behind a headline number. Every card on the overview is a claim;
 * opening it is how the claim gets checked.
 */
export default function LeadListDrawer({
  title,
  metric,
  from,
  to,
  userId,
  batchId,
  onClose,
}: {
  title: string;
  metric: string;
  from?: string;
  to?: string;
  userId?: string;
  batchId?: string;
  onClose: () => void;
}) {
  const [leads, setLeads] = useState<OverviewLead[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getOverviewLeads({ metric, from, to, userId, batchId })
      .then((res) => {
        // A shape we did not expect should show as empty, not crash the page.
        setLeads(Array.isArray(res?.leads) ? res.leads : []);
        setCount(res?.count ?? 0);
      })
      .catch(() => toast.error("Could not load those leads"))
      .finally(() => setLoading(false));
  }, [metric, from, to, userId, batchId]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? leads.filter((l) =>
        [l.name, l.phone, l.region, l.commodityCode, l.assignee, l.batch]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : leads;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/20"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {loading ? "Loading…" : `${count} lead${count === 1 ? "" : "s"}`}
              {count >= 500 && " · showing the newest 500"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, number, mandi…"
            className="h-9 w-full rounded-full border border-slate-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30"
          />
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="space-y-2 p-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              Nothing matches that
            </p>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="border-b border-slate-100 px-5 py-2 font-semibold">
                    Name
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 font-semibold">
                    Number
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 font-semibold">
                    Commodity
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 font-semibold">
                    Mandi
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 font-semibold">
                    Status
                  </th>
                  <th className="border-b border-slate-100 px-5 py-2 font-semibold">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-50 px-5 py-2.5">
                      <p className="font-medium text-slate-900">{l.name}</p>
                      {l.batch && (
                        <p className="text-[11px] text-slate-400">{l.batch}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-50 px-2 py-2.5 tabular-nums text-slate-600">
                      {l.phone ? (
                        <a
                          href={`tel:${l.phone}`}
                          className="hover:text-[#4309ac]"
                        >
                          {l.phone.replace("+91", "")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="border-b border-slate-50 px-2 py-2.5 capitalize text-slate-600">
                      {l.commodityCode
                        ? l.commodityCode.toLowerCase().replace(/_/g, " ")
                        : "—"}
                    </td>
                    <td className="border-b border-slate-50 px-2 py-2.5 text-slate-600">
                      {l.region ?? "—"}
                    </td>
                    <td className="border-b border-slate-50 px-2 py-2.5 text-slate-600">
                      {STATUS_LABEL[l.status] ?? l.status}
                      {l.attemptCount > 0 && (
                        <span className="text-slate-400">
                          {" "}
                          · {l.attemptCount}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-50 px-5 py-2.5 text-slate-500">
                      {l.assignee ?? "Unassigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

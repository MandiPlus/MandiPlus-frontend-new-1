"use client";

import React from "react";
import Link from "next/link";
import { COMPANY_INFO } from "@/features/landing/landingData";

const coveredItems = [
  "Truck Accident",
  "Theft or Missing Goods",
  "Looting, Protest & Riot",
  "Weather Damage",
  "Driver Fraud",
  "Fire & Natural Disaster",
];

const TermsAndConditionsPage = () => {
  return (
    <div className="min-h-screen bg-[#e0d7fc] px-4 py-8 pb-24" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="max-w-lg mx-auto">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-[#4309ac] hover:text-[#350889] font-medium text-sm px-2 py-1 rounded-lg bg-white/80 border border-[#e0d7fc] hover:bg-white transition mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          <span className="text-[#4309ac]">Terms &amp; Conditions</span>
        </h1>
        <p className="mb-3 text-sm text-slate-500">Last updated: January 2025</p>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          MandiPlus is owned and operated by{" "}
          <strong className="font-semibold text-slate-800">
            {COMPANY_INFO.parent}
          </strong>
          .
        </p>

        {/* What is COVERED? */}
        <div className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50 mb-4">
          <h2 className="text-lg font-bold text-slate-800 mb-3">
            What is <span className="text-[#4309ac]">COVERED?</span>
          </h2>
          <ul className="space-y-2.5">
            {coveredItems.map((item) => (
              <li key={item} className="flex items-center gap-3 text-slate-700 text-sm">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#4309ac]/15 flex items-center justify-center" aria-hidden="true">
                  <svg className="w-3 h-3 text-[#4309ac]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 pt-4 border-t border-slate-100 text-slate-500 text-xs">
            In case of any issue, T&amp;C Apply.
          </p>
        </div>

        {/* General Terms */}
        <div className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50">
          <h2 className="text-base font-semibold text-slate-800 mb-3">General Terms</h2>
          <ul className="space-y-2.5 text-slate-600 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              Coverage is valid only for goods insured under MandiPlus policies.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              Claims must be reported within 24 hours of the incident.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              ENP FARMS PRIVATE LIMITED, operating MandiPlus, reserves the right to verify all claims before settlement.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              False claims may result in policy cancellation and legal action.
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-slate-800 mt-5 mb-2">Instructions to Register Your Claim</h3>
          <p className="text-slate-600 text-sm mb-4">
            In the event of loss or damage which may involve a claim under this insurance, immediate notice should be given to the MandiPlus support team at +91 {COMPANY_INFO.phone}.
          </p>

          <h3 className="text-sm font-semibold text-slate-800 mt-5 mb-2">Documentation of Claims</h3>
          <p className="text-slate-600 text-sm mb-3">
            To enable claims to be dealt with promptly, the Assured or their Agents are advised to submit all available supporting documents without delay, including when applicable:
          </p>
          <ol className="space-y-2 text-slate-600 text-sm list-decimal list-inside">
            <li>Original policy of insurance.</li>
            <li>Original or copy shipping invoices, together with shipping specification and/or weight notes.</li>
            <li>Original Bill of Transport Bilty or Lorry Receipt, Damage Certificate and Letter of Subrogation contract with transporter.</li>
            <li>Survey Report obtained from the insurer company&apos;s representative at the point of discharge or destination or other documentary evidence to show the extent of the loss or damage.</li>
            <li>Landing account and weight notes at final destination.</li>
            <li>Correspondence exchanged with the Carriers and other Parties regarding their liability for the loss or damage.</li>
          </ol>
        </div>

        <footer className="mt-4 rounded-3xl border border-[#e0d7fc]/50 bg-white p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            MandiPlus is owned and operated by{" "}
            <strong className="font-semibold text-slate-800">
              {COMPANY_INFO.parent}
            </strong>
            .
          </p>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            © 2026 ENP FARMS PRIVATE LIMITED. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default TermsAndConditionsPage;

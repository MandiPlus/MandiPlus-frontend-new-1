"use client";

import React from "react";
import Link from "next/link";

const RefundPolicyPage = () => {
  return (
    <div className="min-h-screen bg-[#e0d7fc] px-4 py-8" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="max-w-2xl mx-auto">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-[#4309ac] hover:text-[#350889] font-medium text-sm px-2 py-1 rounded-lg bg-white/80 border border-[#e0d7fc] hover:bg-white transition mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            <span className="text-[#4309ac]">Refund Policy</span>
          </h1>
          <p className="mb-4 text-sm text-slate-500">Last updated: 21 August 2026</p>
          <p className="text-slate-600 mb-6">
            Refunds are processed as per our terms and applicable regulations. For policy-related refunds, please contact support with your policy details.
          </p>

          <div className="border-t border-slate-100 pt-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              Policy cancellation and eligibility
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Eligibility for cancellation and refund is determined by the issued insurer policy, applicable law, and whether coverage has started or a claim has occurred. MandiPlus does not independently promise a refund.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5 mt-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              Refund Processing Timeline
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              If a refund is approved, it is returned through the insurer, payment provider, or original payment method. Processing and bank-settlement timelines depend on those providers.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5 mt-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              Dispute Resolution &amp; Communication
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              All claim-related communication must be made via email at{" "}
              <a href="mailto:support@mandiplus.com" className="text-[#4309ac] hover:underline font-medium">support@mandiplus.com</a>
              {" "}or by calling{" "}
              <a href="tel:+917676217658" className="text-[#4309ac] hover:underline font-medium">+91 76762 17658</a>.
            </p>
          </div>

          <p className="text-slate-500 text-xs mt-6">
            ENP FARMS PRIVATE LIMITED operates MandiPlus and does not underwrite insurance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;

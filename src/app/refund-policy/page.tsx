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
          <p className="text-slate-600 mb-6">
            Refunds are processed as per our terms and applicable regulations. For policy-related refunds, please contact support with your policy details.
          </p>

          <div className="border-t border-slate-100 pt-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              No Policy Cancellation Refunds
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              If you cancel a policy shortly after purchase, you may not receive a refund depending on the Terms &amp; Conditions.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5 mt-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              Refund Processing Timeline
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Once a refund request is approved, MandiPlus processes the refund within 7 working days.
              The credited amount will reflect in the original payment method or registered bank account within
              7 to 10 working days, depending on the bank or payment partner.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5 mt-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              Dispute Resolution &amp; Communication
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              All claim-related communication must be made via email at{" "}
              <a href="mailto:support@mandiplus.com" className="text-[#4309ac] hover:underline font-medium">support@mandiplus.com</a>
              {" "}or by reaching out to our <b> 24/7* Customer Support Number{" "}
              <a href="tel:+919900186757" className="text-[#4309ac] hover:underline font-medium">+91 99001 86757</a>.</b>
            </p>
          </div>

          <p className="text-slate-500 text-xs mt-6">
            Last updated: January 2025.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;

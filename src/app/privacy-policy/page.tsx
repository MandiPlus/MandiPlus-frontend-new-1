"use client";

import React from "react";
import Link from "next/link";
import { COMPANY_INFO } from "@/features/landing/landingData";

const sections = [
  {
    id: "intro",
    title: null,
    content: `MandiPlus, owned and operated by ENP FARMS PRIVATE LIMITED, is committed to protecting the privacy of every individual who visits our website and has taken reasonable steps to protect your Personal Information and/or Sensitive Personal Data or Information.`,
  },
  {
    id: "covers",
    title: "This Privacy Policy Covers",
    list: [
      "Collection of Personal Information including Sensitive Personal Data or Information",
      "Use of your Personal Information",
      "Disclosure of Personal Information",
      "Protection of your Personal Information",
      "Review and updation of Personal Information",
      "Changes to our Privacy Policy",
    ],
  },
  {
    id: "collection",
    title: "1. Collection of Personal Information",
    content: `We and our authorized third parties (Insurer, Claim Representative, Settling Agent) may collect different types of Personal Information and Sensitive Personal Data or Information, as required under laws and regulations and also based on your interest in our insurance products and services and our business relationship with you.`,
    subsections: [
      {
        title: "Personal Information",
        text: "Your name, Age, Gender, Date of Birth, Photographs, Password to MandiPlus Customer Portal, etc.",
      },
      {
        title: "Contact Information",
        text: "Your address, Telephone numbers, Email ID, etc.",
      },
      {
        title: "Financial Information",
        text: "Details pertaining to your bank account, GSTIN, Income Tax (PAN Card, Form 16, etc.)",
      },
      {
        title: "Other Information",
        text: "Any information contained in documents used as proof of Identity, proof of address, proof of age, proof of income. Other information may be collected through surveys, feedback, news subscriptions, or job applications.",
      },
    ],
    note: "If you do not provide your information or consent, or later withdraw your consent, MandiPlus reserves the right to discontinue/cancel the insurance policy/services for which the said information was sought.",
  },
  {
    id: "use",
    title: "2. Use of Your Personal Information",
    content: "The Personal Information that we collect from you is held in accordance with applicable laws and regulations in India. It may be used for:",
    list: [
      "Verification of your identity as per prevalent laws and regulations",
      "Processing your request and providing you with products and/or services",
      "Settling accounts with those who provide related services to us",
      "Dealing with requests, enquiries, complaints, and customer care activities",
      "Market and product analysis; marketing our products and services",
      "Customer analytics on usage pattern and delivering customized content",
      "Providing you with the best customer experience possible",
      "Addressing network integrity and security issues",
      "Compliance with legal, governmental, or regulatory requirements",
      "Prevention, detection, investigation of unlawful activities, fraud, or security threats",
      "Business operations such as personnel training, quality control, and system maintenance",
    ],
  },
  {
    id: "disclosure",
    title: "3. Disclosure of Personal Information",
    content: "We may disclose and/or transfer your Personal Information to third parties when necessary for providing services to you and/or if you have consented. We may disclose your information to:",
    list: [
      "Companies that provide services directly to you on our behalf",
      "Anyone we transfer our business to in respect of which you are a customer",
      "Government agencies mandated under law for verification, prevention, detection, investigation, or prosecution of offences",
      "Any third party required by an order under the law",
    ],
  },
  {
    id: "protection",
    title: "4. Protection of Your Personal Information",
    content: "We shall take reasonable steps to ensure that the personal information pertaining to you is stored in a secure environment protected from unauthorized access, modification, or disclosure. MandiPlus shall retain your personal information for as long as required to provide you with services or otherwise required under the law.",
  },
  {
    id: "changes",
    title: "5. Changes to Our Privacy Policy",
    content: "We reserve the right to update this Policy as necessary from time to time. Please check our websites periodically for changes. Such changes shall be effective from the date of announcement by MandiPlus.",
  },
  {
    id: "telematics",
    title: "6. Privacy Policy for Telematics",
    content: "We and our authorized third parties will collect and process your real-time location based on information provided by your device operating system for the purpose of:",
    list: [
      "Detecting Goods carrying vehicles for tracking from the origin to the destination point for the safety purposes",
      "Driving behaviour data analysis",
      "Sending you adequate information regarding the Application",
      "Responding to your comments and problems",
      "Investigating potentially unlawful use of the Application",
      "Using your pseudonymised profile to build an interactive map structure",
    ],
  },
];

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-[#e0d7fc] px-4 py-8 pb-24" style={{ fontFamily: "Poppins, sans-serif" }}>
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

        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            <span className="text-[#4309ac]">Privacy Policy</span>
          </h1>
          <p className="text-slate-500 text-sm">Last updated: January 2025</p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50">
              {section.title && (
                <h2 className="text-base font-semibold text-slate-800 mb-3">{section.title}</h2>
              )}

              {section.content && (
                <p className="text-slate-600 text-sm leading-relaxed mb-3">{section.content}</p>
              )}

              {section.list && (
                <ul className="space-y-2 mb-3">
                  {section.list.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-slate-600 text-sm">
                      <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {section.subsections && (
                <div className="space-y-3 mt-4">
                  {section.subsections.map((sub, idx) => (
                    <div key={idx} className="bg-[#f8f6fc] rounded-2xl p-3">
                      <p className="text-sm font-medium text-[#4309ac] mb-1">{sub.title}</p>
                      <p className="text-slate-600 text-sm">{sub.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {section.note && (
                <p className="mt-4 pt-3 border-t border-slate-100 text-slate-500 text-xs italic">
                  {section.note}
                </p>
              )}
            </div>
          ))}
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

export default PrivacyPolicyPage;

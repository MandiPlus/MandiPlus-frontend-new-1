import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY_INFO } from "@/features/landing/landingData";

export const metadata: Metadata = {
  title: "Memorandum of Understanding (MOU) | MandiPlus",
  description:
    "The Memorandum of Understanding between Mandi Plus (ENP FARMS PVT LTD) and its customers for transit insurance facilitation.",
};

const insuranceDetails = [
  {
    label: "Insurer",
    value: "Tata AIG General Insurance Company Limited (IRDAI Regn. No. 108)",
  },
  {
    label: "Cover",
    value:
      "Inland transit (rail/road/air) insurance under the Company's open marine cargo policy No. 6539908655. Each declared consignment is covered by its own Certificate of Insurance issued under this policy.",
  },
  {
    label: "Sum Insured",
    value: "The consignment value stated in the Mandi Plus invoice for that consignment.",
  },
  {
    label: "Excess",
    value: "2% of consignment value or ₹30,000, whichever is higher, for each and every claim.",
  },
  {
    label: "Key Clauses",
    value:
      "Inland Transit (Rail/Road/Air) Clause A 2010; Strikes, Riots and Civil Commotion Clause 2010; and all other terms, conditions and exclusions of the open policy.",
  },
];

const responsibilities = [
  "Declare accurate and complete consignment details — commodity, quantity, value, vehicle number and party names. Misdeclared or suppressed facts can void the cover.",
  "Ensure goods are properly packed, loaded and secured, and the carrying vehicle is roadworthy and lawfully operated.",
  "Take all reasonable steps to prevent or minimise loss, and preserve rights of recovery against carriers and other third parties.",
  "Do not give clean receipts for goods in doubtful condition except under written protest. If loss or damage is not apparent on delivery, give written notice to the carrier within 3 days.",
  "Report any loss or damage immediately, and do not dispose of damaged goods before survey unless directed by the insurer.",
];

const claimDocuments = [
  "Certificate of Insurance for the consignment.",
  "Mandi Plus invoice, with weighment slips.",
  "Bilty / Lorry Receipt or other contract of carriage.",
  "FIR, where the loss involves accident, theft, looting or riot.",
  "GPS-tagged photographs of the goods, vehicle and site of loss.",
  "Damage Certificate and Letter of Subrogation, where applicable.",
  "Survey Report from the insurer's representative, or other evidence of the extent of loss.",
];

export default function MouPage() {
  return (
    <div className="min-h-screen bg-[#e0d7fc] px-4 py-8 pb-24" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="max-w-lg mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[#4309ac] hover:text-[#350889] font-medium text-sm px-2 py-1 rounded-lg bg-white/80 border border-[#e0d7fc] hover:bg-white transition mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to MandiPlus
        </Link>

        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          <span className="text-[#4309ac]">Memorandum of Understanding (MOU)</span>
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          This MOU is between{" "}
          <strong className="font-semibold text-slate-800">{COMPANY_INFO.parent}</strong>{" "}
          (&quot;Mandi Plus&quot;) and the customer who accepts it electronically on the Mandi Plus
          platform. It sets out how transit insurance is arranged for agricultural consignments
          booked through Mandi Plus. Ticking the consent checkbox in the app constitutes acceptance
          of this MOU under the Information Technology Act, 2000, and applies to every consignment
          declared after acceptance.
        </p>

        {/* Insurance details */}
        <div className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Insurance Details</h2>
          <dl className="space-y-3">
            {insuranceDetails.map((item) => (
              <div key={item.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#4309ac] mb-0.5">{item.label}</dt>
                <dd className="text-sm text-slate-600 leading-relaxed">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Role of Mandi Plus */}
        <div className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Role of Mandi Plus</h2>
          <ul className="space-y-2.5 text-slate-600 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              Mandi Plus is a technology and service platform. It is not an insurance company and does not underwrite risk.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              Mandi Plus declares consignments to the insurer, collects the applicable premium, delivers the Certificate of Insurance, and assists with claim documentation and follow-up.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              All coverage and claim decisions rest solely with the insurer. If a Certificate of Insurance and the open policy differ, the open policy prevails.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              Mandi Plus&apos;s liability in connection with insurance facilitation is limited to the facilitation charges paid for the consignment concerned.
            </li>
          </ul>
        </div>

        {/* Premium and cover */}
        <div className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Premium &amp; Cover</h2>
          <ul className="space-y-2.5 text-slate-600 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              The premium and charges for each consignment are shown on the Mandi Plus invoice and collected through the invoice or the customer&apos;s Mandi Plus wallet. Taxes apply as per law.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              Cover is effective only once the consignment is declared, the Certificate of Insurance is issued, and the premium is received.
            </li>
          </ul>
        </div>

        {/* Customer responsibilities */}
        <div className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Customer Responsibilities</h2>
          <ul className="space-y-2.5 text-slate-600 text-sm">
            {responsibilities.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Claims */}
        <div className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Claims</h2>
          <p className="text-slate-600 text-sm mb-3">
            In the event of loss or damage, immediately contact Mandi Plus support at{" "}
            <a href={COMPANY_INFO.phoneHref} className="text-[#4309ac] font-medium hover:underline">
              +91 {COMPANY_INFO.phone}
            </a>{" "}
            and follow the notice instructions in the Certificate of Insurance. The customer is
            responsible for providing all supporting documents, including:
          </p>
          <ol className="space-y-2 text-slate-600 text-sm list-decimal list-inside">
            {claimDocuments.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <p className="mt-4 pt-4 border-t border-slate-100 text-slate-500 text-xs">
            The insurer or its authorised representative surveys, assesses and decides every claim,
            subject to the excess and the terms of the policy. False or exaggerated claims lead to
            rejection, cancellation of cover, and may result in legal action.
          </p>
        </div>

        {/* General */}
        <div className="bg-white rounded-3xl shadow-sm p-5 border border-[#e0d7fc]/50">
          <h2 className="text-base font-semibold text-slate-800 mb-3">General</h2>
          <ul className="space-y-2.5 text-slate-600 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              The customer&apos;s electronic acceptance, with account identifier and timestamp, is stored by Mandi Plus as the record of execution.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              Consignment and customer details are shared with the insurer as required to arrange cover and process claims, in line with the{" "}
              <Link href="/privacy-policy" className="text-[#4309ac] font-medium hover:underline">Privacy Policy</Link>.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#4309ac]" aria-hidden="true" />
              This MOU is governed by the laws of India, and the courts at Bengaluru, Karnataka have jurisdiction over any dispute arising from it.
            </li>
          </ul>
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
}

import Link from "next/link";
import type { ReactNode } from "react";

const dataCategories = [
  "Account and business profile: name, Indian mobile number, role, language, state, mandi, and commodity details.",
  "Service records: invoices, policy and claim details, receipts, uploaded photos or documents, vehicle and route information, and support interactions.",
  "Payment activity: payment status, amount, transaction references, refunds, and insurance-service ledger activity. MandiPlus does not receive your full card, bank, or UPI credentials.",
  "Voice and AI input: recordings or transcripts you choose to provide, your questions, and the limited account context needed to answer them.",
  "Technical data: app version, device or installation identifiers used for notifications, diagnostics, security, and fraud prevention.",
];

const providers = [
  "The insurer and authorised insurance or claim-service participants shown in the relevant policy or service record.",
  "PhonePe and banking/payment participants for real-world insurance and related service payments.",
  "Google Gemini / Vertex AI for Sahayata and selected AI-assisted document or voice features, after the applicable in-app notice.",
  "Google or AssemblyAI for voice-to-text processing, depending on the feature's current production configuration.",
  "Cloudinary and infrastructure providers for secure document storage and delivery.",
  "Expo for app updates and push-notification delivery, and 2Factor for OTP delivery.",
  "Vehicle-tracking, mapping, routing, and geocoding providers needed to display a requested trip.",
  "PostHog only when you opt in to privacy-protected analytics in the app.",
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f5f3fb] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <Link className="text-sm font-bold text-[#4309ac]" href="/">
            ← MandiPlus
          </Link>
          <h1 className="mt-4 text-3xl font-black">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated: 21 August 2026</p>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            MandiPlus is owned and operated by ENP FARMS PRIVATE LIMITED. This policy covers the MandiPlus mobile app and public website in India.
          </p>
        </header>

        <PolicySection title="1. Information we handle">
          <ul className="space-y-3">
            {dataCategories.map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </PolicySection>

        <PolicySection title="2. Device permissions">
          <p>
            The app may request camera or photo-library access when you capture or choose an invoice, receipt, or claim document; microphone and speech-recognition access when you choose voice entry; and notification access after sign-in for account, policy, claim, payment, or trip updates.
          </p>
          <p className="mt-3">
            The iOS app does not request your phone&apos;s location, contacts, or App Tracking Transparency permission. Vehicle tracking displays information supplied by authorised tracking services for a vehicle or trip requested in the app.
          </p>
        </PolicySection>

        <PolicySection title="3. How we use information">
          <ul className="space-y-3">
            <Bullet>Authenticate users and maintain account security.</Bullet>
            <Bullet>Prepare and manage requested invoices, insurance-service records, policy documents, tracking views, and claims.</Bullet>
            <Bullet>Process payments and refunds, prevent fraud, provide support, and comply with applicable Indian legal obligations.</Bullet>
            <Bullet>Provide AI-assisted answers or transcription only when you use the relevant feature.</Bullet>
          </ul>
        </PolicySection>

        <PolicySection title="4. AI-assisted features">
          <p>
            Sahayata uses Google Gemini / Vertex AI. Before its first use, the app explains that your question and relevant account context may be sent to Google and asks you to continue. This context can include your mandi, role, language, service-limit activity, invoices, policies, and claims when needed to answer the question. MandiPlus removes information that is not needed for the response where reasonably possible.
          </p>
          <p className="mt-3">
            Voice entry may use Google or AssemblyAI to convert the recording you submit into text. AI output can be inaccurate and does not replace the issued policy, payment record, claim decision, or professional advice.
          </p>
        </PolicySection>

        <PolicySection title="5. Service providers and disclosure">
          <p className="mb-4">
            We disclose information only as needed to provide a feature you request, protect the service, comply with law, or complete an authorised business transfer. Providers can include:
          </p>
          <ul className="space-y-3">
            {providers.map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
          <p className="mt-4">
            MandiPlus does not provide a public social feed or user-to-user messaging. Invoice, policy, and claim uploads are private business records available only to the account holder and authorised service or operations personnel.
          </p>
        </PolicySection>

        <PolicySection title="6. Analytics and tracking">
          <p>
            Privacy-protected product analytics and masked session replay are off by default in the mobile app. If you opt in under Profile → Security, limited usage and diagnostic data may be sent to PostHog. Text, images, system pickers, and sensitive account content are masked or excluded. MandiPlus does not use this data for cross-app advertising and does not sell personal information.
          </p>
        </PolicySection>

        <PolicySection title="7. Storage, security, and retention">
          <p>
            Sign-in tokens are stored using the device&apos;s protected storage. We use reasonable administrative, technical, and organisational safeguards. Records are retained only as needed to provide the service, resolve disputes, prevent fraud, enforce agreements, and meet insurance, payment, tax, or other legal obligations. Saved app drafts and preferences may remain on your device until removed or the app is uninstalled.
          </p>
        </PolicySection>

        <PolicySection title="8. Account deletion and user choices">
          <p>
            Request deletion in the iOS app under Profile → Security → Delete account, or use the web account-deletion page. A request has a seven-day recovery window. Contact support before the scheduled date to cancel it. Personal profile data is deleted or anonymised after the recovery window, while invoices, policies, claims, payment, tax, fraud-prevention, or legal records may be retained where required.
          </p>
          <Link className="mt-4 inline-flex font-bold text-[#4309ac] underline" href="/account-deletion">
            Account-deletion page
          </Link>
        </PolicySection>

        <PolicySection title="9. Contact">
          <p>
            For privacy questions, access or correction requests, or deletion recovery, email{" "}
            <a className="font-bold text-[#4309ac] underline" href="mailto:support@mandiplus.com">support@mandiplus.com</a>{" "}
            or call{" "}
            <a className="font-bold text-[#4309ac] underline" href="tel:+917676217658">+91 76762 17658</a>.
          </p>
          <p className="mt-3">
            ENP FARMS PRIVATE LIMITED, SY No. 38, 1 No. 51/4, CMC Katha Post, Glass Factory Layout, Electronic City, Andapura, Karnataka 560099, India.
          </p>
        </PolicySection>
      </div>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-7 text-sm leading-6 text-slate-700 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-xl font-black text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#4309ac]" />
      <span>{children}</span>
    </li>
  );
}

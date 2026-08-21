import Link from "next/link";

const supportTopics = [
  "OTP, sign-in, onboarding, and account access",
  "Insurance requests, invoices, and policy documents",
  "Payments, cancellations, and refund status",
  "Vehicle tracking and claim-document uploads",
  "Privacy questions and account deletion or recovery",
];

export const metadata = {
  title: "MandiPlus Support",
  description: "Contact MandiPlus support for app, payment, policy, claim, privacy, and account-deletion help.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#f5f3fb] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-bold uppercase tracking-wider text-[#4309ac]">MandiPlus</p>
          <h1 className="mt-2 text-3xl font-black">Customer support</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Contact ENP FARMS PRIVATE LIMITED for help with the MandiPlus mobile app and the services available through it.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              className="rounded-2xl bg-[#4309ac] px-5 py-4 text-center font-bold text-white"
              href="mailto:support@mandiplus.com"
            >
              support@mandiplus.com
            </a>
            <a
              className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-center font-bold text-slate-900"
              href="tel:+917676217658"
            >
              +91 76762 17658
            </a>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black">What we can help with</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            {supportTopics.map((topic) => (
              <li key={topic} className="flex gap-3">
                <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#4309ac]" />
                <span>{topic}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black">Account deletion</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            In the iOS app, open Profile → Security → Delete account. You can also use the web deletion page. A requested deletion has a seven-day recovery window; contact support before the scheduled date if you want to cancel it.
          </p>
          <Link className="mt-4 inline-flex font-bold text-[#4309ac] underline" href="/account-deletion">
            Open account-deletion page
          </Link>
        </section>

        <nav className="flex flex-wrap justify-center gap-4 pb-6 text-sm font-bold text-[#4309ac]">
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-and-conditions">Terms</Link>
          <Link href="/refund-policy">Refund Policy</Link>
        </nav>
      </div>
    </main>
  );
}

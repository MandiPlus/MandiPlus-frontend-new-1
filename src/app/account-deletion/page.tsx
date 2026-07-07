import React from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Mail, ShieldAlert } from "lucide-react";

export default function AccountDeletion() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 px-8 py-6 border-b border-red-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-red-900 flex items-center gap-2">
              <Trash2 className="w-6 h-6" />
              Account Deletion Request
            </h1>
            <p className="text-red-700 mt-1">
              MandiPlus by ENP Farms PVT LTD
            </p>
          </div>
          <Link href="/" className="text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>

        {/* Content */}
        <div className="px-8 py-8 space-y-8 text-gray-700">
          
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">How to Request Account Deletion</h2>
            <p className="mb-4">
              If you wish to delete your MandiPlus account and all associated personal data, you can submit a deletion request. Once processed, your account will be permanently deactivated and your data will be securely erased in accordance with our data retention policies.
            </p>
            
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">Steps to delete your account:</h3>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Send an email to our support team at <strong>support@mandiplus.com</strong>.</li>
                <li>Use the subject line: <strong>"Account Deletion Request - [Your Registered Mobile Number]"</strong>.</li>
                <li>In the email body, please mention your name and the mobile number associated with your MandiPlus account.</li>
                <li>Our team will verify your identity and process the deletion within <strong>7-14 business days</strong>.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-gray-500" />
              Data Deletion & Retention Policy
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              <div>
                <h3 className="font-medium text-red-700 mb-2">Data that will be deleted:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Personal details (Name, Profile Photo)</li>
                  <li>Contact Information (Phone Number)</li>
                  <li>App usage history and preferences</li>
                  <li>Custom configurations</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-amber-700 mb-2">Data retained for legal compliance:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Financial transaction history</li>
                  <li>GST/Tax related invoices and ledgers</li>
                  <li>KYC documents and audit logs</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 text-sm bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800">
              <strong>Note on Retention:</strong> Due to financial regulations and Indian laws (including GST compliance and anti-money laundering regulations), transactional data and invoices generated via MandiPlus must be retained for a statutory period of <strong>up to 8 years</strong> after account closure. This retained data is strictly secured and will not be used for marketing or any other commercial purposes.
            </div>
          </section>

          <section className="pt-4 text-sm text-gray-500 text-center border-t">
            For any further questions, please contact us at <a href="mailto:support@mandiplus.com" className="text-blue-600 hover:underline">support@mandiplus.com</a>.
          </section>

        </div>
      </div>
    </div>
  );
}

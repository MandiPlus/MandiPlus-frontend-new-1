"use client";

import React, { useState } from "react";

const consentText = {
  en: (
    <>
      I confirm that I have read, understood, and accepted the terms of the{" "}
      <a
        href="/docs/mou"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline font-medium"
      >
        Memorandum of Understanding (MOU)
      </a>{" "}
      with Mandi Plus (ENP FARMS PVT LTD). I accept the insurance terms and
      conditions and the guidelines for any loss/damage of my agricultural goods
      during transit as per the clauses mentioned in the{" "}
      <a
        href="/docs/insurance-certificate.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline font-medium"
      >
        Insurance Certificate
      </a>{" "}
      issued by TATA AIG and the{" "}
      <a
        href="/docs/invoice-sample.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline font-medium"
      >
        Invoice Copy
      </a>{" "}
      issued by Mandi Plus. In case of any claim request raised by me, I am
      obliged and responsible to provide all supporting documents related to the
      consignment (such as FIR, GPS Pictures, Weighment Slips, and Damage
      Certificate).
    </>
  ),
  hi: (
    <>
      मैं यह पुष्टि करता हूँ कि मैंने Mandi Plus (ENP FARMS PVT LTD) के साथ{" "}
      <a
        href="/docs/mou"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline font-medium"
      >
        समझौता ज्ञापन (MOU)
      </a>{" "}
      की शर्तों को पढ़ और समझ लिया है। मैं अपने कृषि सामान (Agri-goods) के
      ट्रांसपोर्ट के दौरान होने वाले किसी भी नुकसान या डैमेज के लिए{" "}
      <a
        href="/docs/insurance-certificate.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline font-medium"
      >
        इंश्योरेंस सर्टिफिकेट
      </a>{" "}
      और Mandi Plus के{" "}
      <a
        href="/docs/invoice-sample.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline font-medium"
      >
        इनवॉइस
      </a>{" "}
      में दी गई शर्तों को स्वीकार करता हूँ। यदि मैं भविष्य में कोई क्लेम (Claim)
      डालता हूँ, तो उसकी जिम्मेदारी मेरी होगी कि मैं माल से जुड़े सभी जरूरी
      दस्तावेज (जैसे FIR, फोटो, कांटे की पर्ची और डैमेज सर्टिफिकेट) उपलब्ध
      कराऊं।
    </>
  ),
};

export default function ConsentPreviewPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi">("en");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full mx-auto border border-gray-100 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Mandi Plus: Insurance Consent Acknowledgment
        </h2>

        {/* Language Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSelectedLanguage("en")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedLanguage === "en"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setSelectedLanguage("hi")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedLanguage === "hi"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            हिंदी
          </button>
        </div>

        {/* Consent Text */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 text-sm text-gray-700 leading-relaxed">
          {selectedLanguage === "en" ? consentText.en : consentText.hi}
        </div>

        {/* Mandatory Checkbox */}
        <div className="mb-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {selectedLanguage === "en"
                ? "I agree to the above terms"
                : "मैं उपरोक्त शर्तों से सहमत हूँ"}
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          onClick={() => setSubmitted(true)}
          disabled={!agreed}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedLanguage === "en"
            ? "I Agree & Continue"
            : "सहमत हूँ और जारी रखें"}
        </button>

        {submitted && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 text-center font-medium">
            ✓ Agreement accepted successfully!
          </div>
        )}
      </div>
    </div>
  );
}

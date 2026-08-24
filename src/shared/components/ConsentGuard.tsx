"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";

const CONSENT_STORAGE_KEY = "mandi_plus_insurance_consent";

const consentText = {
    en: (
        <>
            I confirm that I have read, understood, and accepted the terms of the{" "}
            <a href="/docs/mou.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                Memorandum of Understanding (MOU)
            </a>{" "}
            with Mandi Plus (ENP FARMS PVT LTD). I accept the insurance terms and conditions and the guidelines for any loss/damage of my agricultural goods during transit as per the clauses mentioned in the{" "}
            <a href="/docs/insurance-certificate.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                Insurance Certificate
            </a>{" "}
            issued by TATA AIG and the{" "}
            <a href="/docs/invoice-sample.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                Invoice Copy
            </a>{" "}
            issued by Mandi Plus. In case of any claim request raised by me, I am obliged and responsible to provide all supporting documents related to the consignment (such as FIR, GPS Pictures, Weighment Slips, and Damage Certificate).
        </>
    ),
    hi: (
        <>
            मैं यह पुष्टि करता हूँ कि मैंने Mandi Plus (ENP FARMS PVT LTD) के साथ{" "}
            <a href="/docs/mou.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                समझौता ज्ञापन (MOU)
            </a>{" "}
            की शर्तों को पढ़ और समझ लिया है। मैं अपने कृषि सामान (Agri-goods) के ट्रांसपोर्ट के दौरान होने वाले किसी भी नुकसान या डैमेज के लिए{" "}
            <a href="/docs/insurance-certificate.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                इंश्योरेंस सर्टिफिकेट
            </a>{" "}
            और Mandi Plus के{" "}
            <a href="/docs/invoice-sample.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                इनवॉइस
            </a>{" "}
            में दी गई शर्तों को स्वीकार करता हूँ। यदि मैं भविष्य में कोई क्लेम (Claim) डालता हूँ, तो उसकी जिम्मेदारी मेरी होगी कि मैं माल से जुड़े सभी जरूरी दस्तावेज (जैसे FIR, फोटो, कांटे की पर्ची और डैमेज सर्टिफिकेट) उपलब्ध कराऊं।
        </>
    )
};

export default function ConsentGuard({ children }: { children: React.ReactNode }) {
    const { user, setUser } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi">("en");

    // Check localStorage first, then user consent status
    useEffect(() => {
        // Check localStorage first
        const storedConsent = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (storedConsent === "true") {
            setShowModal(false);
            return;
        }

        // If not in localStorage, check user consent status
        if (user && user.isConsent !== true) {
            setShowModal(true);
        } else {
            setShowModal(false);
        }
    }, [user]);

    const handleConsent = async () => {
        if (!agreed) {
            toast.error("Please check the agreement checkbox to continue");
            return;
        }

        if (!user) return;
        setLoading(true);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

            const consentPayload = selectedLanguage === "en" 
                ? "Mandi Plus: Insurance Consent Acknowledgment - I confirm that I have read, understood, and accepted the terms of the Memorandum of Understanding (MOU) with Mandi Plus (ENP FARMS PVT LTD). I accept the insurance terms and conditions and the guidelines for any loss/damage of my agricultural goods during transit as per the clauses mentioned in the insurance certificate issued by TATA AIG and the Invoice copy issued by Mandi Plus. In case of any claim request raised by me, I am obliged and responsible to provide all supporting documents related to the consignment (such as FIR, GPS Pictures, Weighment Slips, and Damage Certificate)."
                : "Mandi Plus: Insurance Consent Acknowledgment (Hindi) - मैं यह पुष्टि करता हूँ कि मैंने Mandi Plus (ENP FARMS PVT LTD) के साथ समझौता ज्ञापन (MOU) की शर्तों को पढ़ और समझ लिया है। मैं अपने कृषि सामान (Agri-goods) के ट्रांसपोर्ट के दौरान होने वाले किसी भी नुकसान या डैमेज के लिए TATA AIG द्वारा जारी इंश्योरेंस सर्टिफिकेट और Mandi Plus के इनवॉइस में दी गई शर्तों को स्वीकार करता हूँ। यदि मैं भविष्य में कोई क्लेम (Claim) डालता हूँ, तो उसकी जिम्मेदारी मेरी होगी कि मैं माल से जुड़े सभी जरूरी दस्तावेज (जैसे FIR, फोटो, कांटे की पर्ची और डैमेज सर्टिफिकेट) उपलब्ध कराऊं।";

            if (!user.id?.startsWith("demo-user")) {
                await axios.patch(`${apiUrl}/users/${user.id}/consent`, {
                    consentText: consentPayload,
                });
            }

            // Store in localStorage
            localStorage.setItem(CONSENT_STORAGE_KEY, "true");

            // Update Local State immediately
            if (setUser) {
                setUser({ ...user, isConsent: true });
            }
            if (typeof window !== "undefined") {
                const stored = localStorage.getItem("user");
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        localStorage.setItem("user", JSON.stringify({ ...parsed, isConsent: true }));
                    } catch {
                        // no-op
                    }
                }
            }

            toast.success("Consent recorded successfully");
            setShowModal(false);

        } catch (error) {
            console.error("Consent Error:", error);
            toast.error("Failed to save consent. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // If no modal needed, just render the app content normally
    if (!showModal) {
        return <>{children}</>;
    }

    // If modal is needed, BLOCK the app content
    return (
        <>
            {/* The background app content (blurred/hidden) */}
            <div className="h-screen overflow-hidden blur-sm pointer-events-none select-none" aria-hidden="true">
                {children}
            </div>

            {/* The Blocking Modal */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
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
                        <label className="flex items-start gap-3 cursor-pointer">
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
                        onClick={handleConsent}
                        disabled={loading || !agreed}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            selectedLanguage === "en" ? "I Agree & Continue" : "सहमत हूँ और जारी रखें"
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
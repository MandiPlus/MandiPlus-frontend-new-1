/**
 * Copy for the customer web app, in English and Hinglish.
 *
 * The customer web is mostly English already; this covers the strings that
 * were written in Hinglish and had no English counterpart, so an English
 * user no longer reads "Insurance banao" on an otherwise English page.
 *
 * 'hi-Latn' is Hinglish — Hindi in Latin script — and is the default, the
 * same as the mobile app. The bundles share the mobile app's key names where
 * the same string appears on both.
 */

export const CUSTOMER_LANGUAGE_OPTIONS = [
  ["hi-Latn", "Hinglish"],
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["kn", "ಕನ್ನಡ"],
  ["mr", "मराठी"],
  ["ta", "தமிழ்"],
  ["te", "తెలుగు"],
] as const;

export type CustomerLanguage = (typeof CUSTOMER_LANGUAGE_OPTIONS)[number][0];

export const DEFAULT_CUSTOMER_LANGUAGE: CustomerLanguage = "hi-Latn";

const COPY = {
  en: {
    roleSupplier: "Loading side",
    roleBuyer: "Unloading side",
    roleSupplierAddress: "Loading side address",
    roleBuyerAddress: "Unloading side address",
    roleBuyerMobile: "Unloading side mobile",
    navCreateInsurance: "Create\ninsurance",
    navSupport: "Help",
    homeCreateInsurance: "Create insurance",
    supportTitle: "Help",
    supportStarter: "What do you need help with?",
    supportUnavailable:
      "Help is unavailable right now. Please try again in a little while.",
    supportCheckCredit: "Check your available credit",
    supportTrackVehicle: "Track vehicle",
    supportTrackVehicleSub: "See live trip status",
    setupSaveFailed: "Could not save your details.",
    setupOtherCommodityRequired: "Type the name of your other commodity",
    setupNamePlaceholder: "Type your name",
    setupOtherCommodityPlaceholder: "Type your commodity name",
    setupMandiPlaceholder: "Type your mandi name",
    setupLanguageTitle: "Choose a language",
    setupMandiTitle: "Where is your mandi?",
    profileSaved: "Profile saved.",
    profileSaveFailed: "Could not save your profile.",
    profileLanguageFailed: "Could not update your language.",
    profileYourDetails: "Your details",
    papersPay: "Pay",
    papersPaymentLoadFailed: "Could not load payment details. Please retry.",
    papersSelectAll: "Select all",
    papersViewInvoice: "View invoice",
    papersInvoiceComing: "Coming soon",
    papersNoRecords: "No records in this range.",
    claimsVehicleRequired: "Select or enter a vehicle number.",
    claimsRegistered: "Claim registered. Please upload the documents.",
    claimsRegisterFailed: "Could not register the claim. Please retry.",
    claimsUploadFailed: "Could not upload the document.",
    claimsChooseVehicle: "Choose a vehicle",
    claimsRegister: "Register claim",
    claimsUploadOne: "Upload {{document}}.",
    claimsUploadBoth: "Upload the lorry receipt and the damage certificate.",
    validationAdd: "Add {{field}}.",
    validationAddName: "Add the {{party}}'s name.",
    validationPartyMobile: "Add the {{party}}'s 10-digit mobile number.",
    validationDriverMobile: "Add a valid 10-digit mobile number for the driver.",
    validationCommodity: "the commodity",
    validationQuantity: "a valid quantity",
    validationRate: "a valid rate",
    validationVehicleNumber: "the vehicle number",
    validationVehicleTonnage: "Choose the vehicle tonnage.",
    insuranceCreateTitle: "Create insurance",
    insuranceChangePhoto: "Change photo",
    insuranceAddWeighment: "Add weighment slip",
    insuranceCheckDetails: "Check the details",
    insuranceDetailsNotFetched: "Could not read the details. Please add them manually.",
    insuranceSomeSkipped:
      "Some invoices were duplicates or past the limit, so they were not added.",
    insuranceAddFailed: "Could not add the invoices. Please try again.",
    insuranceCreateFailed: "Could not create the invoice.",
    insuranceStartFailed:
      "Could not create the insurance or start the payment. Please try again.",
    insuranceReuploadSlips: "Upload the weighment slip for each invoice again.",
    draftsLoadFailed: "Could not load your drafts.",
    draftSaveFailed: "Could not save the draft. Please try again.",
    draftDeleteFailed: "Could not delete the draft.",
    voiceUnsupported: "Voice input is not available in this browser.",
    voiceSaveFailed: "Could not save the recording. Please say it again.",
    voiceNotUnderstood: "{{question}} was not clear. Please say it again.",
    voicePermission: "Allow microphone access and try again.",
    questionAudioFailed: "Could not play the question. Please say your answer.",
    questionAudioFailedShort: "Could not play the question.",
  },
  "hi-Latn": {
    roleSupplier: "Loading vala",
    roleBuyer: "Unloading vala",
    roleSupplierAddress: "Loading vala address",
    roleBuyerAddress: "Unloading vala address",
    roleBuyerMobile: "Unloading vala mobile",
    navCreateInsurance: "Insurance\nbanao",
    navSupport: "Sahayata",
    homeCreateInsurance: "Insurance banao",
    supportTitle: "Sahayata",
    supportStarter: "Aapko kis cheez mein help chahiye?",
    supportUnavailable:
      "Help abhi available nahi hai. Thodi der baad try karein.",
    supportCheckCredit: "Available credit check karein",
    supportTrackVehicle: "Vehicle track karein",
    supportTrackVehicleSub: "Live trip status dekhein",
    setupSaveFailed: "Details save nahi ho paaye.",
    setupOtherCommodityRequired: "Other commodity ka naam likhein",
    setupNamePlaceholder: "Apna naam likhein",
    setupOtherCommodityPlaceholder: "Apni commodity ka naam likhein",
    setupMandiPlaceholder: "Mandi ka naam likhein",
    setupLanguageTitle: "Language chunein",
    setupMandiTitle: "Aapki mandi kahan hai?",
    profileSaved: "Profile save ho gaya.",
    profileSaveFailed: "Profile save nahi ho saka.",
    profileLanguageFailed: "Language update nahi ho saki.",
    profileYourDetails: "Aapki details",
    papersPay: "Pay karein",
    papersPaymentLoadFailed: "Payment details load nahi ho paaye. Please retry.",
    papersSelectAll: "Sab chunein",
    papersViewInvoice: "Invoice dekhein",
    papersInvoiceComing: "Jald milega",
    papersNoRecords: "Is range mein koi record nahi mila.",
    claimsVehicleRequired: "Vehicle number select ya enter karein.",
    claimsRegistered: "Claim successfully register ho gaya. Documents upload karein.",
    claimsRegisterFailed: "Claim register nahi ho paya. Please retry.",
    claimsUploadFailed: "Document upload nahi ho paya.",
    claimsChooseVehicle: "Vehicle choose karein",
    claimsRegister: "Claim register karein",
    claimsUploadOne: "{{document}} upload karein.",
    claimsUploadBoth: "Lorry receipt aur damage certificate upload karein.",
    validationAdd: "{{field}} add karein.",
    validationAddName: "{{party}} ka naam add karein.",
    validationPartyMobile: "{{party}} ka 10 digit mobile number add karein.",
    validationDriverMobile: "Driver ka sahi 10 digit mobile number add karein.",
    validationCommodity: "Commodity",
    validationQuantity: "Sahi quantity",
    validationRate: "Sahi rate",
    validationVehicleNumber: "Vehicle number",
    validationVehicleTonnage: "Vehicle tonnage chunein.",
    insuranceCreateTitle: "Insurance banao",
    insuranceChangePhoto: "Photo badlein",
    insuranceAddWeighment: "Weighment slip dalein",
    insuranceCheckDetails: "Details check karein",
    insuranceDetailsNotFetched: "Details fetch nahi hui. Manually add karein.",
    insuranceSomeSkipped:
      "Kuch invoices duplicate ya limit ke baad the, isliye add nahi hue.",
    insuranceAddFailed: "Invoices add nahi hue. Dobara try karein.",
    insuranceCreateFailed: "Invoice create nahi ho saka.",
    insuranceStartFailed:
      "Insurance create ya payment start nahi ho saka. Dobara try karein.",
    insuranceReuploadSlips: "Har invoice ki weighment slip dobara upload karein.",
    draftsLoadFailed: "Drafts load nahi hue.",
    draftSaveFailed: "Draft save nahi hua. Dobara try karein.",
    draftDeleteFailed: "Draft delete nahi hua.",
    voiceUnsupported: "Voice input is browser mein available nahi hai.",
    voiceSaveFailed: "Voice save nahi hui. Ek baar phir boliye.",
    voiceNotUnderstood: "{{question}} samajh nahi aaya. Dobara boliye.",
    voicePermission: "Microphone permission allow karke dobara try karein.",
    questionAudioFailed: "Question audio play nahi hua. Apna jawab boliye.",
    questionAudioFailedShort: "Question audio play nahi hua.",
  },
} as const;

export type CustomerCopyKey = keyof typeof COPY.en;

/**
 * Narrow a stored preferredLanguage to a bundle.
 *
 * Anything that is not English resolves to Hinglish: the other locales have
 * no web bundle, and Hinglish is what those users have been reading. A
 * pre-split 'en' was migrated to 'hi-Latn' server-side, so a plain 'en' here
 * is a real choice of English.
 */
export function normalizeCustomerLanguage(value: unknown): "en" | "hi-Latn" {
  return String(value || "").toLowerCase() === "en" ? "en" : "hi-Latn";
}

/** Copy reader for a user's language. `t('key')` returns the string. */
export function customerCopy(language: unknown) {
  const bundle = COPY[normalizeCustomerLanguage(language)];
  return (key: CustomerCopyKey, params?: Record<string, string>): string => {
    const template: string = bundle[key];
    if (!params) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
      String(params[name] ?? ""),
    );
  };
}

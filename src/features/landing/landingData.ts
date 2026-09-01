export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mandiplus.customer";

export const CALL_URL = "tel:+917676217658";

// Hero "Call karein" button — sales line traders dial straight from the landing page.
export const HERO_CALL_NUMBER = "+91 96069 95351";
export const HERO_CALL_URL = "tel:+919606995351";

// "Munafa aapka" (profit is yours) in mandi-trade-belt languages, cycled in the hero.
export const MUNAFA_TRANSLATIONS = [
  { lang: "Hindi", text: "मुनाफ़ा आपका" },
  { lang: "Kannada", text: "ಲಾಭ ನಿಮ್ಮದು" },
  { lang: "Marathi", text: "नफा तुमचा" },
  { lang: "Punjabi", text: "ਮੁਨਾਫ਼ਾ ਤੁਹਾਡਾ" },
  { lang: "Gujarati", text: "નફો તમારો" },
  { lang: "Tamil", text: "லாபம் உங்களுடையது" },
  { lang: "Telugu", text: "లాభం మీది" },
  { lang: "Bengali", text: "লাভ আপনার" },
];

export const CLAIMS_STAT = {
  value: "₹1 Cr+",
  label: "claims settled",
  labelLong: "claims settled for mandi traders",
};

export const COMPANY_INFO = {
  parent: "ENP FARMS PRIVATE LIMITED",
  address: [
    "SY No. 38, 1 No. 51/4, CMC Katha Post,",
    "Glass Factory Layout, Electronic City, Anandapur,",
    "Andapura, Karnataka 560099",
  ],
  phone: "7676217658",
  phoneHref: "tel:+917676217658",
};

export const SOCIAL_LINKS = [
  { id: "instagram", label: "Instagram", href: "#" },
  { id: "linkedin", label: "LinkedIn", href: "#" },
  { id: "x", label: "X", href: "#" },
  { id: "youtube", label: "YouTube", href: "#" },
  { id: "facebook", label: "Facebook", href: "#" },
];

export type ProductId =
  | "cover"
  | "track"
  | "claim"
  | "invoice"
  | "khata"
  | "pay";

export type ProductIcon =
  | "shield"
  | "truck"
  | "claim"
  | "invoice"
  | "khata"
  | "pay";

export type Product = {
  id: ProductId;
  number: string;
  name: string;
  phase: string;
  action: string;
  headline: string;
  summary: string;
  bullets: string[];
  status: string;
  icon: ProductIcon;
  screen?: string;
};

export const PRODUCTS: Product[] = [
  {
    id: "cover",
    number: "01",
    name: "Cover",
    phase: "Protect",
    action: "Arrange transit cover",
    headline: "Turn a route into a protected load record.",
    summary:
      "Add the load, route and vehicle once, arrange transit cover, and keep the policy papers beside the trip.",
    bullets: [
      "Load and route details in one place",
      "Policy papers attached to the trip",
      "Cover remains subject to policy terms",
    ],
    status: "Cover / active",
    icon: "shield",
    screen: "/images/landing/app-screens/4.webp",
  },
  {
    id: "track",
    number: "02",
    name: "Track",
    phase: "Move",
    action: "Follow the live trip",
    headline: "Know where the truck is—and what happens next.",
    summary:
      "Follow vehicle location, route progress and trip updates without piecing the journey together across calls and chats.",
    bullets: [
      "Live vehicle location",
      "Origin, destination and route context",
      "Trip status visible to the team",
    ],
    status: "Trip / in transit",
    icon: "truck",
    screen: "/images/landing/app-screens/3.webp",
  },
  {
    id: "claim",
    number: "03",
    name: "Claim",
    phase: "Recover",
    action: "Build the proof packet",
    headline: "When something goes wrong, the evidence stays together.",
    summary:
      "Capture photos and trip details, keep supporting documents with the incident, and follow the claim-support workflow.",
    bullets: [
      "Photo-led incident capture",
      "Trip and policy context retained",
      "Claim support from one workflow",
    ],
    status: "Papers / 3 of 3",
    icon: "claim",
  },
  {
    id: "invoice",
    number: "04",
    name: "Invoice",
    phase: "Trade",
    action: "Create trade records",
    headline: "Make the commercial record part of the load.",
    summary:
      "Create and share smart invoices so the movement of goods and the movement of money start from the same record.",
    bullets: [
      "Create clear digital invoices",
      "Keep party and load context together",
      "Share a consistent trade record",
    ],
    status: "Record / created",
    icon: "invoice",
  },
  {
    id: "khata",
    number: "05",
    name: "Khata",
    phase: "Reconcile",
    action: "Know every balance",
    headline: "Replace scattered notes with a shared account trail.",
    summary:
      "Maintain a digital khata for parties and transactions, so balances are easier to find, review and reconcile.",
    bullets: [
      "Party-wise account history",
      "A clearer balance trail",
      "Records available inside the app",
    ],
    status: "Balance / updated",
    icon: "khata",
  },
  {
    id: "pay",
    number: "06",
    name: "Pay",
    phase: "Settle",
    action: "Keep payments connected",
    headline: "Bring payment activity back to the trade record.",
    summary:
      "Use the app’s PhonePe-powered wallet experience to record and reconcile payment activity alongside the transaction.",
    bullets: [
      "Payment activity in one place",
      "Connected to trade context",
      "Designed for simpler reconciliation",
    ],
    status: "Payment / recorded",
    icon: "pay",
  },
];

export const BROCHURES = [
  {
    label: "English",
    href: "/brochures/Mandi-Plus-brochure-English-compressed.pdf",
  },
  {
    label: "Hindi",
    href: "/brochures/Mandi-Plus-brochure-Hindi-compressed.pdf",
  },
  {
    label: "Kannada",
    href: "/brochures/mandi-plus-brochure-kannada.pdf",
  },
];

export const EXPANSION_PRODUCTS = [
  {
    name: "Credit",
    summary: "Working-capital and NBFC credit experiences for mandi cash flow.",
  },
  {
    name: "Logistics sourcing",
    summary: "A broader workflow for finding and coordinating transport.",
  },
  {
    name: "Market insights",
    summary: "Price, supply and market signals across the mandi network.",
  },
];

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mandiplus.customer";

/**
 * The store a visitor is sent to is chosen by the pre-paint script in app/layout.tsx, which
 * stamps data-os="ios" on <html> before the first frame. Both links are rendered and CSS hides
 * the wrong one, so there is no flash and the page stays statically cacheable — reading the
 * User-Agent on the server would force this page to render per-request and lose the CDN.
 */
export const APP_STORE_ID = "6802538866";
export const APP_STORE_URL =
  `https://apps.apple.com/in/app/mandi-plus/id${APP_STORE_ID}`;

export const CALL_URL = "tel:+919606995351";

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
  value: "₹10 Cr+",
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
  phone: "9606995351",
  phoneHref: "tel:+919606995351",
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

/**
 * The team band above the footer. Portraits are pre-normalised web assets, not the raw
 * studio files: one shared 4:5 crop with the hair line pinned at 8.5% of frame height, so a
 * row of three shows aligned eye lines and one matched background plate.
 * Re-generate with scripts/build-team-portraits.py after adding or replacing a shot.
 */
export type TeamMember = {
  /** Also the portrait basename in /images/landing/team. */
  id: string;
  name: string;
  role: string;
};

export const TEAM: TeamMember[] = [
  { id: "bharath", name: "Bharath", role: "Founder & Managing Director" },
  { id: "manat", name: "Manat Choudhary", role: "Founder & CEO" },
  { id: "nikhil", name: "Nikhil", role: "Operations Team" },
  { id: "abhishrey", name: "Abhishrey", role: "Growth & Marketing" },
  { id: "nikhilc", name: "Nikhil Chaoudhary", role: "Sales & Relationships Head, Andhra Pradesh" },
  { id: "ashok", name: "Ashok", role: "Sales & Relationships Lead, Delhi" },
  { id: "om", name: "Om", role: "Engineering" },
  { id: "vikash", name: "Vikash", role: "Operations Team" },
  { id: "jaya", name: "Jaya", role: "Operations Team" },
  { id: "sanjay", name: "Sanjay", role: "Operations Team" },
  { id: "tauqeer", name: "Tauqeer", role: "Operations Team" },
  { id: "deepam", name: "Deepam", role: "Underwriter" },
  { id: "krithik", name: "Krithik", role: "UI/UX Designer" },
];

/**
 * The landing film — mandi traders at Azadpur vouching for MandiPlus on camera, with the
 * settled claim amounts shown on screen.
 *
 * Delivered from Cloudinary rather than /public: it is two minutes long, so the encode is far
 * too heavy to ship from the app origin, and Cloudinary can negotiate codec (`f_auto:video`)
 * and cut the poster straight out of the film (`so_<seconds>`) so the still can never drift
 * out of sync with the footage.
 *
 * Re-upload with mandiplus/src/scripts/upload-landing-film.ts. Tune weight by editing the
 * transform strings below — the derived rendition is regenerated on first request.
 */
const FILM_CLOUD = "https://res.cloudinary.com/dgxuvxyy0/video/upload";
const FILM_ASSET = "landing/yay";
/** Second the poster is cut from — the first clean frame of the trader speaking. */
const FILM_POSTER_AT = 6;

export const LANDING_FILM = {
  /** Held under the film so the first paint is never an empty box. */
  poster: `${FILM_CLOUD}/so_${FILM_POSTER_AT},f_auto,q_auto,w_1280,c_limit/${FILM_ASSET}.jpg`,
  /** One rung per breakpoint. Picked in JS, because `media` on a <source> is unreliable here. */
  srcWide: `${FILM_CLOUD}/f_auto:video,q_auto:eco,br_600k,w_1280,c_limit/${FILM_ASSET}.mp4`,
  srcNarrow: `${FILM_CLOUD}/f_auto:video,q_auto:eco,br_400k,w_854,c_limit/${FILM_ASSET}.mp4`,
  seconds: 87,
  /** Split so the second line can carry the hero's violet, the same way "नफा तुमचा." does. */
  title: {
    lead: "Apni Tareef Toh Sab Karte Hain…",
    accent: "Ek Baar Mandi Wale Ki Bhi Sun Lo",
  },
  label: "Azadpur Mandi ke traders MandiPlus ke baare mein.",
};

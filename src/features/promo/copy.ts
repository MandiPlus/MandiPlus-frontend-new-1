/**
 * The app's `en` locale is already Hinglish ("Mandi Plus mein aapka swagat
 * hai"), so the promo page speaks the same way. Language comes from
 * `users.preferredLanguage`; the name always stays in the script it was
 * stored in, because auto-transliterating a person's name gets it wrong in
 * public.
 */
export type PromoLanguage = 'en' | 'hi' | 'mr' | 'kn' | 'ta' | 'te';

export type PromoCopy = {
  greeting: string;
  /** Appended to the name. Empty where an honorific would not be said. */
  honorific: string;
  headline: string;
  tagline: string;
  codeLabel: string;
  codePlaceholder: string;
  wrongCode: string;
  videoCta: string;
  appCta: string;
  skip: string;
  downloadLabel: string;
  /** CSS variable for the script's Noto face, or null for the Latin stack. */
  fontVar: string | null;
};

const COPY: Record<PromoLanguage, PromoCopy> = {
  en: {
    greeting: 'Namaste,',
    honorific: ' ji',
    headline: 'MandiPlus wapas aa gaya hai',
    tagline: 'Risk humara · Munafa aapka',
    codeLabel: 'Code daalein',
    codePlaceholder: 'mandi',
    wrongCode: 'Code galat hai',
    videoCta: 'Dekhiye kya naya hai',
    appCta: 'App kholein',
    skip: 'Skip',
    downloadLabel: 'App download karein',
    fontVar: null,
  },
  hi: {
    greeting: 'नमस्ते,',
    honorific: ' जी',
    headline: 'मंडी प्लस वापस आ गया है',
    tagline: 'रिस्क हमारा · मुनाफ़ा आपका',
    codeLabel: 'कोड डालें',
    codePlaceholder: 'mandi',
    wrongCode: 'कोड ग़लत है',
    videoCta: 'देखिए क्या नया है',
    appCta: 'ऐप खोलें',
    skip: 'छोड़ें',
    downloadLabel: 'ऐप डाउनलोड करें',
    fontVar: '--font-noto-devanagari',
  },
  mr: {
    greeting: 'नमस्कार,',
    honorific: ' जी',
    headline: 'मंडी प्लस परत आलं आहे',
    tagline: 'रिस्क आमचा · नफा तुमचा',
    codeLabel: 'कोड टाका',
    codePlaceholder: 'mandi',
    wrongCode: 'कोड चुकीचा आहे',
    videoCta: 'काय नवीन आहे बघा',
    appCta: 'अ‍ॅप उघडा',
    skip: 'वगळा',
    downloadLabel: 'अ‍ॅप डाउनलोड करा',
    fontVar: '--font-noto-devanagari',
  },
  kn: {
    greeting: 'ನಮಸ್ಕಾರ,',
    honorific: '',
    headline: 'ಮಂಡಿ ಪ್ಲಸ್ ಮರಳಿ ಬಂದಿದೆ',
    tagline: 'ರಿಸ್ಕ್ ನಮ್ಮದು · ಲಾಭ ನಿಮ್ಮದು',
    codeLabel: 'ಕೋಡ್ ಹಾಕಿ',
    codePlaceholder: 'mandi',
    wrongCode: 'ಕೋಡ್ ತಪ್ಪಾಗಿದೆ',
    videoCta: 'ಹೊಸದೇನಿದೆ ನೋಡಿ',
    appCta: 'ಆ್ಯಪ್ ತೆರೆಯಿರಿ',
    skip: 'ಬಿಟ್ಟುಬಿಡಿ',
    downloadLabel: 'ಆ್ಯಪ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
    fontVar: '--font-noto-kannada',
  },
  ta: {
    greeting: 'வணக்கம்,',
    honorific: '',
    headline: 'மண்டி பிளஸ் திரும்பி வந்துவிட்டது',
    tagline: 'ரிஸ்க் எங்களுடையது · லாபம் உங்களுடையது',
    codeLabel: 'கோடு போடுங்கள்',
    codePlaceholder: 'mandi',
    wrongCode: 'கோடு தவறு',
    videoCta: 'என்ன புதிது எனப் பாருங்கள்',
    appCta: 'ஆப் திறக்க',
    skip: 'தவிர்',
    downloadLabel: 'ஆப் டவுன்லோடு செய்யுங்கள்',
    fontVar: '--font-noto-tamil',
  },
  te: {
    greeting: 'నమస్కారం,',
    honorific: '',
    headline: 'మండి ప్లస్ తిరిగి వచ్చింది',
    tagline: 'రిస్క్ మాది · లాభం మీది',
    codeLabel: 'కోడ్ వేయండి',
    codePlaceholder: 'mandi',
    wrongCode: 'కోడ్ తప్పు',
    videoCta: 'కొత్తది ఏమిటో చూడండి',
    appCta: 'యాప్ తెరవండి',
    skip: 'దాటవేయి',
    downloadLabel: 'యాప్ డౌన్‌లోడ్ చేయండి',
    fontVar: '--font-noto-telugu',
  },
};

export const PROMO_LANGUAGES = Object.keys(COPY) as PromoLanguage[];

/** Mirrors the backend fallback. An honorific is never added to it. */
export const FALLBACK_DISPLAY_NAME = 'MandiPlus parivaar';

export function getPromoCopy(language?: string | null): PromoCopy {
  const key = String(language || 'en').toLowerCase() as PromoLanguage;
  return COPY[key] || COPY.en;
}

/** Accepted in Latin and Devanagari — the word, not a password. */
export function isValidPromoCode(input: string): boolean {
  const value = String(input || '')
    .trim()
    .toLowerCase();
  return value === 'mandi' || value === 'मंडी' || value === 'मण्डी';
}

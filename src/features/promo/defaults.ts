import { FALLBACK_DISPLAY_NAME } from './copy';
import type { PromoLink } from './PromoReveal';

/** Mirrors the backend defaults, for visitors who arrive without a live link. */
export const GENERIC_PROMO_LINK: PromoLink = {
  name: FALLBACK_DISPLAY_NAME,
  language: 'en',
  campaign: 'wapsi',
  videoUrl:
    process.env.NEXT_PUBLIC_PROMO_VIDEO_URL || 'https://youtu.be/dQw4w9WgXcQ',
  playStoreUrl:
    'https://play.google.com/store/apps/details?id=com.mandiplus.customer',
  appStoreUrl: 'https://apps.apple.com/in/app/mandi-plus/id6802538866',
};

import { FALLBACK_DISPLAY_NAME } from './copy';
import type { PromoLink } from './PromoReveal';

/** Mirrors the backend defaults, for visitors who arrive without a live link. */
export const GENERIC_PROMO_LINK: PromoLink = {
  name: FALLBACK_DISPLAY_NAME,
  language: 'en',
  campaign: 'wapsi',
  videoUrl:
    process.env.NEXT_PUBLIC_PROMO_VIDEO_URL ||
    'https://res.cloudinary.com/dgxuvxyy0/video/upload/v1788501999/promo/mandiplus-wapsi.mp4',
  videoPosterUrl:
    'https://res.cloudinary.com/dgxuvxyy0/image/upload/v1788502001/promo/mandiplus-wapsi-poster.jpg',
  playStoreUrl:
    'https://play.google.com/store/apps/details?id=com.mandiplus.customer',
  appStoreUrl: 'https://apps.apple.com/in/app/mandi-plus/id6802538866',
};

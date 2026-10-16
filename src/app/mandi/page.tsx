'use client';

import PromoReveal from '@/features/promo/PromoReveal';
import { GENERIC_PROMO_LINK } from '@/features/promo/defaults';

/** The campaign without a name, for anyone who arrives without a link. */
export default function PromoPage() {
  return <PromoReveal link={GENERIC_PROMO_LINK} />;
}

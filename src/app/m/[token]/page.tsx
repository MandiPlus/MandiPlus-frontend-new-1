'use client';

import { use, useEffect, useState } from 'react';
import PromoReveal, { type PromoLink } from '@/features/promo/PromoReveal';
import { GENERIC_PROMO_LINK } from '@/features/promo/defaults';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/**
 * Personalised campaign page. No sign-in: the visitor is an existing customer
 * who only has the link, opened inside WhatsApp's in-app browser. A dead or
 * expired token falls back to the un-named reveal rather than an error, because
 * a broken link in a group chat looks bad for months.
 */
export default function PromoTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [link, setLink] = useState<PromoLink | null>(null);
  const [personalised, setPersonalised] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/promo/p/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('not found');
        return (await response.json()) as PromoLink;
      })
      .then((data) => {
        if (cancelled) return;
        setLink(data);
        setPersonalised(true);
      })
      .catch(() => !cancelled && setLink(GENERIC_PROMO_LINK));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!link) {
    return <main className="min-h-dvh bg-[#eeeafc]" />;
  }

  return <PromoReveal link={link} token={personalised ? token : undefined} />;
}

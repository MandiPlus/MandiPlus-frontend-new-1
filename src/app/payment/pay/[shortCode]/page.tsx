import type { Metadata } from 'next';
import PaymentBridge from './PaymentBridge';

export const metadata: Metadata = {
  title: 'Opening Payment | MandiPlus',
  referrer: 'origin-when-cross-origin',
};

export default async function PaymentPayPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  return <PaymentBridge shortCode={shortCode} />;
}

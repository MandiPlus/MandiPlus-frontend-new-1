'use client';

import { useSearchParams } from 'next/navigation';

import TrackingLegacyPage from './Tracking';
import TrackingFleetPage from './TrackingFleetPage';

export default function TrackingExperience() {
  const searchParams = useSearchParams();
  const rawVehicle = searchParams.get('vehicle') || searchParams.get('v') || '';
  const hasSecureLink = Boolean(
    searchParams.get('t') || rawVehicle.startsWith('tlnk_'),
  );
  const isEmbeddedAssistant = searchParams.get('embedBot') === '1';

  if (hasSecureLink || isEmbeddedAssistant) {
    return <TrackingLegacyPage />;
  }

  return <TrackingFleetPage />;
}

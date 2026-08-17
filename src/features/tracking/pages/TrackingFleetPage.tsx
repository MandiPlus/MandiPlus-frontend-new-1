'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Headphones,
  HelpCircle,
  MapPinned,
  Share2,
  TicketPercent,
  Truck,
  WalletCards,
  X,
} from 'lucide-react';

import FleetGoogleMap, { type FleetMapItem } from '@/components/maps/FleetGoogleMap';
import { useAuth } from '@/features/auth/context/AuthContext';
import { CustomerAppShell } from '@/features/customer-app/CustomerAppShell';
import { useCustomerAppData } from '@/features/customer-app/useCustomerAppData';
import type { CustomerInvoice } from '@/features/customer-app/utils';
import {
  consumeFastagView,
  createTrackingPackCheckout,
  getLiveTrackingTrips,
  getTrackingPackStatus,
  getTrackingPacksMe,
  getTrackingRoute,
  type LiveTrackingTrip,
  type LocationPoint,
  trackVehicle,
  type TrackingData,
  type TrackingPackEntitlement,
  type TrackingPackPurchase,
  type TrackingRoute,
} from '@/features/tracking/api';
import styles from './tracking-app.module.css';

const TripGoogleMap = dynamic(() => import('@/components/maps/TripGoogleMap'), {
  ssr: false,
  loading: () => <MapLoading label="Live location aa rahi hai..." />,
});

const REFRESH_INTERVAL_MS = 60_000;
const RECENT_TRIPS_PAGE_SIZE = 10;
const FASTAG_VIEWS_TOTAL = 3;
const PAYMENT_ATTEMPTS = 6;
const PAYMENT_INTERVAL_MS = 1_500;
const PAYMENT_SESSION_KEY = 'mandiplus:tracking-pack-pending';
const TERMINAL_PAYMENT_STATES = new Set(['FAILED', 'CANCELLED', 'EXPIRED', 'DECLINED']);

type Mode = 'overview' | 'detail' | 'packs';
type PaymentPhase = 'confirming' | 'pending' | 'failed' | null;

type RecentTrip = {
  id: string;
  vehicleNumber: string;
  route: string;
  date: string;
  invoiceNumber: string;
  sourceName: string;
  destinationName: string;
  origin: LocationPoint | null;
  destination: LocationPoint | null;
};

export default function TrackingFleetPage() {
  const data = useCustomerAppData();

  return (
    <CustomerAppShell activeTab="tracking" partnerActive={data.partnerActive}>
      <TrackingApp data={data} />
    </CustomerAppShell>
  );
}

function TrackingApp({ data }: { data: ReturnType<typeof useCustomerAppData> }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('overview');
  const [trips, setTrips] = useState<LiveTrackingTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<LiveTrackingTrip | null>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [route, setRoute] = useState<TrackingRoute | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [recentVisibleCount, setRecentVisibleCount] = useState(RECENT_TRIPS_PAGE_SIZE);
  const [packEntitlement, setPackEntitlement] = useState<TrackingPackEntitlement | null>(null);
  const [packPurchases, setPackPurchases] = useState<TrackingPackPurchase[]>([]);
  const [packViewsRemaining, setPackViewsRemaining] = useState<number | null>(null);
  const [packsLoading, setPacksLoading] = useState(false);
  const [paywallVehicle, setPaywallVehicle] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [pendingCheckoutId, setPendingCheckoutId] = useState('');
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const detailRequestRef = useRef(0);
  const paymentGenerationRef = useRef(0);
  const paymentPollingRef = useRef(false);

  const loadPacks = useCallback(async (surfaceError = false) => {
    setPacksLoading(true);
    try {
      const payload = await getTrackingPacksMe();
      setPackEntitlement(payload.entitlement || null);
      setPackPurchases(payload.purchases || []);
      setPackViewsRemaining(payload.fastagViewsRemaining);
      return payload;
    } catch (error) {
      if (surfaceError) setDetailError(readableError(error, 'Unable to load Tracking Packs'));
      return null;
    } finally {
      setPacksLoading(false);
    }
  }, []);

  const loadTrips = useCallback(async (silent = false) => {
    if (!silent) setLoadingTrips(true);
    setTripsError(null);
    try {
      setTrips(await getLiveTrackingTrips());
    } catch (error) {
      setTripsError(readableError(error, 'Live trips load nahi ho payi.'));
      if (!silent) setTrips([]);
    } finally {
      if (!silent) setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
    void loadPacks();
  }, [loadPacks, loadTrips]);

  useEffect(() => {
    if (mode !== 'overview') return;
    const interval = window.setInterval(() => void loadTrips(true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadTrips, mode]);

  const openVehicle = useCallback(async (
    trip: LiveTrackingTrip,
    options?: { silent?: boolean; skipAccessCheck?: boolean },
  ) => {
    const vehicleNumber = vehicleKey(trip.vehicleNumber);
    if (!vehicleNumber) return;

    if (trip.locationSource === 'fastag' && !options?.skipAccessCheck) {
      let packActive = Boolean(packEntitlement?.active || trip.fastagPackActive);
      let viewsRemaining = packViewsRemaining ?? trip.fastagViewsRemaining ?? null;
      if (!packActive && viewsRemaining === null) {
        const packs = await loadPacks();
        if (!packs) {
          setTripsError('Couldn’t check your tracking access. Please try again.');
          return;
        }
        packActive = Boolean(packs.entitlement?.active);
        viewsRemaining = packs.fastagViewsRemaining;
      }
      if (!packActive && Number(viewsRemaining || 0) <= 0) {
        setPaywallVehicle(vehicleNumber);
        setPaymentError(null);
        setPaymentPhase(null);
        return;
      }
    }

    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedTrip(trip);
    setSheetExpanded(false);
    setDetailError(null);
    if (!options?.silent) {
      setMode('detail');
      setLoadingDetail(true);
      setTracking(trackingFromTrip(trip));
      setRoute(null);
    }

    try {
      let nextTracking: TrackingData;
      if (trip.locationSource === 'fastag') {
        const view = await consumeFastagView(vehicleNumber);
        if (view.unlocked === false) {
          if (requestId !== detailRequestRef.current) return;
          setMode('overview');
          setTracking(null);
          setRoute(null);
          setPaywallVehicle(vehicleNumber);
          return;
        }
        nextTracking = view.tracking || (await trackVehicle(vehicleNumber)).data;
        nextTracking = {
          ...nextTracking,
          fastagUnlocked: view.unlocked ?? nextTracking.fastagUnlocked,
          fastagViewsRemaining: view.viewsRemaining ?? nextTracking.fastagViewsRemaining,
        };
        if (typeof nextTracking.fastagViewsRemaining === 'number') {
          setPackViewsRemaining(nextTracking.fastagViewsRemaining);
        }
      } else {
        nextTracking = (await trackVehicle(vehicleNumber)).data;
        if (nextTracking.locationSource === 'fastag') {
          const view = await consumeFastagView(vehicleNumber);
          if (view.unlocked === false) {
            if (requestId !== detailRequestRef.current) return;
            setMode('overview');
            setTracking(null);
            setRoute(null);
            setPaywallVehicle(vehicleNumber);
            return;
          }
          nextTracking = {
            ...(view.tracking || nextTracking),
            fastagUnlocked: view.unlocked ?? nextTracking.fastagUnlocked,
            fastagViewsRemaining: view.viewsRemaining ?? nextTracking.fastagViewsRemaining,
          };
        }
      }

      if (requestId !== detailRequestRef.current) return;
      setTracking(nextTracking);
      setSelectedTrip((current) => current || trip);
      setMode('detail');

      if (nextTracking.status === 'online') {
        try {
          const nextRoute = await getTrackingRoute(vehicleNumber);
          if (requestId === detailRequestRef.current) setRoute(nextRoute);
        } catch {
          if (requestId === detailRequestRef.current) setRoute(null);
        }
      }
    } catch (error) {
      if (requestId !== detailRequestRef.current) return;
      setDetailError(readableError(error, 'Vehicle ki location nahi mil payi.'));
    } finally {
      if (!options?.silent && requestId === detailRequestRef.current) setLoadingDetail(false);
    }
  }, [loadPacks, packEntitlement?.active, packViewsRemaining]);

  useEffect(() => {
    if (mode !== 'detail' || !selectedTrip || tracking?.locationSource === 'fastag') return;
    const interval = window.setInterval(
      () => void openVehicle(selectedTrip, { silent: true, skipAccessCheck: true }),
      REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [mode, openVehicle, selectedTrip, tracking?.locationSource]);

  const confirmPayment = useCallback(async (
    merchantOrderId: string,
    options?: { settle?: boolean; vehicleNumber?: string },
  ) => {
    if (!merchantOrderId || paymentPollingRef.current) return false;
    const generation = ++paymentGenerationRef.current;
    const attempts = options?.settle ? PAYMENT_ATTEMPTS : 2;
    paymentPollingRef.current = true;
    setPaymentPhase('confirming');
    setPaymentError(null);

    try {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (generation !== paymentGenerationRef.current) return false;
        try {
          const status = await getTrackingPackStatus(merchantOrderId);
          const state = String(status.state || '').toUpperCase();
          if (status.paid) {
            window.sessionStorage.removeItem(PAYMENT_SESSION_KEY);
            setPendingCheckoutId('');
            setPaymentPhase(null);
            setPaymentError(null);
            setPaywallVehicle('');
            await loadPacks();
            const unlockedVehicle = options?.vehicleNumber || paywallVehicle;
            if (unlockedVehicle) {
              const match = trips.find((item) => vehicleKey(item.vehicleNumber) === vehicleKey(unlockedVehicle));
              if (match) void openVehicle(match, { skipAccessCheck: true });
            }
            return true;
          }
          if (TERMINAL_PAYMENT_STATES.has(state)) {
            setPaymentPhase('failed');
            setPaymentError('Payment wasn’t completed. Please try again.');
            return false;
          }
        } catch {
          // PhonePe status can be briefly unavailable while returning from checkout.
        }
        if (attempt < attempts - 1) await wait(PAYMENT_INTERVAL_MS);
      }
      setPaymentPhase(options?.settle ? 'pending' : 'failed');
      setPaymentError(options?.settle ? null : 'Payment wasn’t completed. Please try again.');
      return false;
    } finally {
      if (generation === paymentGenerationRef.current) paymentPollingRef.current = false;
    }
  }, [loadPacks, openVehicle, paywallVehicle, trips]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(PAYMENT_SESSION_KEY);
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as { merchantOrderId?: string; vehicleNumber?: string };
      if (!pending.merchantOrderId) return;
      setPendingCheckoutId(pending.merchantOrderId);
      if (pending.vehicleNumber) setPaywallVehicle(pending.vehicleNumber);
      void confirmPayment(pending.merchantOrderId, {
        settle: true,
        vehicleNumber: pending.vehicleNumber,
      });
    } catch {
      window.sessionStorage.removeItem(PAYMENT_SESSION_KEY);
    }
  }, [confirmPayment]);

  const purchasePack = useCallback(async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setPaymentError(null);
    setPaymentPhase(null);
    try {
      const checkout = await createTrackingPackCheckout();
      const merchantOrderId = checkout.merchantOrderId || checkout.merchantTransactionId;
      setPendingCheckoutId(merchantOrderId);
      window.sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
        merchantOrderId,
        vehicleNumber: paywallVehicle || null,
      }));
      if (!checkout.redirectUrl) throw new Error('PhonePe checkout URL was not returned.');
      window.location.assign(checkout.redirectUrl);
    } catch (error) {
      setPaymentPhase('failed');
      setPaymentError(readableError(error, 'PhonePe is unavailable right now. Please try again shortly.'));
      setCheckoutLoading(false);
    }
  }, [checkoutLoading, paywallVehicle]);

  const goBack = useCallback(() => {
    detailRequestRef.current += 1;
    setMode('overview');
    setSelectedTrip(null);
    setTracking(null);
    setRoute(null);
    setDetailError(null);
    setSheetExpanded(false);
  }, []);

  const fleetMapItems = useMemo<FleetMapItem[]>(() => trips.flatMap((trip) => {
    const mayShowFastag = trip.locationSource !== 'fastag' || Boolean(packEntitlement?.active || trip.fastagPackActive);
    const current = coordFromUnknown(trip.lastLocation);
    if (!mayShowFastag || !current) return [];
    return [{
      id: trip.id,
      vehicleNumber: trip.vehicleNumber,
      current,
      isOnline: Boolean(trip.lastLocation),
    }];
  }), [packEntitlement?.active, trips]);

  const recentTrips = useMemo(() => buildRecentTrips(data.invoices, trips), [data.invoices, trips]);
  const visibleRecentTrips = recentTrips.slice(0, recentVisibleCount);
  const packPrice = tracking?.trackingPack?.priceInr ?? packEntitlement?.priceInr ?? 99;
  const packListPrice = tracking?.trackingPack?.listPriceInr ?? packEntitlement?.listPriceInr ?? 199;
  const paymentBusy = checkoutLoading || paymentPhase === 'confirming';

  return (
    <div className={styles.root}>
      <TrackingHeader
        nested={mode !== 'overview'}
        title={mode === 'packs' ? 'Tracking Packs' : 'Track Vehicle'}
        userName={user?.name}
        walletBalance={data.wallet?.availableBalance}
        onBack={goBack}
      />

      {mode === 'overview' ? (
        <Overview
          trips={trips}
          fleetMapItems={fleetMapItems}
          loading={loadingTrips}
          error={tripsError}
          recentTrips={visibleRecentTrips}
          canViewMore={visibleRecentTrips.length < recentTrips.length}
          onTrip={(trip) => void openVehicle(trip)}
          onMapVehicle={(item) => {
            const match = trips.find((trip) => trip.id === item.id);
            if (match) void openVehicle(match);
          }}
          onPacks={() => {
            setDetailError(null);
            setMode('packs');
            void loadPacks(true);
          }}
          onRecent={(trip) => {
            detailRequestRef.current += 1;
            setSelectedTrip(null);
            setTracking(trackingFromRecentTrip(trip));
            setRoute({
              provider: 'recent_trip_snapshot',
              points: [trip.origin, trip.destination].filter((point): point is LocationPoint => Boolean(point)),
            });
            setSheetExpanded(false);
            setDetailError(null);
            setMode('detail');
          }}
          onViewMore={() => setRecentVisibleCount((count) => count + RECENT_TRIPS_PAGE_SIZE)}
        />
      ) : null}

      {mode === 'detail' ? (
        <Detail
          tracking={tracking}
          route={route}
          loading={loadingDetail}
          error={detailError}
          sheetExpanded={sheetExpanded}
          onToggleSheet={() => setSheetExpanded((value) => !value)}
        />
      ) : null}

      {mode === 'packs' ? (
        <Packs
          loading={packsLoading}
          checkoutLoading={checkoutLoading}
          purchases={packPurchases}
          price={packPrice}
          error={detailError}
          onBuy={() => void purchasePack()}
        />
      ) : null}

      {paywallVehicle ? (
        <Paywall
          price={packPrice}
          listPrice={packListPrice}
          busy={paymentBusy}
          phase={paymentPhase}
          error={paymentError}
          onClose={() => {
            if (!paymentBusy) setPaywallVehicle('');
          }}
          onBuy={() => {
            if (pendingCheckoutId && paymentPhase === 'pending') {
              void confirmPayment(pendingCheckoutId, { settle: true, vehicleNumber: paywallVehicle });
            } else {
              void purchasePack();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function TrackingHeader({
  nested,
  title,
  userName,
  walletBalance,
  onBack,
}: {
  nested: boolean;
  title: string;
  userName?: string | null;
  walletBalance?: number;
  onBack: () => void;
}) {
  if (nested) {
    return (
      <header className={styles.secondaryHeader}>
        <button type="button" className={styles.backButton} onClick={onBack} aria-label="Back to tracking">
          <ArrowLeft size={22} />
        </button>
        <h1>{title}</h1>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <Link href="/profile" className={styles.avatar} aria-label="Open profile">
        {initials(userName)}
      </Link>
      <h1>{title}</h1>
      <Link href="/customer/wallet" className={styles.walletPill} aria-label="Open wallet">
        <WalletCards size={17} />
        <span>{shortMoney(walletBalance)}</span>
      </Link>
      <Link href="/support" className={styles.helpButton} aria-label="Get help">
        <HelpCircle size={21} />
      </Link>
    </header>
  );
}

function Overview({
  trips,
  fleetMapItems,
  loading,
  error,
  recentTrips,
  canViewMore,
  onTrip,
  onMapVehicle,
  onPacks,
  onRecent,
  onViewMore,
}: {
  trips: LiveTrackingTrip[];
  fleetMapItems: FleetMapItem[];
  loading: boolean;
  error: string | null;
  recentTrips: RecentTrip[];
  canViewMore: boolean;
  onTrip: (trip: LiveTrackingTrip) => void;
  onMapVehicle: (vehicle: FleetMapItem) => void;
  onPacks: () => void;
  onRecent: (trip: RecentTrip) => void;
  onViewMore: () => void;
}) {
  return (
    <main className={styles.overview}>
      <div className={styles.fleetMap}>
        {loading && !fleetMapItems.length ? (
          <MapLoading label="Live trips dhoondh rahe hain..." />
        ) : (
          <FleetGoogleMap vehicles={fleetMapItems} onVehicleSelect={onMapVehicle} />
        )}
      </div>

      {error ? <div className={styles.errorBox}>{error}</div> : null}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Live vehicles</h2>
          <button type="button" onClick={onPacks}>Tracking Packs</button>
        </div>
        {loading ? (
          <div className={styles.loadingPanel}><Spinner /><span>Live trips dhoondh rahe hain...</span></div>
        ) : trips.length ? (
          <div className={styles.listCard}>
            {trips.map((trip) => {
              const canShowFastag = trip.locationSource !== 'fastag' || trip.fastagPackActive;
              const location = canShowFastag ? shortPlace(trip.lastLocation?.address) : '';
              const route = trip.route || [trip.sourceName, trip.destinationName].filter(Boolean).join(' to ');
              return (
                <button key={trip.id} type="button" className={styles.tripRow} onClick={() => onTrip(trip)}>
                  <span className={styles.rowIcon}><Truck size={20} /></span>
                  <span className={styles.rowBody}>
                    <strong>{trip.vehicleNumber}</strong>
                    {location || route ? <small>{location || route}</small> : null}
                  </span>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyCard}>Koi live trip nahi</div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><h2>Recent trips</h2></div>
        {recentTrips.length ? (
          <div className={styles.listCard}>
            {recentTrips.map((trip) => (
              <button key={trip.id} type="button" className={styles.recentRow} onClick={() => onRecent(trip)}>
                <span className={styles.rowIcon}><Truck size={20} /></span>
                <span className={styles.rowBody}>
                  <strong>{trip.vehicleNumber}</strong>
                  <span>{trip.route || 'Route details unavailable'}</span>
                  <small>{trip.date || 'Recent trip'}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
            {canViewMore ? (
              <button type="button" className={styles.viewMore} onClick={onViewMore}>
                View more <ChevronDown size={17} />
              </button>
            ) : null}
          </div>
        ) : (
          <div className={styles.emptyCard}>No recent trips</div>
        )}
      </section>
    </main>
  );
}

function Detail({
  tracking,
  route,
  loading,
  error,
  sheetExpanded,
  onToggleSheet,
}: {
  tracking: TrackingData | null;
  route: TrackingRoute | null;
  loading: boolean;
  error: string | null;
  sheetExpanded: boolean;
  onToggleSheet: () => void;
}) {
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const expandedFromScrollRef = useRef(false);
  const current = isCoord(tracking?.location) ? tracking.location : null;
  const origin = isCoord(tracking?.origin) ? tracking.origin : null;
  const destination = isCoord(tracking?.destination) ? tracking.destination : null;
  const center = current || destination || origin || { lat: 22.9734, lng: 78.6569 };
  const sourceName = shortPlace(tracking?.originLabel) || 'Route shuru';
  const destinationName = shortPlace(tracking?.destinationLabel) || 'Route khatam';
  const currentName = sanitizePlacePrefix(shortPlace(tracking?.location?.address)) ||
    (tracking?.status === 'online' ? 'live location' : sourceName);
  const isFastag = tracking?.locationSource === 'fastag';
  const isActiveLiveTrip = isActiveLiveTracking(tracking);
  const progress = tripProgress(tracking);
  const motionState = tracking?.motion?.state;
  const statusLabel = motionState === 'ARRIVED'
    ? 'Destination pahunch gaya'
    : motionState === 'MOVING' || isActiveLiveTrip
      ? 'Raaste mein hai'
      : motionState === 'MOVEMENT_CANDIDATE'
        ? 'Movement confirm ho rahi hai'
        : motionState === 'AT_START'
          ? 'Trip abhi start nahi hui'
          : null;
  const headline = trackingHeadline(tracking, currentName, destinationName, isFastag);
  const subline = trackingSubline(tracking);
  const showConsent = isFastag && !isAllowedConsentStatus(tracking?.consentStatus);
  const mapsUrl = current ? `https://www.google.com/maps/search/?api=1&query=${current.lat},${current.lng}` : '';

  useEffect(() => {
    if (sheetExpanded) return;
    expandedFromScrollRef.current = false;
    if (sheetScrollRef.current) sheetScrollRef.current.scrollTop = 0;
  }, [sheetExpanded, tracking?.vehicleNumber]);

  return (
    <main className={styles.detail}>
      <div className={styles.detailMap}>
        <TripGoogleMap
          center={center}
          current={current}
          source={origin}
          destination={destination}
          routePoints={route?.points || []}
          currentLabel={currentName}
          sourceLabel={sourceName}
          destinationLabel={destinationName}
          zoom={16}
          followMode={tracking?.status === 'online'}
          lastGpsRecordedAt={tracking?.location?.timeRecorded || null}
          isOnline={tracking?.status === 'online'}
          routeDistanceMeters={route?.distanceMeters ?? null}
          routeDurationSeconds={route?.durationSeconds ?? null}
          canSimulate={Boolean(tracking?.motion?.canSimulate)}
          simulationSpeedKph={tracking?.motion?.displaySpeedKph ?? null}
          predictionValidUntil={tracking?.motion?.predictionValidUntil ?? null}
          motionState={tracking?.motion?.state ?? null}
        />
        {loading && !tracking ? <div className={styles.mapOverlay}><Spinner /> Live location aa rahi hai...</div> : null}
      </div>

      {error ? <div className={styles.detailError}>{error}</div> : null}

      {tracking ? (
        <section className={`${styles.tripSheet} ${sheetExpanded ? styles.tripSheetExpanded : ''}`}>
          <button
            type="button"
            className={styles.sheetHandleButton}
            onClick={onToggleSheet}
            aria-label={sheetExpanded ? 'Details neeche karein' : 'Details upar karein'}
            aria-controls="tracking-trip-details"
            aria-expanded={sheetExpanded}
          >
            <span />
          </button>
          <div
            id="tracking-trip-details"
            ref={sheetScrollRef}
            className={styles.sheetScroll}
            role="region"
            aria-label={`${tracking.vehicleNumber} trip details`}
            tabIndex={0}
            onScroll={(event) => {
              if (
                sheetExpanded ||
                expandedFromScrollRef.current ||
                event.currentTarget.scrollTop <= 2
              ) return;

              expandedFromScrollRef.current = true;
              onToggleSheet();
            }}
          >
            {isFastag ? (
              <>
                {showConsent ? <DriverConsentPrompt /> : null}
                <div className={styles.fastagTopRow}>
                  <h2>{tracking.vehicleNumber}</h2>
                  <span>
                    {tracking.trackingPack?.active
                      ? 'FastTag'
                      : typeof tracking.fastagViewsRemaining === 'number'
                        ? `FastTag · ${tracking.fastagViewsRemaining}/${FASTAG_VIEWS_TOTAL}`
                        : 'FastTag'}
                  </span>
                </div>
                <p className={styles.fastagPlace}>{headline}</p>
                {mapsUrl ? <GoogleMapsAction href={mapsUrl} fastag /> : null}
                <RouteSummary source={sourceName} destination={destinationName} compact />
              </>
            ) : (
              <>
                {statusLabel ? <div className={styles.statusPill}><Truck size={14} />{statusLabel}</div> : null}
                <h2 className={styles.tripTitle}>{tracking.vehicleNumber}</h2>
                <p className={styles.tripHeadline}>{headline}</p>
                {subline ? <p className={styles.tripSubline}>{subline}</p> : null}
                {mapsUrl ? <GoogleMapsAction href={mapsUrl} /> : null}
                <RouteSummary source={sourceName} destination={destinationName} />
                <div className={styles.progressPanel}>
                  {progress.remainingTime ? (
                    <div className={styles.etaBlock}>
                      <Clock3 size={24} />
                      <span><small>Pahunchne ka time</small><strong>{progress.remainingTime}</strong></span>
                    </div>
                  ) : null}
                  <div className={styles.progressBlock}>
                    <div><small>Trip ki progress</small><strong>{progress.percentLabel}</strong></div>
                    <span className={styles.progressTrack}>
                      <span style={{ width: `${progress.visualPercent}%` }} />
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className={styles.sheetActions}>
              <a
                href={`https://wa.me/919900186757?text=${encodeURIComponent(`Hi MandiPlus, I need help tracking vehicle ${tracking.vehicleNumber}.`)}`}
                target="_blank"
                rel="noreferrer"
                className={styles.supportAction}
              >
                <Headphones size={18} /> Humse baat karein
              </a>
              {tracking.shareUrl && !isFastag ? <ShareAction tracking={tracking} /> : null}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function DriverConsentPrompt() {
  return (
    <div className={styles.consentPrompt}>
      <div className={styles.consentIllustration}>
        <Image src="/customer-app/tracking/driver-live-location-consent.webp" alt="" fill sizes="116px" />
      </div>
      <strong>Driver se live location on karwayein</strong>
    </div>
  );
}

function GoogleMapsAction({ href, fastag = false }: { href: string; fastag?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={styles.mapsAction}>
      <MapPinned size={21} />
      <span>{fastag ? 'Google Maps mein last FastTag location dekhein' : 'Google Maps mein current location dekhein'}</span>
      <ExternalLink size={17} />
    </a>
  );
}

function RouteSummary({ source, destination, compact = false }: { source: string; destination: string; compact?: boolean }) {
  return (
    <div className={`${styles.routeSummary} ${compact ? styles.routeSummaryCompact : ''}`}>
      <span><small>From</small><strong>{source}</strong></span>
      <i />
      <span><small>To</small><strong>{destination}</strong></span>
    </div>
  );
}

function ShareAction({ tracking }: { tracking: TrackingData }) {
  const share = async () => {
    const url = tracking.shareUrl || window.location.href;
    if (navigator.share) {
      await navigator.share({ title: tracking.vehicleNumber, url }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url);
    }
  };
  return (
    <button type="button" className={styles.shareAction} onClick={() => void share()}>
      <Share2 size={18} /> Live link share karein
    </button>
  );
}

function Packs({
  loading,
  checkoutLoading,
  purchases,
  price,
  error,
  onBuy,
}: {
  loading: boolean;
  checkoutLoading: boolean;
  purchases: TrackingPackPurchase[];
  price: number;
  error: string | null;
  onBuy: () => void;
}) {
  return (
    <main className={styles.packsPage}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}><h2>Tracking Packs</h2></div>
        <button type="button" className={styles.packBuyButton} disabled={checkoutLoading} onClick={onBuy}>
          {checkoutLoading ? <Spinner /> : <><TicketPercent size={18} /> Buy Tracking Pack · ₹{price}</>}
        </button>
        {loading ? (
          <div className={styles.loadingPanel}><Spinner /></div>
        ) : purchases.length ? (
          <div className={styles.listCard}>
            {purchases.map((purchase) => (
              <div key={purchase.id} className={styles.purchaseRow}>
                <strong>{purchase.packLabel}</strong>
                <span>Amount paid: ₹{purchase.amountPaid}{purchase.listPriceAmount > purchase.amountPaid ? ` (₹${purchase.listPriceAmount})` : ''}</span>
                <span>Paid on: {formatDateTime(purchase.paidAt)}</span>
                <span>Valid until: {formatDateTime(purchase.expiresAt)}</span>
                <span>PhonePe UTR: {purchase.phonepeUtr || '—'}</span>
                <span>{purchase.status}</span>
              </div>
            ))}
          </div>
        ) : <p className={styles.packsEmpty}>No Tracking Pack purchases yet</p>}
        {error ? <div className={styles.errorBox}>{error}</div> : null}
      </section>
    </main>
  );
}

function Paywall({
  price,
  listPrice,
  busy,
  phase,
  error,
  onClose,
  onBuy,
}: {
  price: number;
  listPrice: number;
  busy: boolean;
  phase: PaymentPhase;
  error: string | null;
  onClose: () => void;
  onBuy: () => void;
}) {
  return (
    <div className={styles.paywallBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target && !busy) onClose();
    }}>
      <section className={styles.paywall} role="dialog" aria-modal="true" aria-labelledby="tracking-pack-title">
        <div className={styles.closeRow}>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"><X size={22} /></button>
        </div>
        <div className={styles.paywallHero}>
          <Image src="/customer-app/tracking/fastag-tracking-pack-hero.webp" alt="FastTag vehicle tracking" fill sizes="(max-width: 480px) 88vw, 420px" priority />
        </div>
        <span className={styles.promoBadge}>Promo</span>
        <h2 id="tracking-pack-title">Track every FastTag vehicle</h2>
        <p>Unlimited FastTag tracking for 30 days.</p>
        <div className={styles.priceRow}>
          <del>₹{listPrice}</del><strong>₹{price}</strong><span>/ month</span>
        </div>
        <small className={styles.startsToday}>30 days from today</small>
        {phase === 'pending' ? <p className={styles.paymentMessage}>Confirming your payment…</p> : null}
        {error ? <p className={styles.paymentError}>{error}</p> : null}
        <button type="button" className={styles.paywallCta} disabled={busy} onClick={onBuy}>
          {busy ? <Spinner /> : phase === 'pending' ? 'Check payment' : `Pay ₹${price} with PhonePe`}
        </button>
      </section>
    </div>
  );
}

function MapLoading({ label }: { label: string }) {
  return <div className={styles.mapLoading}><Spinner /><span>{label}</span></div>;
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

function trackingFromTrip(trip: LiveTrackingTrip): TrackingData {
  const location = coordFromUnknown(trip.lastLocation);
  return {
    vehicleNumber: trip.vehicleNumber,
    tripId: trip.tripId || undefined,
    tripStatus: trip.status,
    status: location ? 'online' : 'unknown',
    eta: trip.eta || undefined,
    location: location ? {
      ...location,
      address: trip.lastLocation?.address || undefined,
      timeRecorded: trip.lastLocation?.timeRecorded || undefined,
      distanceRemained: numberOrUndefined(trip.lastLocation?.distanceRemained),
      timeRemained: numberOrUndefined(trip.lastLocation?.timeRemained),
      distanceTravel: trip.lastLocation?.distanceTravel ?? undefined,
      totalDistance: trip.lastLocation?.totalDistance ?? undefined,
    } : undefined,
    origin: coordFromUnknown(trip.origin) || undefined,
    destination: coordFromUnknown(trip.destination) || undefined,
    originLabel: trip.sourceName || undefined,
    destinationLabel: trip.destinationName || undefined,
    locationSource: trip.locationSource || null,
    fastagViewsRemaining: trip.fastagViewsRemaining,
    fastagUnlocked: trip.locationSource === 'fastag' ? Boolean(trip.fastagPackActive) : undefined,
  };
}

function buildRecentTrips(invoices: CustomerInvoice[], liveTrips: LiveTrackingTrip[]): RecentTrip[] {
  const liveVehicles = new Set(liveTrips.map((trip) => vehicleKey(trip.vehicleNumber)));
  const seen = new Set<string>();
  return invoices.flatMap((invoice) => {
    const vehicleNumber = vehicleKey(invoice.vehicleNumber || invoice.truckNumber);
    if (!vehicleNumber || liveVehicles.has(vehicleNumber) || seen.has(vehicleNumber)) return [];
    seen.add(vehicleNumber);
    const rawInvoice = invoice as unknown as Record<string, unknown>;
    const sourceName = shortPlace(firstReadableAddress(invoice.supplierAddress) || String(rawInvoice.sourceName || ''));
    const destinationName = shortPlace(
      firstReadableAddress(invoice.shipToAddress) ||
      firstReadableAddress(invoice.billToAddress) ||
      String(rawInvoice.destinationName || invoice.billToName || ''),
    );
    return [{
      id: invoice.id || `${vehicleNumber}-${invoice.invoiceNumber}`,
      vehicleNumber,
      route: [sourceName, destinationName].filter(Boolean).join(' to '),
      date: formatDate(invoice.invoiceDate || invoice.createdAt),
      invoiceNumber: invoice.invoiceNumber,
      sourceName,
      destinationName,
      origin: extractRouteCoord(rawInvoice, 'source'),
      destination: extractRouteCoord(rawInvoice, 'destination'),
    }];
  });
}

function trackingFromRecentTrip(trip: RecentTrip): TrackingData {
  return {
    vehicleNumber: trip.vehicleNumber,
    status: 'offline',
    tripStatus: 'ended',
    location: trip.destination ? { ...trip.destination, address: trip.destinationName, distanceRemained: 0 } : undefined,
    origin: trip.origin || undefined,
    destination: trip.destination || undefined,
    originLabel: trip.sourceName,
    destinationLabel: trip.destinationName,
    message: trip.date
      ? `Trip ended. Invoice ${trip.invoiceNumber} · ${trip.date}`
      : `Trip ended. Invoice ${trip.invoiceNumber}`,
  };
}

function extractRouteCoord(raw: Record<string, unknown>, side: 'source' | 'destination') {
  const sideKeys = side === 'source' ? ['source', 'origin', 'src', 'pickup', 'from'] : ['destination', 'dest', 'drop', 'to'];
  for (const key of sideKeys) {
    const direct = coordFromUnknown(raw[key]) || coordFromUnknown(raw[`${key}Coord`]) || coordFromUnknown(raw[`${key}Coordinates`]);
    if (direct) return direct;
  }
  for (const key of sideKeys) {
    const lat = raw[`${key}Lat`] ?? raw[`${key}Latitude`] ?? raw[`${key}_lat`];
    const lng = raw[`${key}Lng`] ?? raw[`${key}Longitude`] ?? raw[`${key}_lng`];
    const coord = coordFromUnknown({ lat, lng });
    if (coord) return coord;
  }
  return null;
}

function coordFromUnknown(value: unknown): LocationPoint | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return coordFromUnknown({ lat: value[0], lng: value[1] }) || coordFromUnknown({ lat: value[1], lng: value[0] });
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const lat = Number(source.lat ?? source.latitude);
    const lng = Number(source.lng ?? source.lon ?? source.long ?? source.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    return coordFromUnknown(source.loc) || coordFromUnknown(source.coordinates);
  }
  const match = String(value).match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  return match ? coordFromUnknown({ lat: Number(match[1]), lng: Number(match[2]) }) : null;
}

function isCoord(value?: LocationPoint | null): value is LocationPoint {
  return Boolean(value && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng)));
}

function tripProgress(tracking: TrackingData | null) {
  const traveled = numberFromDistance(tracking?.location?.distanceTravel);
  const total = numberFromDistance(tracking?.location?.totalDistance);
  const remaining = numberFromDistance(tracking?.location?.distanceRemained);
  const effectiveTotal = total ?? (traveled !== null && remaining !== null ? traveled + remaining : null);
  const percent = traveled !== null && effectiveTotal !== null && effectiveTotal > 0
    ? Math.min(100, Math.max(0, Math.round((traveled / effectiveTotal) * 100)))
    : remaining !== null && effectiveTotal !== null && effectiveTotal > 0
      ? Math.min(100, Math.max(0, Math.round(((effectiveTotal - remaining) / effectiveTotal) * 100)))
      : null;
  return {
    visualPercent: percent ?? (tracking?.status === 'online' ? 18 : 0),
    percentLabel: percent !== null ? `${percent}%` : tracking?.status === 'online' ? 'Live' : '0%',
    remainingTime: formatEta(String(tracking?.location?.timeRemained || tracking?.eta || '')),
  };
}

function trackingHeadline(tracking: TrackingData | null, current: string, destination: string, fastag: boolean) {
  if (!tracking) return 'Route dekhne ke liye vehicle number dalein';
  if (fastag) {
    if (current && destination) return `${current} · ${destination} ki taraf`;
    return current || 'Last toll yahan dikha';
  }
  if (tracking.status === 'online') {
    if (current && destination) return `${current} ke paas, ${destination} ki taraf`;
    return current ? `${current} ke paas` : 'Truck apne route par chal raha hai';
  }
  if (tracking.status === 'offline') return current ? `${current} ke paas` : 'Tracking abhi paused hai';
  return current ? `${current} ke paas` : 'Tracking abhi shuru nahi hui';
}

function trackingSubline(tracking: TrackingData | null) {
  if (!tracking) return 'Recent truck chunein ya vehicle number dalein.';
  if (tracking.status === 'online') return '';
  return tracking.message || 'Live tracking shuru hote hi yahan update milega.';
}

function isAllowedConsentStatus(value?: string | null) {
  const status = String(value || '').toLowerCase();
  return ['allow', 'approve', 'granted', 'accepted', 'true', 'yes'].some((item) => status.includes(item));
}

function isActiveLiveTracking(tracking: TrackingData | null) {
  const tripStatus = String(tracking?.tripStatus || '').toUpperCase();
  return Boolean(
    tracking?.status === 'online' &&
      tracking.locationSource === 'live' &&
      (tripStatus === 'ACTIVE' || tripStatus === 'IN_PROGRESS'),
  );
}

function numberFromDistance(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value || '').match(/[\d.]+/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function numberOrUndefined(value: unknown) {
  const number = numberFromDistance(value);
  return number === null ? undefined : number;
}

function formatEta(value: string) {
  const text = value.trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const day = date.getDate();
  const suffix = day > 10 && day < 20 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${day}${suffix} ${date.toLocaleString('en-IN', { month: 'long' })}, ${date.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function firstReadableAddress(value: unknown) {
  return Array.isArray(value)
    ? value.map((part) => String(part || '').trim()).filter(Boolean).join(', ')
    : String(value || '').trim();
}

function shortPlace(value?: string | null) {
  const parts = String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length <= 2 ? parts.join(', ') : parts.slice(0, 2).join(', ');
}

function sanitizePlacePrefix(value: string) {
  return value.replace(/^(?:in|near)\s+/i, '').trim();
}

function vehicleKey(value?: string | null) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function readableError(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: string; response?: { data?: { message?: string } } };
    return candidate.response?.data?.message || candidate.message || fallback;
  }
  return typeof error === 'string' ? error : fallback;
}

function initials(name?: string | null) {
  return String(name || 'Mandi Plus').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function shortMoney(value?: number) {
  const amount = Number(value || 0);
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(amount >= 1_000_000 ? 0 : 1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1)}K`;
  return `₹${Math.round(amount)}`;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

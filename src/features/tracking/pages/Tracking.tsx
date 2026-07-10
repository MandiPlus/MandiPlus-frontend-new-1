'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getTrackingLinkContext,
  sendTrackingLinkOtp,
  trackVehicle,
  TrackingData,
  verifyTrackingLinkOtp,
} from '@/features/tracking/api';

// --- Types ---
interface Message {
  text: string;
  sender: 'bot' | 'user';
  kind?: 'text' | 'otp_unlock';
  isLocation?: boolean;
  mapsUrl?: string;
  status?: 'online' | 'offline' | 'unknown';
  locationData?: TrackingData;
  timestamp?: Date;
}

interface TrackingUnlockState {
  token: string;
  vehicleNumber: string;
  maskedPhone: string;
  otp: string;
  cooldown: number;
  status: 'sending' | 'otp_sent' | 'verifying';
  error?: string;
}

const TRACKING_LINK_PREFIX = 'tlnk_';
const TRACKING_ACCESS_SESSION_KEY = 'mandiplus:tracking-access:';

function isTrackingLinkToken(value?: string | null): value is string {
  return Boolean(value && value.startsWith(TRACKING_LINK_PREFIX));
}

function isAuthenticationError(message?: string | null): boolean {
  return Boolean(message && /authentication required|unauthorized|401/i.test(message));
}

const TrackingPage = () => {
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- State ---
  const [messages, setMessages] = useState<Message[]>([
    {
      text: '👋 Hi! I can help you track your vehicle in real-time.\n\n🚚 Just enter your vehicle number below to get started!',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [locationNames, setLocationNames] = useState<{[key: string]: string}>({});
  const [prefilledVehicleHandled, setPrefilledVehicleHandled] = useState(false);
  const [trackingLinkToken, setTrackingLinkToken] = useState('');
  const [trackingAccessToken, setTrackingAccessToken] = useState<string | null>(null);
  const [unlockState, setUnlockState] = useState<TrackingUnlockState | null>(null);

  // --- Effects ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!unlockState || unlockState.cooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setUnlockState(prev =>
        prev ? { ...prev, cooldown: Math.max(0, prev.cooldown - 1) } : prev,
      );
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [unlockState]);

  // --- Handlers ---
  const getTrackingAccessSessionKey = (token: string) =>
    `${TRACKING_ACCESS_SESSION_KEY}${token.slice(0, 32)}`;

  const startOtpUnlock = async (
    token: string,
    fallbackVehicle: string,
  ) => {
    if (unlockState?.token === token && unlockState.status !== 'sending') {
      return;
    }

    const existingVehicle = unlockState?.vehicleNumber || fallbackVehicle.toUpperCase();
    const existingMaskedPhone = unlockState?.maskedPhone || 'your registered number';

    setUnlockState({
      token,
      vehicleNumber: existingVehicle,
      maskedPhone: existingMaskedPhone,
      otp: '',
      cooldown: 0,
      status: 'sending',
    });

    setMessages(prev => [
      ...prev.slice(0, -1),
      {
        kind: 'otp_unlock',
        text: 'OTP verification required',
        sender: 'bot',
        timestamp: new Date(),
      },
    ]);

    try {
      const context = await getTrackingLinkContext(token);
      const otpResponse = await sendTrackingLinkOtp(token);
      const vehicleNumber =
        otpResponse.vehicleNumber || context.vehicleNumber || fallbackVehicle.toUpperCase();
      setInputValue(vehicleNumber);
      setUnlockState({
        token,
        vehicleNumber,
        maskedPhone: otpResponse.maskedPhone || context.maskedPhone,
        otp: '',
        cooldown: 30,
        status: 'otp_sent',
      });
    } catch (error: any) {
      setUnlockState(prev =>
        prev
          ? {
              ...prev,
              status: 'otp_sent',
              error:
                error?.message ||
                'Tracking link expired. Please request a fresh WhatsApp update.',
            }
          : prev,
      );
    }
  };

  const submitTrackingLookup = async (
    vehicleNumRaw: string,
    options?: {
      preserveInput?: boolean;
      accessToken?: string | null;
      skipUserEcho?: boolean;
      loadingText?: string;
      trackingLinkTokenOverride?: string;
    },
  ) => {
    const vehicleNum = vehicleNumRaw.trim().toUpperCase();
    if (!vehicleNum || isLoading) return;

    if (!options?.preserveInput) {
      setInputValue('');
    }
    setIsLoading(true);

    setMessages(prev => [
      ...prev,
      ...(options?.skipUserEcho
        ? []
        : [
            {
              text: vehicleNum,
              sender: 'user' as const,
              timestamp: new Date(),
            },
          ]),
      {
        text: options?.loadingText || '🔍 Searching for vehicle...',
        sender: 'bot',
        timestamp: new Date(),
      },
    ]);

    try {
      const hasExplicitAccessToken =
        options && Object.prototype.hasOwnProperty.call(options, 'accessToken');
      const response = await trackVehicle(
        vehicleNum,
        hasExplicitAccessToken
          ? { accessToken: options.accessToken }
          : trackingAccessToken
            ? { accessToken: trackingAccessToken }
            : undefined,
      );
      const data: TrackingData = response.data;

      const statusLabel =
        data.status === 'online'
          ? '🟢 Online'
          : data.status === 'offline'
          ? '🔴 Offline'
          : '⚪ Unknown';

      const lastSeenText = data.lastSeen
        ? new Date(data.lastSeen).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'N/A';

      const hasLocation =
        !!data.location &&
        typeof data.location.lat === 'number' &&
        typeof data.location.lng === 'number';

      const mapsUrl = hasLocation
        ? `https://www.google.com/maps?q=${data.location!.lat},${data.location!.lng}`
        : 'https://maps.google.com';

      // Get location name from API response, fallback to reverse geocoding
      let locationName = 'Unknown Location';
      if (hasLocation) {
        // Use address from API response if available
        if (data.location?.address) {
          locationName = data.location.address;
        } else {
          // Fallback to reverse geocoding
          const cacheKey = `${data.location!.lat},${data.location!.lng}`;
          if (locationNames[cacheKey]) {
            locationName = locationNames[cacheKey];
          } else {
            locationName = await reverseGeocode(data.location!.lat, data.location!.lng);
            setLocationNames(prev => ({ ...prev, [cacheKey]: locationName }));
          }
        }
      }

      // Get source and destination from API response
      let sourceLocation = '';
      let destinationLocation = '';
      
      if (data.origin && typeof data.origin.lat === 'number' && typeof data.origin.lng === 'number') {
        // If we have origin coordinates in lat, lng format
        const originKey = `${data.origin.lat},${data.origin.lng}`;
        if (locationNames[originKey]) {
          sourceLocation = locationNames[originKey];
        } else {
          sourceLocation = await reverseGeocode(data.origin.lat, data.origin.lng);
          // If reverse geocoding fails, use coordinates as fallback
          if (sourceLocation === 'Unknown Location') {
            sourceLocation = `${data.origin.lat.toFixed(5)}, ${data.origin.lng.toFixed(5)}`;
          }
          setLocationNames(prev => ({ ...prev, [originKey]: sourceLocation }));
        }
      }
      
      if (data.destination && typeof data.destination.lat === 'number' && typeof data.destination.lng === 'number') {
        // If we have destination coordinates in lat, lng format
        const destKey = `${data.destination.lat},${data.destination.lng}`;
        if (locationNames[destKey]) {
          destinationLocation = locationNames[destKey];
        } else {
          destinationLocation = await reverseGeocode(data.destination.lat, data.destination.lng);
          // If reverse geocoding fails, use coordinates as fallback
          if (destinationLocation === 'Unknown Location') {
            destinationLocation = `${data.destination.lat.toFixed(5)}, ${data.destination.lng.toFixed(5)}`;
          }
          setLocationNames(prev => ({ ...prev, [destKey]: destinationLocation }));
        }
      }

      // Create a more attractive message with source, destination and detailed location
      let locationMsg = `📍 **Vehicle Found!**\n\n🚚 **Vehicle:** ${data.vehicleNumber || vehicleNum.toUpperCase()}\n${statusLabel}`;
      
      if (hasLocation) {
        locationMsg += `\n\n📍 **Current Location:** ${locationName}`;
        
        // Only add source and destination if we have both
        if (sourceLocation && destinationLocation) {
          locationMsg += `\n🚚 **Source:** ${sourceLocation}`;
          locationMsg += `\n🏁 **Destination:** ${destinationLocation}`;
        }
      }

      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          text: locationMsg,
          sender: 'bot',
          isLocation: hasLocation,
          mapsUrl,
          status: data.status as 'online' | 'offline' | 'unknown',
          locationData: {
            ...data,
            currentLocationName: locationName,
            sourceName: sourceLocation,
            destinationName: destinationLocation,
          },
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      const errorMessage =
        err?.message || 'Could not track this vehicle. Please check the number and try again.';
      const tokenForUnlock = options?.trackingLinkTokenOverride || trackingLinkToken;
      if (isAuthenticationError(errorMessage) && tokenForUnlock) {
        await startOtpUnlock(tokenForUnlock, vehicleNum);
        return;
      }

      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          text: isAuthenticationError(errorMessage)
            ? '🔐 Please verify with the latest WhatsApp tracking link to view this live location.'
            : `❌ ${errorMessage}`,
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    await submitTrackingLookup(inputValue);
  };

  const handleOtpChange = (value: string) => {
    const otp = value.replace(/\D/g, '').slice(0, 6);
    setUnlockState(prev =>
      prev ? { ...prev, otp, error: undefined } : prev,
    );
  };

  const handleVerifyOtp = async () => {
    if (!unlockState || unlockState.status === 'verifying') return;
    if (unlockState.otp.length < 4) {
      setUnlockState(prev =>
        prev ? { ...prev, error: 'OTP daalo to continue.' } : prev,
      );
      return;
    }

    setUnlockState(prev => (prev ? { ...prev, status: 'verifying', error: undefined } : prev));

    try {
      const response = await verifyTrackingLinkOtp(unlockState.token, unlockState.otp);
      const accessToken = response.accessToken;
      window.sessionStorage.setItem(
        getTrackingAccessSessionKey(unlockState.token),
        accessToken,
      );
      setTrackingAccessToken(accessToken);
      setMessages(prev => [
        ...prev.map(message =>
          message.kind === 'otp_unlock'
            ? {
                text: `✅ OTP verified for ${unlockState.vehicleNumber}.`,
                sender: 'bot' as const,
                timestamp: new Date(),
              }
            : message,
        ),
        {
          text: '••••••',
          sender: 'user',
          timestamp: new Date(),
        },
      ]);
      const vehicleNumber = response.vehicleNumber || unlockState.vehicleNumber;
      setUnlockState(null);
      await submitTrackingLookup(vehicleNumber, {
        accessToken,
        skipUserEcho: true,
        preserveInput: true,
        loadingText: '✅ Verified. Fetching live tracking details...',
      });
    } catch (error: any) {
      setUnlockState(prev =>
        prev
          ? {
              ...prev,
              status: 'otp_sent',
              error: error?.message || 'OTP verify nahi ho paya.',
            }
          : prev,
      );
    }
  };

  const handleResendUnlockOtp = async () => {
    if (!unlockState || unlockState.cooldown > 0 || unlockState.status === 'sending') {
      return;
    }
    setUnlockState(prev => (prev ? { ...prev, status: 'sending', error: undefined } : prev));
    try {
      await sendTrackingLinkOtp(unlockState.token);
      setUnlockState(prev =>
        prev
          ? {
              ...prev,
              status: 'otp_sent',
              cooldown: 30,
              otp: '',
              error: undefined,
            }
          : prev,
      );
    } catch (error: any) {
      setUnlockState(prev =>
        prev
          ? {
              ...prev,
              status: 'otp_sent',
              error: error?.message || 'OTP resend nahi ho paya.',
            }
          : prev,
      );
    }
  };

  useEffect(() => {
    const rawVehicle =
      searchParams.get('vehicle') || searchParams.get('v') || searchParams.get('truck') || '';
    const token = searchParams.get('t') || (isTrackingLinkToken(rawVehicle) ? rawVehicle : '');
    const vehicle = token ? '' : rawVehicle;
    if ((!vehicle && !token) || prefilledVehicleHandled || isLoading) return;
    setPrefilledVehicleHandled(true);

    if (token) {
      setTrackingLinkToken(token);
      void getTrackingLinkContext(token)
        .then(context => {
          const cachedToken =
            window.sessionStorage.getItem(getTrackingAccessSessionKey(token)) || null;
          setTrackingAccessToken(cachedToken);
          setInputValue(context.vehicleNumber);
          return submitTrackingLookup(context.vehicleNumber, {
            preserveInput: true,
            accessToken: cachedToken,
            trackingLinkTokenOverride: token,
          });
        })
        .catch(error => {
          setMessages(prev => [
            ...prev,
            {
              text:
                `❌ ${error?.message || 'Tracking link expired. Please request a fresh WhatsApp update.'}`,
              sender: 'bot',
              timestamp: new Date(),
            },
          ]);
        });
      return;
    }

    setInputValue(vehicle.toUpperCase());
    void submitTrackingLookup(vehicle, { preserveInput: true });
  }, [searchParams, prefilledVehicleHandled, isLoading]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return 'Unknown Location';

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return 'Unknown Location';
    
    const data = await response.json();
    if (data.status === 'OK' && data.results?.length > 0) {
      // Get the most detailed address
      const result = data.results[0];
      const formattedAddress = result.formatted_address;
      
      // Extract specific components for better formatting
      const sublocality = result.address_components.find((comp: any) => 
        comp.types.includes('sublocality') || comp.types.includes('neighborhood')
      );
      const locality = result.address_components.find((comp: any) => 
        comp.types.includes('locality')
      );
      const administrativeArea2 = result.address_components.find((comp: any) => 
        comp.types.includes('administrative_area_level_2')
      );
      const administrativeArea1 = result.address_components.find((comp: any) => 
        comp.types.includes('administrative_area_level_1')
      );
      const country = result.address_components.find((comp: any) => 
        comp.types.includes('country')
      );
      
      // Build detailed address
      let detailedAddress = '';
      if (sublocality) detailedAddress += `${sublocality.long_name}, `;
      if (locality) detailedAddress += `${locality.long_name}, `;
      if (administrativeArea2 && administrativeArea2.long_name !== locality?.long_name) {
        detailedAddress += `${administrativeArea2.long_name}, `;
      }
      if (administrativeArea1) detailedAddress += `${administrativeArea1.long_name}, `;
      if (country) detailedAddress += country.long_name;
      
      // Remove trailing comma and space
      detailedAddress = detailedAddress.replace(/,\s*$/, '');
      
      return detailedAddress || formattedAddress;
    }
    return 'Unknown Location';
  } catch {
    return 'Unknown Location';
  }
}

const openMapModal = async (message: Message) => {
    const currentLat = message.locationData?.location?.lat;
    const currentLng = message.locationData?.location?.lng;
    const destLat = message.locationData?.destination?.lat;
    const destLng = message.locationData?.destination?.lng;
    const vehicle = message.locationData?.vehicleNumber || 'Vehicle';
    const currentName = message.locationData?.currentLocationName || '';
    const sourceName = message.locationData?.sourceName || '';
    const destinationName = message.locationData?.destinationName || '';

    // Open custom map view that shows only current + destination markers (no routing).
    const params = new URLSearchParams();
    if (typeof currentLat === 'number') params.set('clat', String(currentLat));
    if (typeof currentLng === 'number') params.set('clng', String(currentLng));
    if (typeof destLat === 'number') params.set('dlat', String(destLat));
    if (typeof destLng === 'number') params.set('dlng', String(destLng));
    params.set('vehicle', vehicle);
    if (currentName) params.set('currentName', currentName);
    if (sourceName) params.set('sourceName', sourceName);
    if (destinationName) params.set('destinationName', destinationName);

    const appMapUrl = `/tracking/live-map?${params.toString()}`;
    window.open(appMapUrl, '_blank');
  };

  const formatMessage = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      // Check if line contains bold markers
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={i} className="mb-1.5 leading-relaxed">
            {parts.map((part, idx) => 
              idx % 2 === 1 ? (
                <strong key={idx} className="font-semibold text-gray-900">{part}</strong>
              ) : (
                <span key={idx}>{part}</span>
              )
            )}
          </p>
        );
      }
      return (
        <p key={i} className="mb-1.5 leading-relaxed">
          {line}
        </p>
      );
    });
  };

  const getStatusColor = (status?: 'online' | 'offline' | 'unknown') => {
    switch (status) {
      case 'online':
        return 'bg-green-100 border-green-300';
      case 'offline':
        return 'bg-red-100 border-red-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#efeae2] overflow-hidden">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] text-white px-4 py-4 flex items-center justify-between shadow-lg z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const isBotEmbed =
                typeof window !== 'undefined' &&
                window.self !== window.top &&
                new URLSearchParams(window.location.search).get('embedBot') === '1';
              if (isBotEmbed) {
                window.parent.postMessage({ type: 'MANDI_BOT_CLOSE' }, '*');
                return;
              }
              window.history.back();
            }}
            className="p-2 rounded-full hover:bg-[#128C7E] transition-all duration-200 active:scale-95"
            aria-label="Go back"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-full">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-base">Track Your Delivery</p>
              <p className="text-xs opacity-90">Mandi Plus • Live Tracking</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs opacity-90">Online</span>
        </div>
      </div>

      {/* Enhanced Chat Container */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
        style={{
          backgroundColor: '#E5DDD5',
          backgroundImage: "url('/images/whatsapp-bg.png')",
          backgroundRepeat: 'repeat',
          backgroundSize: '300px',
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex animate-fadeIn ${
              message.sender === 'user'
                ? 'justify-end'
                : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] sm:max-w-[75%] px-4 py-3 text-[15px] rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl ${
                message.sender === 'user'
                  ? 'bg-gradient-to-br from-[#dcf8c6] to-[#d4f0b8] text-gray-900 rounded-br-sm'
                  : `bg-white text-gray-800 rounded-bl-sm ${message.isLocation ? getStatusColor(message.status) + ' border-2' : ''}`
              }`}
            >
              {message.sender === 'bot' && message.isLocation && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                  <div className={`w-3 h-3 rounded-full ${
                    message.status === 'online' ? 'bg-green-500 animate-pulse' :
                    message.status === 'offline' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`}></div>
                  <span className="text-xs font-semibold text-gray-600 uppercase">
                    {message.status === 'online' ? 'Live Location' : 'Last Known Location'}
                  </span>
                </div>
              )}

              {message.kind === 'otp_unlock' && unlockState ? (
                <div className="text-gray-800">
                  <div className="mb-3 flex items-center gap-2 border-b border-emerald-100 pb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-[#075E54]">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V7a5 5 0 00-10 0v4H6a2 2 0 00-2 2v6a2 2 0 002 2zm3-10V7a3 3 0 116 0v4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Unlock live tracking</p>
                      <p className="text-xs font-medium text-gray-600">{unlockState.vehicleNumber}</p>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-gray-700">
                    For safety, enter the OTP sent to{' '}
                    <span className="font-semibold text-gray-900">{unlockState.maskedPhone}</span>.
                  </p>

                  <div className="mt-3">
                    <input
                      value={unlockState.otp}
                      onChange={e => handleOtpChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          void handleVerifyOtp();
                        }
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      disabled={unlockState.status === 'sending' || unlockState.status === 'verifying'}
                      className="h-12 w-full rounded-xl border-2 border-emerald-200 bg-white px-4 text-center text-xl font-black tracking-[0.28em] text-gray-950 outline-none transition focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/15 disabled:bg-gray-100"
                      placeholder="000000"
                    />
                  </div>

                  {unlockState.error ? (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      {unlockState.error}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleVerifyOtp()}
                    disabled={
                      unlockState.status === 'sending' ||
                      unlockState.status === 'verifying' ||
                      unlockState.otp.length < 4
                    }
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-[#063b1a] shadow-md transition hover:bg-[#35e277] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    {unlockState.status === 'verifying'
                      ? 'Verifying...'
                      : unlockState.status === 'sending'
                        ? 'Sending OTP...'
                        : 'Verify & show tracking'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleResendUnlockOtp()}
                    disabled={unlockState.cooldown > 0 || unlockState.status === 'sending'}
                    className="mt-2 w-full text-center text-xs font-bold text-[#075E54] disabled:text-gray-400"
                  >
                    {unlockState.cooldown > 0
                      ? `Resend OTP in ${unlockState.cooldown}s`
                      : 'Resend OTP'}
                  </button>
                </div>
              ) : (
                <div className="text-gray-800">
                  {formatMessage(message.text)}
                </div>
              )}

              {message.isLocation && message.mapsUrl && (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => openMapModal(message)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    View on Google Maps
                  </button>
                  
                  {message.locationData?.shareUrl && (
                    <button
                      onClick={() => copyToClipboard(message.locationData!.shareUrl!)}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Share Link
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-1 mt-2 text-[11px] text-gray-500">
                <span>
                  {message.timestamp?.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }) || new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {message.sender === 'user' && (
                  <svg className="h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Input Area */}
      <div className="bg-gradient-to-t from-[#f0f0f0] to-[#f5f5f5] px-4 py-3 border-t border-gray-300 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleSendMessage(e);
                }
              }}
              placeholder="Enter vehicle number (e.g., MH12AB1234)..."
              disabled={isLoading}
              className="w-full rounded-full px-5 py-3 text-[15px] border-2 border-gray-300 focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isLoading && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#25D366] border-t-transparent"></div>
              </div>
            )}
          </div>
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="bg-gradient-to-r from-[#25D366] to-[#20BA5A] p-3 rounded-full text-white hover:from-[#20BA5A] hover:to-[#1DA851] transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center min-w-[48px]"
            aria-label="Send"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          💡 Tip: Enter your vehicle registration number to track it in real-time
        </p>
      </div>

      </div>
  );
};

export default TrackingPage;

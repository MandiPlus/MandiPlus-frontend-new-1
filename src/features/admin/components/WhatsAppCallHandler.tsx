'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { useAdmin } from '@/features/admin/context/AdminContext';

type CallState = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended' | 'calling';

type IncomingCallEvent = {
  type: 'incoming_call';
  call_id: string;
  from: string;
  to: string;
  sdp_offer: string;
  timestamp: string;
};

type CallAnsweredEvent = {
  type: 'call_answered';
  call_id: string;
  from: string;
  sdp_answer: string;
  webrtc_sdp: string;
};

type CallTerminatedEvent = {
  type: 'call_terminated';
  call_id: string;
  status: string;
  duration: number;
};

type OutboundRingingEvent = {
  type: 'outbound_call_ringing';
  call_id: string;
  to: string;
};

type ActiveCallRecord = {
  call_id: string;
  from?: string;
  to?: string;
  status?: string;
  sdp_offer?: string;
  started_at?: string | number;
  phone_number_id?: string;
};

type WsEvent =
  | IncomingCallEvent
  | CallAnsweredEvent
  | CallTerminatedEvent
  | OutboundRingingEvent
  | { type: string; [key: string]: unknown };

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Routing is controlled server-side via WHATSAPP_CALL_AGENT_ROUTING on the bot.
// Any authenticated admin can connect; the backend filters which calls they see.

function formatCallDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatCallerNumber(phone: string) {
  if (!phone) return 'Unknown';
  if (phone.length >= 12) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 7)} ${phone.slice(7)}`;
  }
  return phone;
}

function getContactName(phone: string): string | null {
  if (typeof window === 'undefined' || !phone) return null;
  try {
    const dir = JSON.parse(localStorage.getItem('chatContactDirectory') || '{}');
    return dir[phone]?.name || null;
  } catch {
    return null;
  }
}

function getInitials(phone: string) {
  if (!phone) return 'WA';
  const name = getContactName(phone);
  if (name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase() || '').join('') || 'WA';
  }
  return phone.slice(-2).toUpperCase();
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function getResponseErrorDetail(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') {
    return data.detail;
  }
  return fallback;
}

// Phone icon SVG path (reused throughout)
const PHONE_PATH = 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z';

function PhoneIcon({ className = 'h-5 w-5', rotate135 = false }: { className?: string; rotate135?: boolean }) {
  return (
    <svg className={`${className} ${rotate135 ? 'rotate-[135deg]' : ''}`} fill="currentColor" viewBox="0 0 24 24">
      <path d={PHONE_PATH} />
    </svg>
  );
}

export function WhatsAppCallHandler() {
  const { accessProfile } = useAdmin();
  const [callState, setCallState] = useState<CallState>('idle');
  const [callId, setCallId] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [sdpOffer, setSdpOffer] = useState('');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifRef = useRef<Notification | null>(null);
  // Stable refs for values read inside the WS callback — avoids stale closures
  // and prevents the WS from being torn down on every call-state change.
  const connectWebSocketRef = useRef<() => void>(() => {});
  const callIdRef = useRef(callId);
  const callStateRef = useRef(callState);

  const botBaseUrl =
    (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BOT_API_BASE_URL) ||
    'http://localhost:8000';
  const adminJwt =
    (typeof window !== 'undefined' && localStorage.getItem('adminToken')) ||
    '';
  const botAdminToken =
    (typeof window !== 'undefined' && localStorage.getItem('botChatAdminToken')) ||
    process.env.NEXT_PUBLIC_BOT_CHAT_ADMIN_TOKEN ||
    '';

  // Dashboard accounts expose account.username; legacy master-admin tokens map
  // to the shared admin observer so they still receive all WhatsApp calls.
  const currentUser = accessProfile?.account?.username
    || (accessProfile?.isFullAdmin ? 'admin@mandiplus.com' : '');
  const isAllowed = !!accessProfile && !!currentUser;
  const botAuthHeaders = useMemo<Record<string, string>>(
    () => {
      const headers: Record<string, string> = {};
      if (adminJwt) {
        headers.Authorization = `Bearer ${adminJwt}`;
      } else if (botAdminToken) {
        headers['x-admin-token'] = botAdminToken;
      }
      return headers;
    },
    [adminJwt, botAdminToken],
  );
  const wsUrl = useMemo(() => {
    const wsParams = new URLSearchParams();
    if (currentUser) wsParams.set('username', currentUser);
    if (adminJwt) wsParams.set('auth_token', adminJwt);
    return `${botBaseUrl.replace(/^http/, 'ws')}/ws/calls${wsParams.toString() ? `?${wsParams.toString()}` : ''}`;
  }, [adminJwt, botBaseUrl, currentUser]);

  // Keep call-state refs in sync so the stable WS callback always sees fresh values
  useEffect(() => { callIdRef.current = callId; }, [callId]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // Read current notification permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setNotifPermission(Notification.permission);
  }, []);

  // Request notification permission + register push subscription for WhatsApp calls/messages.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const setupPush = async () => {
      try {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
        if (permission !== 'granted') return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const reg = await navigator.serviceWorker.ready;

        // Fetch VAPID application server key
        const keyRes = await fetch(`${botBaseUrl}/admin/push/vapid-key`, {
          headers: botAuthHeaders,
        });
        if (!keyRes.ok) return;
        const { applicationServerKey } = await keyRes.json();
        if (!applicationServerKey) return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        const subJson = sub.toJSON() as Record<string, unknown>;
        await fetch(`${botBaseUrl}/admin/push/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...botAuthHeaders,
          },
          body: JSON.stringify({ ...subJson, username: currentUser || null }),
        });
      } catch {}
    };

    setupPush();
  }, [botBaseUrl, botAuthHeaders, currentUser]);

  // Listen for messages from the service worker (push notification click actions)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'wa-push-call-action') {
        const { action } = event.data;
        if (action === 'decline') {
          handleReject();
        } else {
          // Answer — if already in ringing state, accept; otherwise UI will show when WS reconnects
          setIsExpanded(true);
          if (callState === 'ringing') handleAccept();
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [callState]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRing = useCallback(() => {
    if (ringAudioRef.current) {
      try {
        const audio = ringAudioRef.current;
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
      } catch {}
      ringAudioRef.current = null;
    }
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
  }, []);

  const startRing = useCallback(() => {
    stopRing();
    try {
      const audio = new Audio('/sounds/incoming_call.mp3');
      audio.loop = true;
      audio.volume = 0.85;
      ringAudioRef.current = audio;
      audio.play().catch(() => {
        // Autoplay blocked — will play on next user gesture; fallback silent
      });
    } catch {}
  }, [stopRing]);

  const showCallNotification = useCallback((phone: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const notif = new Notification('Incoming WhatsApp Call', {
        body: `${formatCallerNumber(phone)} is calling...`,
        tag: 'wa-incoming-call',
        requireInteraction: true,
      });
      notif.onclick = () => {
        window.focus();
        setIsExpanded(true);
        notif.close();
      };
      notifRef.current = notif;
    } catch {}
  }, []);

  const closeCallNotification = useCallback(() => {
    if (notifRef.current) {
      notifRef.current.close();
      notifRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (callState !== 'ringing') {
      stopRing();
      closeCallNotification();
    }
  }, [callState, stopRing, closeCallNotification]);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    stopRing();
    closeCallNotification();
  }, [stopRing, closeCallNotification]);

  const handleOutboundCallAnswered = useCallback(async (event: CallAnsweredEvent) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const sdpAnswer = event.webrtc_sdp || event.sdp_answer;
      if (!sdpAnswer) { setError('No SDP answer received'); return; }
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdpAnswer }));
      setCallState('active');
      setDuration(0);
      durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to connect call'));
      cleanup();
      setCallState('idle');
    }
  }, [cleanup]);

  const handleIncomingCall = useCallback((ev: IncomingCallEvent) => {
    if (ev.call_id && ev.call_id === callIdRef.current && callStateRef.current !== 'idle') {
      return;
    }
    setCallId(ev.call_id);
    setCallerNumber(ev.from);
    setSdpOffer(ev.sdp_offer);
    setCallState('ringing');
    setDuration(0);
    setError('');
    setIsExpanded(true);
    startRing();
    showCallNotification(ev.from);
  }, [showCallNotification, startRing]);

  const syncActiveRingingCall = useCallback(async () => {
    if (!isAllowed) return;
    if (['ringing', 'connecting', 'active'].includes(callStateRef.current)) return;

    try {
      const res = await fetch(`${botBaseUrl}/admin/calls/active`, {
        headers: botAuthHeaders,
      });
      if (!res.ok) return;
      const data = await res.json();
      const activeCalls = Array.isArray(data?.items) ? data.items as ActiveCallRecord[] : [];
      const ringingCall = activeCalls.find((call) =>
        call?.status === 'ringing' && call.call_id && call.from && call.sdp_offer
      );
      if (!ringingCall) return;

      handleIncomingCall({
        type: 'incoming_call',
        call_id: ringingCall.call_id,
        from: ringingCall.from || '',
        to: ringingCall.to || '',
        sdp_offer: ringingCall.sdp_offer || '',
        timestamp: String(ringingCall.started_at || ''),
      });
    } catch {}
  }, [botAuthHeaders, botBaseUrl, handleIncomingCall, isAllowed]);

  const connectWebSocket = useCallback(() => {
    if (!isAllowed) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => { setError(''); };

    ws.onmessage = (event) => {
      try {
        const data: WsEvent = JSON.parse(event.data);

        if (data.type === 'incoming_call') {
          const ev = data as IncomingCallEvent;
          handleIncomingCall(ev);
        } else if (data.type === 'call_answered') {
          const ev = data as CallAnsweredEvent;
          if (pcRef.current) handleOutboundCallAnswered(ev);
        } else if (data.type === 'outbound_call_ringing') {
          const ev = data as OutboundRingingEvent;
          setCallId(ev.call_id);
        } else if (data.type === 'call_terminated') {
          const ev = data as CallTerminatedEvent;
          if (ev.call_id === callIdRef.current || callStateRef.current !== 'idle') {
            cleanup();
            setCallState('ended');
            setDuration(ev.duration || 0);
            setTimeout(() => {
              setCallState('idle');
              setCallId('');
              setCallerNumber('');
            }, 3000);
          }
        }
      } catch {}
    };

    ws.onclose = () => { reconnectTimeoutRef.current = setTimeout(() => connectWebSocketRef.current(), 5000); };
    ws.onerror = () => { ws.close(); };
  }, [wsUrl, isAllowed, cleanup, handleIncomingCall, handleOutboundCallAnswered]);

  // Always keep the ref pointing to the latest callback so onclose reconnects correctly
  useEffect(() => { connectWebSocketRef.current = connectWebSocket; });

  useEffect(() => {
    if (!isAllowed) return;
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket, isAllowed]);

  useEffect(() => {
    if (!isAllowed) return;
    void syncActiveRingingCall();
    const interval = setInterval(() => {
      void syncActiveRingingCall();
    }, 8000);
    return () => clearInterval(interval);
  }, [isAllowed, syncActiveRingingCall]);

  const handleAccept = async () => {
    if (!callId || !sdpOffer) return;
    stopRing();
    closeCallNotification();
    setCallState('connecting');
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;
      pc.ontrack = (event) => { remoteAudio.srcObject = event.streams[0]; };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const sdpAnswer = await new Promise<string>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(pc.localDescription!.sdp); return; }
        const timeout = setTimeout(() => resolve(pc.localDescription!.sdp), 3000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') { clearTimeout(timeout); resolve(pc.localDescription!.sdp); }
        };
      });

      const response = await fetch(`${botBaseUrl}/admin/calls/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...botAuthHeaders },
        body: JSON.stringify({ call_id: callId, sdp_answer: sdpAnswer }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(getResponseErrorDetail(errData, 'Failed to accept call'));
      }

      setCallState('active');
      setIsExpanded(true);
      setDuration(0);
      durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to accept call'));
      cleanup();
      setCallState('idle');
    }
  };

  const handleInitiateCall = useCallback(async (phone: string) => {
    if (callState !== 'idle') return;
    setCallState('calling');
    setCallerNumber(phone);
    setError('');
    setIsExpanded(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;
      pc.ontrack = (event) => { remoteAudio.srcObject = event.streams[0]; };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('active');
          setDuration(0);
          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
          }
        } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          cleanup();
          setCallState('ended');
          setTimeout(() => { setCallState('idle'); setCallId(''); setCallerNumber(''); }, 3000);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpOffer = await new Promise<string>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(pc.localDescription!.sdp); return; }
        const timeout = setTimeout(() => resolve(pc.localDescription!.sdp), 5000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') { clearTimeout(timeout); resolve(pc.localDescription!.sdp); }
        };
      });

      const response = await fetch(`${botBaseUrl}/admin/calls/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...botAuthHeaders },
        body: JSON.stringify({ to_phone: phone, sdp_offer: sdpOffer, username: currentUser || null }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(getResponseErrorDetail(errData, 'Failed to initiate call'));
      }

      const data = await response.json();
      const resultCalls = data?.result?.calls;
      if (resultCalls && Array.isArray(resultCalls) && resultCalls[0]?.id) {
        setCallId(resultCalls[0].id);
      }

      // Auto-transition to active after delay (webhook may go to prod, not localhost)
      callingTimeoutRef.current = setTimeout(() => {
        setCallState((prev) => {
          if (prev === 'calling') {
            setDuration(0);
            durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
            return 'active';
          }
          return prev;
        });
      }, 8000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to initiate call'));
      cleanup();
      setCallState('idle');
    }
  }, [callState, botBaseUrl, botAuthHeaders, cleanup, currentUser]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.phone) handleInitiateCall(detail.phone);
    };
    window.addEventListener('wa-initiate-call', handler);
    return () => window.removeEventListener('wa-initiate-call', handler);
  }, [handleInitiateCall]);

  const handleReject = async () => {
    if (!callId) return;
    const rejectCallId = callId;
    stopRing();
    closeCallNotification();
    cleanup();
    setCallState('idle');
    setCallId('');
    setCallerNumber('');
    try {
      await fetch(`${botBaseUrl}/admin/calls/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...botAuthHeaders },
        body: JSON.stringify({ call_id: rejectCallId }),
      });
    } catch {}
  };

  const handleHangup = async () => {
    if (!callId) return;
    try {
      await fetch(`${botBaseUrl}/admin/calls/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...botAuthHeaders },
        body: JSON.stringify({ call_id: callId }),
      });
    } catch {}
    cleanup();
    setCallState('ended');
    setTimeout(() => { setCallState('idle'); setCallId(''); setCallerNumber(''); }, 2000);
  };

  const handleCancelCall = async () => {
    if (callId) {
      try {
        await fetch(`${botBaseUrl}/admin/calls/terminate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...botAuthHeaders },
          body: JSON.stringify({ call_id: callId }),
        });
      } catch {}
    }
    cleanup();
    setCallState('idle');
    setCallId('');
    setCallerNumber('');
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  };

  // Notification permission banner (shown when idle and permission not granted)
  if (isAllowed && callState === 'idle' && notifPermission === 'default') {
    return (
      <div className="fixed bottom-4 right-4 z-[9990] flex max-w-sm items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">Enable WhatsApp notifications</p>
          <p className="mt-0.5 text-xs text-amber-700">Allow notifications for incoming calls and important customer messages.</p>
          <button
            type="button"
            className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            onClick={() => Notification.requestPermission().then((p) => setNotifPermission(p))}
          >
            Enable Notifications
          </button>
        </div>
        <button type="button" onClick={() => setNotifPermission('denied')} className="text-amber-400 hover:text-amber-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    );
  }

  if (!isAllowed || callState === 'idle') return null;

  const bgClass =
    callState === 'active' ? 'bg-[#075E54]' :
    callState === 'ended' ? 'bg-[#424242]' :
    callState === 'calling' ? 'bg-[#1a4f72]' :
    'bg-[#075E54]';
  const contactName = getContactName(callerNumber);
  const callerDisplayName = contactName || formatCallerNumber(callerNumber);
  const callStatusLabel =
    callState === 'active' ? formatCallDuration(duration) :
    callState === 'ringing' ? 'Incoming call' :
    callState === 'calling' ? 'Ringing...' :
    callState === 'connecting' ? 'Connecting...' :
    'Call ended';
  const isWaitingForCall = callState === 'ringing' || callState === 'calling';

  // ─── Minimized floating bar ───────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <div
        className={`fixed top-0 left-0 right-0 z-[9999] flex items-center gap-3 px-4 shadow-lg cursor-pointer select-none ${bgClass}`}
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))', paddingBottom: '0.625rem' }}
        onClick={() => setIsExpanded(true)}
      >
        <PhoneIcon
          className={`h-4 w-4 shrink-0 text-white ${callState === 'ringing' || callState === 'calling' ? 'animate-pulse' : ''}`}
        />
        <span className="flex-1 truncate text-sm font-semibold text-white">
          {callerDisplayName}
        </span>
        <span className="shrink-0 font-mono text-xs text-white/80">
          {callState === 'active' ? formatCallDuration(duration) :
           callState === 'ringing' ? 'Ringing...' :
           callState === 'calling' ? 'Calling...' :
           callState === 'connecting' ? 'Connecting...' : 'Ended'}
        </span>
        {/* Expand icon */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white"
          title="Expand"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        {/* Quick end/cancel button */}
        {(callState === 'active' || callState === 'calling') && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (callState === 'calling') handleCancelCall(); else handleHangup(); }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600"
            title="End call"
          >
            <PhoneIcon className="h-3.5 w-3.5 text-white" rotate135 />
          </button>
        )}
        {callState === 'ringing' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleReject(); }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600"
            title="Decline"
          >
            <PhoneIcon className="h-3.5 w-3.5 text-white" rotate135 />
          </button>
        )}
      </div>
    );
  }

  const desktopPanelTone =
    callState === 'ended' ? 'border-slate-200 bg-slate-950' :
    callState === 'calling' ? 'border-sky-200 bg-slate-950' :
    'border-emerald-200 bg-[#073f39]';

  return (
    <>
      {/* Desktop compact call surface */}
      <div
        className={`fixed right-4 top-4 z-[9999] hidden w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border shadow-2xl shadow-slate-950/25 ring-1 ring-white/10 lg:block ${desktopPanelTone}`}
        role="dialog"
        aria-label="WhatsApp call"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300" />
        <div className="flex items-start gap-3 px-4 pb-4 pt-5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-bold text-white ring-1 ring-white/20">
            {getInitials(callerNumber)}
            {isWaitingForCall && (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/20" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.18)]" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">WhatsApp</p>
            </div>
            <p className="mt-1 truncate text-base font-semibold text-white">{callerDisplayName}</p>
            {contactName && (
              <p className="truncate text-xs text-white/55">{formatCallerNumber(callerNumber)}</p>
            )}
            <p className="mt-1 text-sm text-white/75">{callStatusLabel}</p>
            {error && (
              <p className="mt-3 rounded-lg bg-rose-950/70 px-3 py-2 text-xs leading-5 text-rose-100">{error}</p>
            )}
          </div>

          {callState === 'ringing' && (
            <button
              type="button"
              onClick={handleReject}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
              title="Ignore call"
              aria-label="Ignore call"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 bg-black/10 px-4 py-3">
          {callState === 'ringing' && (
            <>
              <button
                type="button"
                onClick={handleReject}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-400 active:scale-[0.98]"
              >
                <PhoneIcon className="h-4 w-4" rotate135 />
                Decline
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-300 active:scale-[0.98]"
              >
                <PhoneIcon className="h-4 w-4" />
                Accept
              </button>
            </>
          )}

          {callState === 'calling' && (
            <button
              type="button"
              onClick={handleCancelCall}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-400 active:scale-[0.98]"
            >
              <PhoneIcon className="h-4 w-4" rotate135 />
              Cancel
            </button>
          )}

          {callState === 'connecting' && (
            <div className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-medium text-white/80">
              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Connecting
            </div>
          )}

          {callState === 'active' && (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`flex h-10 flex-1 items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                  isMuted ? 'bg-white text-[#075E54]' : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={handleHangup}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-400 active:scale-[0.98]"
              >
                <PhoneIcon className="h-4 w-4" rotate135 />
                Hang up
              </button>
            </>
          )}

          {callState === 'ended' && (
            <p className="w-full text-center text-sm text-white/65">
              {duration > 0 ? `Duration: ${formatCallDuration(duration)}` : 'Call not answered'}
            </p>
          )}
        </div>
      </div>

      {/* Mobile full-screen expanded call UI */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col lg:hidden ${bgClass}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
          title="Minimize"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-white/60">WhatsApp</span>
        <div className="h-9 w-9" />
      </div>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
        {/* Avatar circle */}
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/20 text-4xl font-bold text-white shadow-lg">
          {getInitials(callerNumber)}
          {isWaitingForCall && (
            <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
          )}
        </div>

        {/* Name + status */}
        <div className="text-center">
          <p className="text-2xl font-semibold text-white">{callerDisplayName}</p>
          {contactName && (
            <p className="text-sm text-white/60">{formatCallerNumber(callerNumber)}</p>
          )}
          <p className="mt-1.5 text-sm text-white/70">{callStatusLabel}</p>
        </div>

        {error && (
          <p className="rounded-xl bg-black/30 px-4 py-2 text-sm text-rose-300">{error}</p>
        )}

        {/* Animated dots while waiting */}
        {isWaitingForCall && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {/* Bottom action area */}
      <div
        className="px-8 pb-14"
        style={{ paddingBottom: 'max(3.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Incoming call — decline + accept */}
        {callState === 'ringing' && (
          <div className="flex items-end justify-between">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleReject}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 shadow-xl transition hover:bg-rose-400 active:scale-95"
              >
                <PhoneIcon className="h-7 w-7 text-white" rotate135 />
              </button>
              <span className="text-xs text-white/70">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleAccept}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 shadow-xl transition hover:bg-emerald-300 active:scale-95"
              >
                <PhoneIcon className="h-7 w-7 text-white" />
              </button>
              <span className="text-xs text-white/70">Accept</span>
            </div>
          </div>
        )}

        {/* Outbound calling — cancel */}
        {callState === 'calling' && (
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleCancelCall}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 shadow-xl transition hover:bg-rose-400 active:scale-95"
              >
                <PhoneIcon className="h-7 w-7 text-white" rotate135 />
              </button>
              <span className="text-xs text-white/70">Cancel</span>
            </div>
          </div>
        )}

        {/* Connecting spinner */}
        {callState === 'connecting' && (
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <svg className="h-7 w-7 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          </div>
        )}

        {/* Active call — mute + end */}
        {callState === 'active' && (
          <div className="flex items-end justify-between px-6">
            {/* Mute */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 ${
                  isMuted ? 'bg-white text-[#075E54]' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                )}
              </button>
              <span className="text-xs text-white/70">{isMuted ? 'Unmute' : 'Mute'}</span>
            </div>

            {/* End call */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleHangup}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 shadow-xl transition hover:bg-rose-400 active:scale-95"
              >
                <PhoneIcon className="h-7 w-7 text-white" rotate135 />
              </button>
              <span className="text-xs text-white/70">End call</span>
            </div>

            {/* Placeholder for symmetry */}
            <div className="flex h-14 w-14 flex-col items-center opacity-0" aria-hidden>
              <div className="h-14 w-14" />
            </div>
          </div>
        )}

        {/* Call ended */}
        {callState === 'ended' && (
          <div className="flex justify-center">
            <p className="text-center text-sm text-white/60">
              {duration > 0 ? `Duration: ${formatCallDuration(duration)}` : 'Call not answered'}
            </p>
          </div>
        )}
      </div>
      </div>
    </>
  );
}

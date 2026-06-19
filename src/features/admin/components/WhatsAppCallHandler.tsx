'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

type WsEvent = IncomingCallEvent | CallAnsweredEvent | CallTerminatedEvent | OutboundRingingEvent | { type: string; [key: string]: unknown };

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const ALLOWED_USERS = ['admin@mandiplus.com', 'admin'];


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

export function WhatsAppCallHandler() {
  const { accessProfile } = useAdmin();
  const [callState, setCallState] = useState<CallState>('idle');
  const [callId, setCallId] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [sdpOffer, setSdpOffer] = useState('');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const botBaseUrl =
    (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BOT_API_BASE_URL) ||
    'http://localhost:8000';
  const botAdminToken =
    (typeof window !== 'undefined' && localStorage.getItem('botChatAdminToken')) ||
    process.env.NEXT_PUBLIC_BOT_CHAT_ADMIN_TOKEN ||
    '';

  const wsUrl = botBaseUrl.replace(/^http/, 'ws') + '/ws/calls';

  const currentUser = accessProfile?.account?.username || '';
  const isAllowed = accessProfile?.isFullAdmin || ALLOWED_USERS.includes(currentUser);

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
  }, []);

  const handleOutboundCallAnswered = useCallback(async (event: CallAnsweredEvent) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      const sdpAnswer = event.webrtc_sdp || event.sdp_answer;
      if (!sdpAnswer) {
        setError('No SDP answer received');
        return;
      }

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: sdpAnswer })
      );

      setCallState('active');
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to connect call');
      cleanup();
      setCallState('idle');
    }
  }, [cleanup]);

  const connectWebSocket = useCallback(() => {
    if (!isAllowed) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setError('');
    };

    ws.onmessage = (event) => {
      try {
        const data: WsEvent = JSON.parse(event.data);

        if (data.type === 'incoming_call') {
          const callEvent = data as IncomingCallEvent;
          setCallId(callEvent.call_id);
          setCallerNumber(callEvent.from);
          setSdpOffer(callEvent.sdp_offer);
          setCallState('ringing');
          setDuration(0);
          setError('');
          setDismissed(false);
        } else if (data.type === 'call_answered') {
          const answerEvent = data as CallAnsweredEvent;
          if (pcRef.current) {
            handleOutboundCallAnswered(answerEvent);
          }
        } else if (data.type === 'outbound_call_ringing') {
          const ringingEvent = data as OutboundRingingEvent;
          setCallId(ringingEvent.call_id);
        } else if (data.type === 'call_terminated') {
          const termEvent = data as CallTerminatedEvent;
          if (termEvent.call_id === callId || callState !== 'idle') {
            cleanup();
            setCallState('ended');
            setDuration(termEvent.duration || 0);
            setTimeout(() => {
              setCallState('idle');
              setCallId('');
              setCallerNumber('');
              setDismissed(false);
            }, 3000);
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [wsUrl, callId, callState, isAllowed, cleanup, handleOutboundCallAnswered]);

  useEffect(() => {
    if (!isAllowed) return;
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket, isAllowed]);

  const handleAccept = async () => {
    if (!callId || !sdpOffer) return;
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

      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
      };

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: sdpOffer })
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const sdpAnswer = await new Promise<string>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve(pc.localDescription!.sdp);
          return;
        }
        const timeout = setTimeout(() => {
          resolve(pc.localDescription!.sdp);
        }, 3000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve(pc.localDescription!.sdp);
          }
        };
      });

      const response = await fetch(`${botBaseUrl}/admin/calls/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': botAdminToken,
        },
        body: JSON.stringify({ call_id: callId, sdp_answer: sdpAnswer }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to accept call');
      }

      setCallState('active');
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to accept call');
      cleanup();
      setCallState('idle');
    }
  };

  const handleInitiateCall = useCallback(async (phone: string) => {
    if (callState !== 'idle') return;
    setCallState('calling');
    setCallerNumber(phone);
    setError('');
    setDismissed(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;

      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('active');
          setDuration(0);
          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
              setDuration((d) => d + 1);
            }, 1000);
          }
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanup();
          setCallState('ended');
          setTimeout(() => {
            setCallState('idle');
            setCallId('');
            setCallerNumber('');
            setDismissed(false);
          }, 3000);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpOffer = await new Promise<string>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve(pc.localDescription!.sdp);
          return;
        }
        const timeout = setTimeout(() => {
          resolve(pc.localDescription!.sdp);
        }, 5000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve(pc.localDescription!.sdp);
          }
        };
      });

      const response = await fetch(`${botBaseUrl}/admin/calls/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': botAdminToken,
        },
        body: JSON.stringify({ to_phone: phone, sdp_offer: sdpOffer }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to initiate call');
      }

      const data = await response.json();
      const resultCalls = data?.result?.calls;
      if (resultCalls && Array.isArray(resultCalls) && resultCalls[0]?.id) {
        setCallId(resultCalls[0].id);
      }

      // Auto-transition to active after a short delay.
      // The actual call goes through WhatsApp's infra; the SDP answer
      // arrives via webhook (which may go to production, not localhost).
      // If the WebSocket delivers call_answered first, it'll set active earlier.
      callingTimeoutRef.current = setTimeout(() => {
        setCallState((prev) => {
          if (prev === 'calling') {
            setDuration(0);
            durationIntervalRef.current = setInterval(() => {
              setDuration((d) => d + 1);
            }, 1000);
            return 'active';
          }
          return prev;
        });
      }, 8000);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate call');
      cleanup();
      setCallState('idle');
    }
  }, [callState, botBaseUrl, botAdminToken, cleanup]);

  // Listen for outbound call initiation events from the chat page
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.phone) {
        handleInitiateCall(detail.phone);
      }
    };
    window.addEventListener('wa-initiate-call', handler);
    return () => window.removeEventListener('wa-initiate-call', handler);
  }, [handleInitiateCall]);

  const handleReject = async () => {
    if (!callId) return;

    try {
      await fetch(`${botBaseUrl}/admin/calls/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': botAdminToken,
        },
        body: JSON.stringify({ call_id: callId }),
      });
    } catch {
      // best-effort
    }

    cleanup();
    setCallState('idle');
    setCallId('');
    setCallerNumber('');
    setDismissed(false);
  };

  const handleHangup = async () => {
    if (!callId) return;

    try {
      await fetch(`${botBaseUrl}/admin/calls/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': botAdminToken,
        },
        body: JSON.stringify({ call_id: callId }),
      });
    } catch {
      // best-effort
    }

    cleanup();
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setCallId('');
      setCallerNumber('');
      setDismissed(false);
    }, 2000);
  };

  const handleCancelCall = async () => {
    if (callId) {
      try {
        await fetch(`${botBaseUrl}/admin/calls/terminate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': botAdminToken,
          },
          body: JSON.stringify({ call_id: callId }),
        });
      } catch {
        // best-effort
      }
    }

    cleanup();
    setCallState('idle');
    setCallId('');
    setCallerNumber('');
    setDismissed(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  if (!isAllowed) return null;
  if (callState === 'idle') return null;
  if (dismissed && callState === 'ringing') return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] w-[340px] animate-in slide-in-from-top-2">
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header bar */}
        <div className={`flex items-center justify-between px-4 py-2.5 ${
          callState === 'active' ? 'bg-emerald-600' :
          callState === 'connecting' ? 'bg-amber-500' :
          callState === 'calling' ? 'bg-blue-600' :
          callState === 'ended' ? 'bg-slate-500' :
          'bg-emerald-600'
        }`}>
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-white/90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            <span className="text-xs font-medium text-white/90">
              {callState === 'ringing' ? 'Incoming Call' :
               callState === 'connecting' ? 'Connecting...' :
               callState === 'calling' ? 'Calling...' :
               callState === 'active' ? 'On Call' :
               'Call Ended'}
            </span>
          </div>
          {(callState === 'ringing' || callState === 'ended') && (
            <button
              onClick={handleDismiss}
              className="flex h-6 w-6 items-center justify-center rounded-full text-white/70 transition hover:bg-white/20 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {/* Ringing (incoming) */}
          {callState === 'ringing' && (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-5 w-5 animate-pulse text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{formatCallerNumber(callerNumber)}</p>
                  <p className="text-xs text-slate-500">WhatsApp Voice Call</p>
                </div>
              </div>

              {error && (
                <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600">{error}</p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleReject}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100 active:scale-[0.98]"
                >
                  <svg className="h-4 w-4 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 active:scale-[0.98]"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  Accept
                </button>
              </div>
            </div>
          )}

          {/* Calling (outbound, waiting for answer) */}
          {callState === 'calling' && (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <svg className="h-5 w-5 animate-pulse text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{formatCallerNumber(callerNumber)}</p>
                  <p className="text-xs text-slate-500">Ringing...</p>
                </div>
              </div>

              {error && (
                <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600">{error}</p>
              )}

              <div className="mt-4">
                <button
                  onClick={handleCancelCall}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100 active:scale-[0.98]"
                >
                  <svg className="h-4 w-4 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Connecting */}
          {callState === 'connecting' && (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <svg className="h-5 w-5 animate-spin text-amber-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Connecting...</p>
                <p className="text-xs text-slate-500">{formatCallerNumber(callerNumber)}</p>
              </div>
            </div>
          )}

          {/* Active call */}
          {callState === 'active' && (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{formatCallerNumber(callerNumber)}</p>
                  <p className="font-mono text-xs font-medium text-emerald-600">{formatCallDuration(duration)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition active:scale-95 ${
                    isMuted
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </svg>
                  )}
                </button>
                <button
                  onClick={handleHangup}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-rose-600 active:scale-[0.98]"
                >
                  <svg className="h-4 w-4 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  End Call
                </button>
              </div>
            </div>
          )}

          {/* Call ended */}
          {callState === 'ended' && (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Call Ended</p>
                <p className="text-xs text-slate-500">
                  {duration > 0 ? formatCallDuration(duration) : 'No answer'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

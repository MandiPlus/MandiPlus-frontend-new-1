'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type CallState = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended';

type IncomingCallEvent = {
  type: 'incoming_call';
  call_id: string;
  from: string;
  to: string;
  sdp_offer: string;
  timestamp: string;
};

type CallTerminatedEvent = {
  type: 'call_terminated';
  call_id: string;
  status: string;
  duration: number;
};

type WsEvent = IncomingCallEvent | CallTerminatedEvent | { type: string; [key: string]: unknown };

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

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
  const [callState, setCallState] = useState<CallState>('idle');
  const [callId, setCallId] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [sdpOffer, setSdpOffer] = useState('');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const botBaseUrl =
    (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BOT_API_BASE_URL) ||
    'http://localhost:8000';
  const botAdminToken =
    (typeof window !== 'undefined' && localStorage.getItem('botChatAdminToken')) ||
    process.env.NEXT_PUBLIC_BOT_CHAT_ADMIN_TOKEN ||
    '';

  const wsUrl = botBaseUrl.replace(/^http/, 'ws') + '/ws/calls';

  const connectWebSocket = useCallback(() => {
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
  }, [wsUrl, callId, callState]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
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

      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
      };

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: sdpOffer })
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering to complete (or timeout after 3s)
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

      // Send SDP answer to backend → Meta
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
    }, 2000);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
        {/* Ringing state */}
        {callState === 'ringing' && (
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-10 w-10 animate-pulse text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">Incoming Call</h2>
            <p className="mt-2 text-lg font-medium text-slate-700">
              {formatCallerNumber(callerNumber)}
            </p>
            <p className="mt-1 text-sm text-slate-500">WhatsApp Voice Call</p>

            {error && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
            )}

            <div className="mt-8 flex items-center justify-center gap-6">
              <button
                onClick={handleReject}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition hover:bg-rose-600 active:scale-95"
              >
                <svg className="h-7 w-7 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </button>
              <button
                onClick={handleAccept}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-600 active:scale-95"
              >
                <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-12 text-xs font-medium text-slate-500">
              <span>Decline</span>
              <span>Accept</span>
            </div>
          </div>
        )}

        {/* Connecting state */}
        {callState === 'connecting' && (
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-10 w-10 animate-spin text-amber-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">Connecting...</h2>
            <p className="mt-2 text-sm text-slate-500">Setting up audio with {formatCallerNumber(callerNumber)}</p>
          </div>
        )}

        {/* Active call state */}
        {callState === 'active' && (
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-10 w-10 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-bold text-emerald-700">Call Active</h2>
            <p className="mt-1 text-lg font-medium text-slate-700">
              {formatCallerNumber(callerNumber)}
            </p>
            <p className="mt-2 text-2xl font-mono font-bold text-slate-900">
              {formatCallDuration(duration)}
            </p>

            <div className="mt-8 flex items-center justify-center gap-6">
              <button
                onClick={toggleMute}
                className={`flex h-14 w-14 items-center justify-center rounded-full shadow-md transition active:scale-95 ${
                  isMuted
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isMuted ? (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                )}
              </button>
              <button
                onClick={handleHangup}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition hover:bg-rose-600 active:scale-95"
              >
                <svg className="h-7 w-7 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-12 text-xs font-medium text-slate-500">
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              <span>End Call</span>
            </div>
          </div>
        )}

        {/* Call ended state */}
        {callState === 'ended' && (
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-10 w-10 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-700">Call Ended</h2>
            <p className="mt-1 text-sm text-slate-500">
              {duration > 0 ? `Duration: ${formatCallDuration(duration)}` : 'No duration'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

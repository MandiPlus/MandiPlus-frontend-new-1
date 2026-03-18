'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAdmin } from '@/features/admin/context/AdminContext';

type Conversation = {
  phone: string;
  last_message_at: string;
  last_direction: 'inbound' | 'outbound' | 'system' | string;
  last_message_type: string;
  last_text: string | null;
  last_status: string;
  total_messages: number;
  failed_messages: number;
};

type ChatMessage = {
  id: string;
  phone: string;
  wa_message_id: string | null;
  direction: 'inbound' | 'outbound' | 'system' | string;
  message_type: string;
  text_content: string | null;
  payload: unknown;
  status: string;
  error_text: string | null;
  created_at: string;
};

type ConversationResponse = {
  count: number;
  items: Conversation[];
};

type MessageResponse = {
  count: number;
  phone: string;
  items: ChatMessage[];
};

function formatPhone(value: string) {
  if (!value) return 'Unknown';
  if (value.length < 4) return value;
  return `${value.slice(0, 2)} ${value.slice(2, 7)} ${value.slice(7)}`.trim();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function previewText(text: string | null, fallbackType: string) {
  if (text && text.trim()) return text.trim();
  return `[${fallbackType}]`;
}

function statusBadgeClass(status: string) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'read') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'delivered') return 'bg-sky-100 text-sky-800';
  if (normalized === 'sent') return 'bg-slate-200 text-slate-700';
  if (normalized === 'failed') return 'bg-rose-100 text-rose-800';
  if (normalized === 'processed') return 'bg-violet-100 text-violet-800';
  if (normalized === 'received') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-200 text-slate-700';
}

export default function AdminChatLogsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [draftMessage, setDraftMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const botBaseUrl =
    process.env.NEXT_PUBLIC_BOT_API_BASE_URL || 'http://localhost:8000';
  const botAdminToken =
    (typeof window !== 'undefined' && localStorage.getItem('botChatAdminToken')) ||
    process.env.NEXT_PUBLIC_BOT_CHAT_ADMIN_TOKEN ||
    '';

  const axiosConfig = useMemo(
    () =>
      botAdminToken
        ? {
            headers: {
              'x-admin-token': botAdminToken,
            },
          }
        : {},
    [botAdminToken]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchConversations = async () => {
      try {
        setLoadingConversations(true);
        setError('');
        const res = await axios.get<ConversationResponse>(
          `${botBaseUrl}/admin/chat/conversations?limit=250`,
          axiosConfig
        );
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setConversations(items);

        if (!selectedPhone && items.length > 0) {
          setSelectedPhone(items[0].phone);
        } else if (
          selectedPhone &&
          !items.find((item) => item.phone === selectedPhone) &&
          items.length > 0
        ) {
          setSelectedPhone(items[0].phone);
        }
      } catch {
        setError('Could not load chat conversations from bot backend.');
      } finally {
        setLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [isAuthenticated, botBaseUrl, axiosConfig, refreshTick, selectedPhone]);

  useEffect(() => {
    if (!isAuthenticated || !selectedPhone) return;

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        setError('');
        const res = await axios.get<MessageResponse>(
          `${botBaseUrl}/admin/chat/conversations/${selectedPhone}/messages?limit=700`,
          axiosConfig
        );
        setMessages(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch {
        setError('Could not load messages for selected chat.');
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [isAuthenticated, selectedPhone, botBaseUrl, axiosConfig, refreshTick]);

  useEffect(() => {
    const id = setInterval(() => setRefreshTick((x) => x + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const key = search.trim().toLowerCase();
    return conversations.filter(
      (c) =>
        c.phone.toLowerCase().includes(key) ||
        (c.last_text || '').toLowerCase().includes(key)
    );
  }, [conversations, search]);

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPhone || !draftMessage.trim() || sendingMessage) return;

    try {
      setSendingMessage(true);
      setError('');
      await axios.post(
        `${botBaseUrl}/admin/chat/send`,
        {
          phone: selectedPhone,
          text: draftMessage.trim(),
        },
        axiosConfig
      );
      setDraftMessage('');
      setRefreshTick((x) => x + 1);
    } catch {
      setError('Failed to send message. Check bot token/template window rules.');
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="h-[calc(100vh-7.5rem)] py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">WhatsApp Chat Logs</h1>
          <p className="text-sm text-slate-500">
            New conversations are stored and visible from backend deployment onward.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((x) => x + 1)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid h-[calc(100%-3.5rem)] grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:grid-cols-[360px_1fr]">
        <aside className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone or message..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <p className="p-4 text-sm text-slate-500">Loading conversations...</p>
            ) : filteredConversations.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No conversations found.</p>
            ) : (
              filteredConversations.map((conv) => {
                const active = conv.phone === selectedPhone;
                return (
                  <button
                    type="button"
                    key={conv.phone}
                    onClick={() => setSelectedPhone(conv.phone)}
                    className={`w-full border-b border-slate-200 px-3 py-3 text-left ${
                      active ? 'bg-emerald-100/70' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {formatPhone(conv.phone)}
                      </p>
                      <p className="shrink-0 text-xs text-slate-500">
                        {formatTime(conv.last_message_at)}
                      </p>
                    </div>
                    <p className="truncate text-xs text-slate-600">
                      {previewText(conv.last_text, conv.last_message_type)}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">
                        {conv.total_messages} msgs
                      </span>
                      {conv.failed_messages > 0 ? (
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-700">
                          {conv.failed_messages} failed
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
                          healthy
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#efeae2]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedPhone ? formatPhone(selectedPhone) : 'Select a conversation'}
              </p>
              <p className="text-xs text-slate-500">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="text-xs text-slate-500">Auto-refresh: 15s</div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            {!selectedPhone ? (
              <p className="text-sm text-slate-500">Choose a chat from the left panel.</p>
            ) : loadingMessages ? (
              <p className="text-sm text-slate-500">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages available for this number.</p>
            ) : (
              messages.map((message) => {
                const incoming = message.direction === 'inbound';
                const system = message.direction === 'system';
                const bubbleClass = system
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : incoming
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-emerald-100 border-emerald-300 text-slate-900';

                return (
                  <div
                    key={message.id}
                    className={`mb-3 flex ${incoming || system ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] rounded-xl border px-3 py-2 shadow-sm ${bubbleClass}`}>
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {previewText(message.text_content, message.message_type)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded bg-black/5 px-1.5 py-0.5 uppercase tracking-wide">
                          {message.direction}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${statusBadgeClass(
                            message.status
                          )}`}
                        >
                          {message.status}
                        </span>
                        <span className="text-slate-500">{formatTime(message.created_at)}</span>
                      </div>
                      {message.error_text ? (
                        <p className="mt-2 rounded bg-rose-100 px-2 py-1 text-xs text-rose-700">
                          {message.error_text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="border-t border-slate-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <input
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder={selectedPhone ? 'Type a message...' : 'Select a conversation first'}
                disabled={!selectedPhone || sendingMessage}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100"
              />
              <button
                type="submit"
                disabled={!selectedPhone || !draftMessage.trim() || sendingMessage}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

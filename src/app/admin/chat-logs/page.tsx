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

type TemplateComponent = {
  type?: string;
  text?: string;
};

type TemplateItem = {
  name: string;
  status?: string;
  language?: string;
  category?: string;
  components?: TemplateComponent[];
};

type TemplateListResponse = {
  count: number;
  items: TemplateItem[];
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

function extractBodyPlaceholders(template: TemplateItem): number {
  const bodyComponent = (template.components || []).find(
    (comp) => (comp.type || '').toUpperCase() === 'BODY'
  );
  const text = bodyComponent?.text || '';
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
  if (matches.length === 0) return 0;
  const maxIndex = Math.max(...matches.map((m) => Number(m[1] || 0)));
  return Number.isFinite(maxIndex) ? maxIndex : 0;
}

function templateBodyPreview(template: TemplateItem): string {
  const bodyComponent = (template.components || []).find(
    (comp) => (comp.type || '').toUpperCase() === 'BODY'
  );
  return bodyComponent?.text || '';
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

  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [sendingTemplate, setSendingTemplate] = useState(false);

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

  const bodyVarCount = useMemo(
    () => (selectedTemplate ? extractBodyPlaceholders(selectedTemplate) : 0),
    [selectedTemplate]
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

  useEffect(() => {
    if (!showTemplateModal || !isAuthenticated) return;

    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        setTemplateError('');
        const res = await axios.get<TemplateListResponse>(
          `${botBaseUrl}/admin/chat/templates`,
          {
            ...axiosConfig,
            params: { search: templateSearch, limit: 300 },
          }
        );
        setTemplates(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch {
        setTemplateError('Could not load templates from Meta.');
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [showTemplateModal, templateSearch, isAuthenticated, botBaseUrl, axiosConfig]);

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateVars([]);
      return;
    }
    setTemplateVars((prev) => {
      const next = [...prev];
      while (next.length < bodyVarCount) next.push('');
      return next.slice(0, bodyVarCount);
    });
  }, [selectedTemplate, bodyVarCount]);

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

  const openTemplateModal = () => {
    if (!selectedPhone) {
      setError('Select a conversation first.');
      return;
    }
    setShowActionMenu(false);
    setShowTemplateModal(true);
    setSelectedTemplate(null);
    setTemplateVars([]);
    setTemplateSearch('');
  };

  const handleTemplateVarChange = (index: number, value: string) => {
    setTemplateVars((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSendTemplate = async () => {
    if (!selectedPhone || !selectedTemplate || sendingTemplate) return;
    if (templateVars.some((v) => !v.trim())) {
      setTemplateError('Please fill all template variables.');
      return;
    }

    try {
      setSendingTemplate(true);
      setTemplateError('');
      await axios.post(
        `${botBaseUrl}/admin/chat/send-template`,
        {
          phone: selectedPhone,
          template_name: selectedTemplate.name,
          language_code: selectedTemplate.language || 'en',
          body_parameters: templateVars.map((v) => v.trim()),
        },
        axiosConfig
      );
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      setTemplateVars([]);
      setRefreshTick((x) => x + 1);
    } catch {
      setTemplateError('Template send failed. Check template params and WhatsApp policy window.');
    } finally {
      setSendingTemplate(false);
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

          <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-3">
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu((v) => !v)}
                  disabled={!selectedPhone}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg leading-none text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  &#9776;
                </button>
                {showActionMenu ? (
                  <div className="absolute bottom-12 right-0 z-20 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={openTemplateModal}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Template Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowActionMenu(false)}
                      className="w-full cursor-not-allowed rounded-md px-3 py-2 text-left text-sm text-slate-400"
                    >
                      Send Flow (Coming Soon)
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </form>
        </section>
      </div>

      {showTemplateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Template Message</p>
              <p className="text-xs text-slate-500">Send to {formatPhone(selectedPhone)}</p>
            </div>

            <div className="grid max-h-[72vh] grid-cols-1 gap-0 overflow-hidden md:grid-cols-[320px_1fr]">
              <div className="border-r border-slate-200">
                <div className="p-3">
                  <input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="max-h-[60vh] overflow-y-auto border-t border-slate-100">
                  {loadingTemplates ? (
                    <p className="p-3 text-sm text-slate-500">Loading templates...</p>
                  ) : templates.length === 0 ? (
                    <p className="p-3 text-sm text-slate-500">No templates found.</p>
                  ) : (
                    templates.map((tpl) => {
                      const active = selectedTemplate?.name === tpl.name;
                      return (
                        <button
                          key={`${tpl.name}_${tpl.language || 'en'}`}
                          type="button"
                          onClick={() => setSelectedTemplate(tpl)}
                          className={`w-full border-b border-slate-100 px-3 py-3 text-left ${
                            active ? 'bg-emerald-100/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <p className="truncate text-sm font-medium text-slate-900">{tpl.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {(tpl.status || 'UNKNOWN').toUpperCase()} • {(tpl.language || 'en').toLowerCase()}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="max-h-[72vh] overflow-y-auto p-4">
                {!selectedTemplate ? (
                  <p className="text-sm text-slate-500">Select a template from the left list.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedTemplate.name}</p>
                      <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {templateBodyPreview(selectedTemplate) || 'No body preview available.'}
                      </p>
                    </div>

                    {bodyVarCount > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Template Variables
                        </p>
                        {Array.from({ length: bodyVarCount }).map((_, idx) => (
                          <input
                            key={`var_${idx + 1}`}
                            value={templateVars[idx] || ''}
                            onChange={(e) => handleTemplateVarChange(idx, e.target.value)}
                            placeholder={`Variable {{${idx + 1}}}`}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">This template has no body variables.</p>
                    )}
                  </div>
                )}

                {templateError ? (
                  <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {templateError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateError('');
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTemplate}
                disabled={!selectedTemplate || sendingTemplate}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {sendingTemplate ? 'Sending...' : 'Send Template'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


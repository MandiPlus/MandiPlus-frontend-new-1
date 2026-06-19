'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { MoreVertical } from 'lucide-react';

type Conversation = {
  phone: string;
  last_message_at: string;
  last_direction: 'inbound' | 'outbound' | 'system' | string;
  last_message_type: string;
  last_text: string | null;
  last_status: string;
  total_messages: number;
  failed_messages: number;
  name?: string | null;
  profile_name?: string | null;
  display_name?: string | null;
  contact_name?: string | null;
  unread_count?: number;
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

type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker';

type MediaInfo = {
  kind: MediaKind;
  mediaId?: string;
  directUrl?: string;
  filename?: string;
  caption?: string;
  isVoice?: boolean;
};

type LocationInfo = {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
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

type ContactProfile = {
  phone: string;
  name?: string | null;
  profile_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  language?: string | null;
  status?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  source?: string | null;
  last_read_at?: string | null;
};

type MetaSenderProfileResponse = {
  ok: boolean;
  item?: {
    profile: {
      phoneNumberId?: string;
      displayPhoneNumber?: string;
      verifiedName?: string;
      qualityRating?: string;
      codeVerificationStatus?: string;
      nameStatus?: string;
      newNameStatus?: string;
      platformType?: string;
      throughput?: unknown;
      about?: string;
      address?: string;
      description?: string;
      email?: string;
      profilePictureUrl?: string;
      websites?: string[];
      vertical?: string;
    };
    templateCount: number;
    templates: Array<{
      name: string;
      status?: string;
      language?: string;
      category?: string;
    }>;
  };
};

type ChatFilter = 'all' | 'unread' | 'delivered' | 'failed';
type MainTab = 'chats' | 'calls';

type CallRecord = {
  call_id: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: 'answered' | 'missed';
  started_at: number;
  duration: number;
};

type ChatTheme = 'light' | 'dark';

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

function formatDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function payloadPreview(payload: unknown): string | null {
  if (!payload) return null;

  const asObject =
    typeof payload === 'string'
      ? (() => {
        try {
          return JSON.parse(payload);
        } catch {
          return null;
        }
      })()
      : payload;

  const sources: Record<string, any>[] = [];
  if (asObject && typeof asObject === 'object') {
    sources.push(asObject as Record<string, any>);
    const req = (asObject as Record<string, any>).request;
    if (req && typeof req === 'object') {
      sources.push(req as Record<string, any>);
    }
  }

  for (const src of sources) {
    const textBody = src?.text?.body;
    if (typeof textBody === 'string' && textBody.trim()) return textBody.trim();

    const buttonText = src?.button?.text;
    if (typeof buttonText === 'string' && buttonText.trim()) return buttonText.trim();

    const buttonTitle = src?.interactive?.button_reply?.title;
    if (typeof buttonTitle === 'string' && buttonTitle.trim()) return buttonTitle.trim();

    const listTitle = src?.interactive?.list_reply?.title;
    if (typeof listTitle === 'string' && listTitle.trim()) return listTitle.trim();

    const imageCaption = src?.image?.caption;
    if (typeof imageCaption === 'string' && imageCaption.trim()) return `[image] ${imageCaption.trim()}`;
    if (src?.image) return '[image]';

    const videoCaption = src?.video?.caption;
    if (typeof videoCaption === 'string' && videoCaption.trim()) return `[video] ${videoCaption.trim()}`;
    if (src?.video) return '[video]';

    if (src?.audio) {
      const isVoice = src?.audio?.voice;
      return isVoice ? '[voice]' : '[audio]';
    }

    if (src?.sticker) return '[sticker]';

    const fileName = src?.document?.filename;
    const docCaption = src?.document?.caption;
    if (typeof fileName === 'string' && fileName.trim()) {
      if (typeof docCaption === 'string' && docCaption.trim()) {
        return `[document] ${fileName.trim()} - ${docCaption.trim()}`;
      }
      return `[document] ${fileName.trim()}`;
    }
    if (src?.document) return '[document]';

    if (src?.location) {
      const lat = src?.location?.latitude;
      const lng = src?.location?.longitude;
      return `[location] ${lat ?? ''},${lng ?? ''}`.trim();
    }

    if (Array.isArray(src?.contacts) && src.contacts.length > 0) {
      const names = src.contacts
        .map((c: unknown) =>
          typeof c === 'object' && c !== null
            ? (c as { name?: { formatted_name?: string } }).name?.formatted_name
            : undefined
        )
        .filter((v: unknown) => typeof v === 'string' && v.trim())
        .slice(0, 3);
      if (names.length > 0) return `[contacts] ${names.join(', ')}`;
      return '[contacts]';
    }

    if (src?.reaction) {
      const emoji = src?.reaction?.emoji;
      if (typeof emoji === 'string' && emoji.trim()) return `[reaction] ${emoji}`;
      return '[reaction]';
    }

    const errors = src?.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] || {};
      const title = first?.title || first?.message || first?.details;
      const code = first?.code;
      if (title && code !== undefined) return `[error] ${title} (code ${code})`;
      if (title) return `[error] ${title}`;
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim().slice(0, 160);
  }

  try {
    return JSON.stringify(payload).slice(0, 160);
  } catch {
    return null;
  }
}

function extractTemplateBodyParameters(payload: unknown): string[] {
  for (const src of payloadSources(payload)) {
    const template = src?.template as Record<string, any> | undefined;
    const components = Array.isArray(template?.components)
      ? (template.components as Array<Record<string, any>>)
      : [];

    for (const component of components) {
      if (String(component?.type || '').toLowerCase() !== 'body') continue;
      const parameters = Array.isArray(component?.parameters)
        ? (component.parameters as Array<Record<string, any>>)
        : [];
      return parameters
        .map((param) => (typeof param?.text === 'string' ? param.text : ''))
        .filter((value) => value.trim());
    }
  }
  return [];
}

function renderTemplateText(template: TemplateItem | null | undefined, payload?: unknown): string | null {
  if (!template) return null;
  const body = templateBodyPreview(template);
  if (!body.trim()) return null;

  const parameters = extractTemplateBodyParameters(payload);
  if (parameters.length === 0) return body;

  return body.replace(/\{\{(\d+)\}\}/g, (_match, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    return parameters[index] ?? `{{${rawIndex}}}`;
  });
}

function getTemplateNameFromPayload(payload: unknown): string | null {
  for (const src of payloadSources(payload)) {
    const template = src?.template as Record<string, any> | undefined;
    if (typeof template?.name === 'string' && template.name.trim()) {
      return template.name.trim();
    }
  }
  return null;
}

function getTemplateNameFromStoredText(text: string | null): string | null {
  const value = (text || '').trim();
  const match = value.match(/^\[template\]\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function previewText(
  text: string | null,
  fallbackType: string,
  payload?: unknown,
  templatesByName?: Record<string, TemplateItem>
) {
  const templateNameFromText = getTemplateNameFromStoredText(text);
  if (templateNameFromText && templatesByName) {
    const rendered = renderTemplateText(templatesByName[templateNameFromText], payload);
    if (rendered && rendered.trim()) return rendered.trim();
  }
  if (text && text.trim()) {
    const raw = text.trim();
    if (/\{\{\d+\}\}/.test(raw) && payload) {
      const params = extractTemplateBodyParameters(payload);
      if (params.length > 0) {
        return raw.replace(/\{\{(\d+)\}\}/g, (_m, idx) => params[Number(idx) - 1] ?? `{{${idx}}}`);
      }
    }
    return raw;
  }
  const templateName = getTemplateNameFromPayload(payload);
  if (templateName && templatesByName) {
    const rendered = renderTemplateText(templatesByName[templateName], payload);
    if (rendered && rendered.trim()) return rendered.trim();
  }
  const fromPayload = payloadPreview(payload);
  if (fromPayload && fromPayload.trim()) return fromPayload.trim();
  return `[${fallbackType}]`;
}

function payloadAsObject(payload: unknown): Record<string, any> | null {
  if (!payload) return null;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (typeof payload === 'object') return payload as Record<string, any>;
  return null;
}

function payloadSources(payload: unknown): Record<string, any>[] {
  const obj = payloadAsObject(payload);
  if (!obj || typeof obj !== 'object') return [];
  const sources = [obj];
  if (obj.request && typeof obj.request === 'object') {
    sources.push(obj.request as Record<string, any>);
  }
  return sources;
}

function extractMessageMedia(message: ChatMessage): MediaInfo | null {
  for (const src of payloadSources(message.payload)) {
    const image = src?.image;
    if (image?.id || image?.link) {
      return {
        kind: 'image',
        mediaId: image?.id ? String(image.id) : undefined,
        directUrl: typeof image?.link === 'string' ? image.link : undefined,
        caption: typeof image.caption === 'string' ? image.caption : undefined,
      };
    }

    const video = src?.video;
    if (video?.id || video?.link) {
      return {
        kind: 'video',
        mediaId: video?.id ? String(video.id) : undefined,
        directUrl: typeof video?.link === 'string' ? video.link : undefined,
        caption: typeof video.caption === 'string' ? video.caption : undefined,
      };
    }

    const audio = src?.audio;
    if (audio?.id || audio?.link) {
      return {
        kind: 'audio',
        mediaId: audio?.id ? String(audio.id) : undefined,
        directUrl: typeof audio?.link === 'string' ? audio.link : undefined,
        isVoice: Boolean(audio.voice),
      };
    }

    const document = src?.document;
    if (document?.id || document?.link) {
      return {
        kind: 'document',
        mediaId: document?.id ? String(document.id) : undefined,
        directUrl: typeof document?.link === 'string' ? document.link : undefined,
        filename: typeof document.filename === 'string' ? document.filename : undefined,
        caption: typeof document.caption === 'string' ? document.caption : undefined,
      };
    }

    const sticker = src?.sticker;
    if (sticker?.id || sticker?.link) {
      return {
        kind: 'sticker',
        mediaId: sticker?.id ? String(sticker.id) : undefined,
        directUrl: typeof sticker?.link === 'string' ? sticker.link : undefined,
      };
    }
  }
  return null;
}

function extractMessageLocation(message: ChatMessage): LocationInfo | null {
  for (const src of payloadSources(message.payload)) {
    const location = src?.location;
    if (location) {
      return {
        latitude: typeof location.latitude === 'number' ? location.latitude : undefined,
        longitude: typeof location.longitude === 'number' ? location.longitude : undefined,
        name: typeof location.name === 'string' ? location.name : undefined,
        address: typeof location.address === 'string' ? location.address : undefined,
      };
    }
  }
  return null;
}

function statusLabel(status: string) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'processed') return 'received';
  return status || 'unknown';
}

function getWhatsappStatusType(status: string) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'read') return 'read';
  if (normalized === 'delivered') return 'delivered';
  if (normalized === 'sent') return 'sent';
  if (normalized === 'failed') return 'failed';
  return null;
}

function WhatsappTicks({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  const type = getWhatsappStatusType(status);
  if (!type) return null;

  if (type === 'failed') {
    return (
      <span className={`inline-flex items-center text-xs font-semibold text-rose-500 ${className}`}>
        !
      </span>
    );
  }

  const colorClass =
    type === 'read' ? 'text-sky-400' : 'text-slate-400';
  const tickCount = type === 'sent' ? 1 : 2;

  return (
    <span className={`inline-flex items-center ${colorClass} ${className}`} aria-label={statusLabel(status)}>
      <span className="text-[12px] leading-none">✓</span>
      {tickCount === 2 ? (
        <span className="-ml-1 text-[12px] leading-none">✓</span>
      ) : null}
    </span>
  );
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

function getConversationName(
  conversation: Conversation,
  contactDirectory?: Record<string, { name?: string }>
) {
  const candidates = [
    contactDirectory?.[conversation.phone]?.name,
    conversation.name,
    conversation.profile_name,
    conversation.display_name,
    conversation.contact_name,
  ];
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return match?.trim() || '';
}

function getConversationInitials(conversation: Conversation) {
  const name = getConversationName(conversation);
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'WA';
  }
  const phone = conversation.phone || '';
  return phone.slice(-2).toUpperCase() || 'WA';
}

function isUnreadConversation(conversation: Conversation) {
  return Number(conversation.unread_count || 0) > 0;
}

function isDeliveredConversation(conversation: Conversation) {
  return (conversation.last_status || '').toLowerCase() === 'delivered';
}

function isFailedConversation(conversation: Conversation) {
  return conversation.failed_messages > 0 || (conversation.last_status || '').toLowerCase() === 'failed';
}

function matchesFilter(conversation: Conversation, filter: ChatFilter) {
  if (filter === 'unread') return isUnreadConversation(conversation);
  if (filter === 'delivered') return isDeliveredConversation(conversation);
  if (filter === 'failed') return isFailedConversation(conversation);
  return true;
}

function messageMetaLabel(message: ChatMessage) {
  const direction = (message.direction || '').toLowerCase();
  if (direction === 'system') return 'System event';
  if (direction === 'inbound') return 'Incoming';
  return 'Outgoing';
}

function getAttachmentExtension(filename?: string, url?: string) {
  const source = (filename || url || '').split('?')[0];
  const part = source.split('.').pop()?.toLowerCase() || '';
  return part;
}

function buildOpenUrl(media: MediaInfo, resolvedUrl: string) {
  if (media.kind !== 'document') return resolvedUrl;

  const extension = getAttachmentExtension(media.filename, media.directUrl || resolvedUrl);
  const officeExtensions = new Set(['xlsx', 'xls', 'csv', 'doc', 'docx', 'ppt', 'pptx']);

  if (media.directUrl && officeExtensions.has(extension)) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(media.directUrl)}`;
  }

  return media.directUrl || resolvedUrl;
}

function openAttachment(media: MediaInfo, resolvedUrl: string) {
  const targetUrl = buildOpenUrl(media, resolvedUrl);
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}

type UrlButton = { text: string; url: string };

function extractUrlButtons(payload: unknown): UrlButton[] {
  const buttons: UrlButton[] = [];
  for (const src of payloadSources(payload)) {
    const template = src?.template as Record<string, any> | undefined;
    const components = Array.isArray(template?.components)
      ? (template.components as Array<Record<string, any>>)
      : [];
    for (const component of components) {
      if (String(component?.type || '').toUpperCase() !== 'BUTTONS') continue;
      const btns = Array.isArray(component?.buttons)
        ? (component.buttons as Array<Record<string, any>>)
        : [];
      for (const btn of btns) {
        if (String(btn?.type || '').toUpperCase() === 'URL' && typeof btn.url === 'string') {
          buttons.push({ text: String(btn.text || 'Open link'), url: btn.url });
        }
      }
    }
    // cta_url interactive messages
    const interactive = src?.interactive as Record<string, any> | undefined;
    if (interactive?.type === 'cta_url') {
      const action = interactive?.action as Record<string, any> | undefined;
      if (typeof action?.url === 'string') {
        buttons.push({ text: String(interactive?.body?.text || 'Open link'), url: action.url });
      }
    }
  }
  return buttons;
}

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={key++} href={match[0]} target="_blank" rel="noreferrer"
        className="break-all underline underline-offset-2 opacity-90 hover:opacity-100">
        {match[0]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return (
    <p className={`whitespace-pre-wrap break-words text-sm leading-6 ${className ?? ''}`}>
      {parts}
    </p>
  );
}

function prettifyFieldLabel(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function collectPayloadMetadata(messages: ChatMessage[]) {
  const rows: Array<{ key: string; value: string }> = [];
  const seen = new Set<string>();
  const skipKeys = new Set([
    'id',
    'type',
    'text',
    'body',
    'caption',
    'filename',
    'mime_type',
    'link',
    'status',
    'timestamp',
    'recipient_type',
    'messaging_product',
    'preview_url',
  ]);

  const visit = (value: unknown, path = '', depth = 0) => {
    if (rows.length >= 10 || depth > 2 || value === null || value === undefined) return;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const normalized = String(value).trim();
      if (!normalized || normalized.length > 120) return;
      const key = path.split('.').pop() || path;
      if (!key || skipKeys.has(key.toLowerCase()) || seen.has(path)) return;
      seen.add(path);
      rows.push({ key: prettifyFieldLabel(key), value: normalized });
      return;
    }

    if (Array.isArray(value)) {
      value.slice(0, 3).forEach((item) => visit(item, path, depth + 1));
      return;
    }

    if (typeof value === 'object') {
      Object.entries(value as Record<string, any>).forEach(([childKey, childValue]) => {
        if (rows.length >= 10) return;
        const nextPath = path ? `${path}.${childKey}` : childKey;
        visit(childValue, nextPath, depth + 1);
      });
    }
  };

  [...messages]
    .reverse()
    .slice(0, 12)
    .forEach((message) => {
      payloadSources(message.payload).forEach((src) => visit(src));
    });

  return rows;
}

function extractContactNameFromMessages(messages: ChatMessage[]) {
  for (const message of [...messages].reverse()) {
    for (const src of payloadSources(message.payload)) {
      const candidates = [
        typeof src?.profile_name === 'string' ? src.profile_name : '',
        typeof src?.name === 'string' ? src.name : '',
        typeof src?.profile?.name === 'string' ? src.profile.name : '',
        typeof src?.contact?.name === 'string' ? src.contact.name : '',
        typeof src?.contacts?.[0]?.name?.formatted_name === 'string'
          ? src.contacts[0].name.formatted_name
          : '',
      ];
      const match = candidates.find((value) => value.trim());
      if (match) return match.trim();
    }
  }
  return '';
}

const themeOptions: Array<{
  key: ChatTheme;
  label: string;
  shell: string;
  panel: string;
  topbar: string;
  pane: string;
  incoming: string;
  outgoing: string;
  system: string;
  wallpaper: string;
}> = [
    {
      key: 'light',
      label: 'Light',
      shell: 'bg-[#f0f2f5]',
      panel: 'bg-white',
      topbar: 'bg-[#f0f2f5]',
      pane: '#efeae2',
      incoming: 'bg-white text-slate-900',
      outgoing: 'bg-[#d9fdd3] text-slate-900',
      system: 'bg-[#fff3c4] text-amber-950',
      wallpaper: "url('/images/whatsapp-bg.png')",
    },
    {
      key: 'dark',
      label: 'Dark',
      shell: 'bg-[#111b21]',
      panel: 'bg-[#111b21]',
      topbar: 'bg-[#111b21]',
      pane: '#0b141a',
      incoming: 'bg-[#202c33] text-slate-100',
      outgoing: 'bg-[#005c4b] text-white',
      system: 'bg-[#374151] text-slate-100',
      wallpaper:
        "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 2px, transparent 2px), radial-gradient(circle at 75% 35%, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 2px, transparent 2px), linear-gradient(180deg, rgba(17,27,33,0.98), rgba(11,20,26,1))",
    },
  ];

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1024;
}

export function AdminChatLogsView({ standalone = false }: { standalone?: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [contactDirectory, setContactDirectory] = useState<Record<string, { name: string }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('chatContactDirectory');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [mediaFailures, setMediaFailures] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [chatTheme, setChatTheme] = useState<ChatTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const stored = localStorage.getItem('chatLogsTheme');
      return (stored === 'light' || stored === 'dark') ? stored : 'light';
    } catch { return 'light'; }
  });
  const [refreshTick, setRefreshTick] = useState(0);
  const [draftMessage, setDraftMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState('');
  const [deleteModal, setDeleteModal] = useState<
    | { type: 'conversation'; phone: string; label: string }
    | { type: 'message'; message: ChatMessage }
    | null
  >(null);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactMessage, setNewContactMessage] = useState('Namaste! MandiPlus se aapka swagat hai. Hum aapki kaise madad kar sakte hain?');
  const [savingContact, setSavingContact] = useState(false);
  const [contactProfile, setContactProfile] = useState<ContactProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    profile_name: '',
    display_name: '',
    email: '',
    language: '',
    status: '',
    notes: '',
    assigned_to: '',
  });

  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [msgMenuId, setMsgMenuId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Calls tab
  const [mainTab, setMainTab] = useState<MainTab>('chats');
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasLoadedConversationsRef = useRef(false);
  const hasLoadedMessagesRef = useRef(false);
  const mobileBackRef = useRef(false);
  const phoneChangedRef = useRef(false);
  const scrollSnapshotRef = useRef<{
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  } | null>(null);

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
  const templatesByName = useMemo(
    () =>
      templates.reduce<Record<string, TemplateItem>>((acc, template) => {
        acc[template.name] = template;
        return acc;
      }, {}),
    [templates]
  );
  const activeTheme = useMemo(
    () => themeOptions.find((theme) => theme.key === chatTheme) || themeOptions[0],
    [chatTheme]
  );
  const currentTheme = standalone ? activeTheme : themeOptions[0];
  const latestMessage = messages[messages.length - 1] || null;
  const contactMetadata = useMemo(() => collectPayloadMetadata(messages), [messages]);
  const getDisplayName = (conversation: Conversation) =>
    getConversationName(conversation, contactDirectory) || formatPhone(conversation.phone);
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.phone === selectedPhone) || null,
    [conversations, selectedPhone]
  );
  const selectedUnreadCount = selectedConversation?.unread_count || 0;
  const isDark = standalone && chatTheme === 'dark';
  const deletePillClass = standalone && isDark
    ? 'border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
    : 'border border-rose-200 bg-white/85 text-rose-600 hover:bg-rose-50';


  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('chatContactDirectory', JSON.stringify(contactDirectory));
    } catch { }
  }, [contactDirectory]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('chatLogsTheme', chatTheme);
    } catch { }
  }, [chatTheme]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, router]);

  // Fetch call history whenever the calls tab is active or refreshTick changes
  useEffect(() => {
    if (!isAuthenticated || mainTab !== 'calls') return;
    setLoadingCalls(true);
    axios.get(`${botBaseUrl}/admin/calls/history?limit=100`, axiosConfig)
      .then((res) => setCallHistory(res.data?.items ?? []))
      .catch((err) => console.error('calls/history fetch error:', err))
      .finally(() => setLoadingCalls(false));
  }, [isAuthenticated, botBaseUrl, axiosConfig, mainTab, refreshTick]);


  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchConversations = async () => {
      try {
        if (!hasLoadedConversationsRef.current) {
          setLoadingConversations(true);
        }
        const res = await axios.get<ConversationResponse>(
          `${botBaseUrl}/admin/chat/conversations?limit=250`,
          axiosConfig
        );
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setConversations((prev) => {
          const same =
            prev.length === items.length &&
            prev.every((item, index) => {
              const next = items[index];
              return (
                item.phone === next?.phone &&
                item.last_message_at === next?.last_message_at &&
                item.last_status === next?.last_status &&
                item.total_messages === next?.total_messages &&
                item.failed_messages === next?.failed_messages &&
                item.unread_count === next?.unread_count
              );
            });
          return same ? prev : items;
        });
        hasLoadedConversationsRef.current = true;

        if (items.length === 0) {
          setSelectedPhone('');
        } else if (!selectedPhone && items.length > 0 && !mobileBackRef.current) {
          if (!isMobileViewport()) {
            setSelectedPhone(items[0].phone);
          }
        } else if (
          selectedPhone &&
          !items.find((item) => item.phone === selectedPhone) &&
          items.length > 0
        ) {
          if (!isMobileViewport()) {
            setSelectedPhone(items[0].phone);
          } else {
            setSelectedPhone('');
          }
        }
      } catch {
        if (!hasLoadedConversationsRef.current) {
          setError('Could not load chat conversations from bot backend.');
        }
      } finally {
        setLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [isAuthenticated, botBaseUrl, axiosConfig, refreshTick, selectedPhone]);

  useEffect(() => {
    if (conversations.length === 0) return;
    setContactDirectory((prev) => {
      let changed = false;
      const next = { ...prev };
      conversations.forEach((conversation) => {
        const backendName = getConversationName(conversation);
        if (backendName && next[conversation.phone]?.name !== backendName) {
          next[conversation.phone] = { name: backendName };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [conversations]);

  useEffect(() => {
    if (!selectedPhone || messages.length === 0) return;
    const inferredName = extractContactNameFromMessages(messages);
    if (!inferredName) return;
    setContactDirectory((prev) => {
      if (prev[selectedPhone]?.name === inferredName) return prev;
      return {
        ...prev,
        [selectedPhone]: { name: inferredName },
      };
    });
  }, [messages, selectedPhone]);

  useEffect(() => {
    if (!selectedPhone) {
      setContactProfile(null);
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const response = await axios.get<{ ok: boolean; item: ContactProfile }>(
          `${botBaseUrl}/admin/chat/contacts/${selectedPhone}`,
          axiosConfig
        );
        if (!cancelled) {
          setContactProfile(response.data?.item || null);
        }
      } catch {
        if (!cancelled) {
          setContactProfile({
            phone: selectedPhone,
            name: '',
            profile_name: '',
            display_name: '',
            email: '',
            language: '',
            status: '',
            notes: '',
            assigned_to: '',
            source: 'meta',
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    void fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [selectedPhone, botBaseUrl, axiosConfig]);

  useEffect(() => {
    if (!isAuthenticated || !selectedPhone) return;

    const fetchMessages = async () => {
      try {
        if (!hasLoadedMessagesRef.current) {
          setLoadingMessages(true);
        }
        const container = messagesContainerRef.current;
        if (container) {
          scrollSnapshotRef.current = {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
          };
        }
        const res = await axios.get<MessageResponse>(
          `${botBaseUrl}/admin/chat/conversations/${selectedPhone}/messages?limit=10`,
          axiosConfig
        );
        const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
        setMessages((prev) => {
          const same =
            prev.length === nextItems.length &&
            prev.every((item, index) => {
              const next = nextItems[index];
              return (
                item.id === next?.id &&
                item.status === next?.status &&
                item.created_at === next?.created_at &&
                item.text_content === next?.text_content &&
                item.error_text === next?.error_text
              );
            });
          return same ? prev : nextItems;
        });
        hasLoadedMessagesRef.current = true;
      } catch {
        if (!hasLoadedMessagesRef.current) {
          setError('Could not load messages for selected chat.');
          setMessages([]);
        }
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [isAuthenticated, selectedPhone, botBaseUrl, axiosConfig, refreshTick]);

  const olderLoadFailedRef = useRef(false);

  const loadOlderMessages = async () => {
    if (!selectedPhone || loadingOlder || !hasMoreMessages || messages.length === 0 || olderLoadFailedRef.current) return;
    setLoadingOlder(true);
    try {
      const oldestMessage = messages[0];
      const oldestDate = oldestMessage?.created_at;
      const res = await axios.get<MessageResponse>(
        `${botBaseUrl}/admin/chat/conversations/${selectedPhone}/messages?limit=10&before=${encodeURIComponent(oldestDate)}`,
        axiosConfig
      );
      const olderItems = Array.isArray(res.data?.items) ? res.data.items : [];
      if (olderItems.length === 0) {
        setHasMoreMessages(false);
      } else {
        const container = messagesContainerRef.current;
        const prevHeight = container?.scrollHeight || 0;
        setMessages((prev) => [...olderItems, ...prev]);
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevHeight;
          }
        });
      }
    } catch {
      olderLoadFailedRef.current = true;
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop < 50 && hasMoreMessages && !loadingOlder) {
      loadOlderMessages();
    }
  };

  useEffect(() => {
    if (!selectedPhone || !selectedConversation || !selectedConversation.unread_count) return;

    let cancelled = false;

    const markAsRead = async () => {
      try {
        await axios.post(
          `${botBaseUrl}/admin/chat/conversations/${selectedPhone}/read`,
          {},
          axiosConfig
        );
        if (cancelled) return;
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.phone === selectedPhone
              ? { ...conversation, unread_count: 0 }
              : conversation
          )
        );
        setContactProfile((prev) =>
          prev?.phone === selectedPhone
            ? { ...prev, last_read_at: new Date().toISOString() }
            : prev
        );
      } catch {
        // no-op
      }
    };

    void markAsRead();
    return () => {
      cancelled = true;
    };
  }, [selectedPhone, selectedConversation?.unread_count, botBaseUrl, axiosConfig]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (phoneChangedRef.current) {
      phoneChangedRef.current = false;
      scrollSnapshotRef.current = null;
      container.scrollTop = container.scrollHeight;
      return;
    }

    const snapshot = scrollSnapshotRef.current;
    if (!snapshot) {
      container.scrollTop = container.scrollHeight;
      return;
    }

    const distanceFromBottom =
      snapshot.scrollHeight - (snapshot.scrollTop + snapshot.clientHeight);
    const wasNearBottom = distanceFromBottom <= 40;

    if (wasNearBottom) {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTop = snapshot.scrollTop;
    }

    scrollSnapshotRef.current = null;
  }, [messages]);

  useEffect(() => {
    phoneChangedRef.current = true;
    olderLoadFailedRef.current = false;
    setMediaUrls((prev) => {
      Object.values(prev).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch { }
      });
      return {};
    });
    setMediaFailures({});
    setHasMoreMessages(true);
    hasLoadedMessagesRef.current = false;
  }, [selectedPhone]);

  const mediaUrlsRef = useRef(mediaUrls);
  mediaUrlsRef.current = mediaUrls;

  useEffect(() => {
    if (!selectedPhone || messages.length === 0) return;

    let cancelled = false;

    const resolveMedia = async () => {
      const currentUrls = mediaUrlsRef.current;
      const targets = messages
        .map((message) => ({ message, media: extractMessageMedia(message) }))
        .filter((item) => item.media && !currentUrls[item.message.id] && !mediaFailures[item.message.id]);

      if (targets.length === 0) return;

      await Promise.all(
        targets.map(async (item) => {
          const media = item.media as MediaInfo;
          try {
            if (media.directUrl) {
              if (cancelled) return;
              setMediaUrls((prev) => ({ ...prev, [item.message.id]: media.directUrl as string }));
              return;
            }
            if (!media.mediaId) {
              if (!cancelled) {
                setMediaFailures((prev) => ({ ...prev, [item.message.id]: true }));
              }
              return;
            }
            const response = await axios.get(
              `${botBaseUrl}/admin/chat/media/${media.mediaId}`,
              {
                ...axiosConfig,
                responseType: 'blob',
              }
            );
            if (cancelled) return;
            const objectUrl = URL.createObjectURL(response.data);
            setMediaUrls((prev) => {
              const oldUrl = prev[item.message.id];
              if (oldUrl) {
                try {
                  URL.revokeObjectURL(oldUrl);
                } catch { }
              }
              return { ...prev, [item.message.id]: objectUrl };
            });
          } catch {
            if (!cancelled) {
              setMediaFailures((prev) => ({ ...prev, [item.message.id]: true }));
            }
          }
        })
      );
    };

    resolveMedia();

    return () => {
      cancelled = true;
    };
  }, [messages, selectedPhone, botBaseUrl, axiosConfig, mediaFailures]);

  useEffect(() => {
    const id = setInterval(() => setRefreshTick((x) => x + 1), 120000);
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
    if (!isAuthenticated) return;

    const fetchTemplateCatalog = async () => {
      try {
        const res = await axios.get<TemplateListResponse>(
          `${botBaseUrl}/admin/chat/templates`,
          {
            ...axiosConfig,
            params: { limit: 300 },
          }
        );
        setTemplates(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch {
        // Keep chat UI usable even if template catalog fetch fails.
      }
    };

    fetchTemplateCatalog();
  }, [isAuthenticated, botBaseUrl, axiosConfig]);

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

  const uniqueConversations = useMemo(() => {
    const byPhone = new Map<string, Conversation>();
    for (const conversation of conversations) {
      const existing = byPhone.get(conversation.phone);
      if (!existing) {
        byPhone.set(conversation.phone, conversation);
        continue;
      }
      const existingTime = new Date(existing.last_message_at).getTime() || 0;
      const nextTime = new Date(conversation.last_message_at).getTime() || 0;
      if (nextTime >= existingTime) {
        byPhone.set(conversation.phone, conversation);
      }
    }
    return [...byPhone.values()];
  }, [conversations]);

  const filterCountsSafe = useMemo(() => {
    let unread = 0;
    let delivered = 0;
    let failed = 0;
    for (const conv of uniqueConversations) {
      if (isUnreadConversation(conv)) unread++;
      if (isDeliveredConversation(conv)) delivered++;
      if (isFailedConversation(conv)) failed++;
    }
    return { all: uniqueConversations.length, unread, delivered, failed };
  }, [uniqueConversations]);

  const filteredConversations = useMemo(() => {
    const key = search.trim().toLowerCase();

    return uniqueConversations.filter((conversation) => {
      if (!matchesFilter(conversation, chatFilter)) return false;
      if (!key) return true;

      const conversationName = getConversationName(conversation, contactDirectory).toLowerCase();
      return (
        conversation.phone.toLowerCase().includes(key) ||
        conversationName.includes(key) ||
        (conversation.last_text || '').toLowerCase().includes(key)
      );
    });
  }, [uniqueConversations, search, chatFilter, contactDirectory]);

  const groupedMessages = useMemo(() => {
    const groups: Array<{ label: string; items: ChatMessage[] }> = [];

    for (const message of messages) {
      const label = formatDayLabel(message.created_at);
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.label !== label) {
        groups.push({ label, items: [message] });
      } else {
        lastGroup.items.push(message);
      }
    }

    return groups;
  }, [messages]);

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

  const handleSendMedia = async (file: File) => {
    if (!selectedPhone || sendingMedia) return;

    try {
      setSendingMedia(true);
      setError('');
      const formData = new FormData();
      formData.append('phone', selectedPhone);
      formData.append('caption', draftMessage.trim());
      formData.append('file', file);

      await axios.post(`${botBaseUrl}/admin/chat/send-media`, formData, {
        headers: {
          ...(axiosConfig.headers || {}),
        },
      });

      setDraftMessage('');
      setRefreshTick((x) => x + 1);
    } catch {
      setError('Failed to send media file.');
    } finally {
      setSendingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const openFilePicker = () => {
    setShowActionMenu(false);
    fileInputRef.current?.click();
  };

  const handleDeleteConversation = async (phone: string) => {
    if (!phone || deletingConversation) return;
    try {
      setDeletingConversation(true);
      setError('');
      setShowActionMenu(false);
      await axios.delete(`${botBaseUrl}/admin/chat/conversations/${phone}`, axiosConfig);

      setConversations((prev) =>
        prev.filter((conversation) => conversation.phone !== phone)
      );
      setContactDirectory((prev) => {
        if (!prev[phone]) return prev;
        const next = { ...prev };
        delete next[phone];
        return next;
      });
      setMessages([]);
      setMediaUrls({});
      setMediaFailures({});

      const remainingConversations = uniqueConversations.filter((conversation) => conversation.phone !== phone);
      setSelectedPhone(remainingConversations[0]?.phone || '');
      setDeleteModal(null);
      setRefreshTick((x) => x + 1);
    } catch {
      setError('Failed to delete conversation.');
    } finally {
      setDeletingConversation(false);
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (deletingMessageId) return;

    try {
      setDeletingMessageId(message.id);
      setError('');
      await axios.delete(`${botBaseUrl}/admin/chat/messages/${message.id}`, axiosConfig);

      setMessages((prev) => prev.filter((item) => item.id !== message.id));
      setMediaUrls((prev) => {
        if (!prev[message.id]) return prev;
        const next = { ...prev };
        delete next[message.id];
        return next;
      });
      setMediaFailures((prev) => {
        if (!prev[message.id]) return prev;
        const next = { ...prev };
        delete next[message.id];
        return next;
      });
      setDeleteModal(null);
      setRefreshTick((x) => x + 1);
    } catch {
      setError('Failed to delete message.');
    } finally {
      setDeletingMessageId('');
    }
  };

  const openDeleteConversationModal = () => {
    if (!selectedConversation) return;
    setDeleteModal({
      type: 'conversation',
      phone: selectedConversation.phone,
      label: `${getDisplayName(selectedConversation)} (${formatPhone(selectedConversation.phone)})`,
    });
  };

  const openDeleteMessageModal = (message: ChatMessage) => {
    setDeleteModal({ type: 'message', message });
  };

  const confirmDeleteModal = async () => {
    if (!deleteModal) return;
    if (deleteModal.type === 'conversation') {
      await handleDeleteConversation(deleteModal.phone);
      return;
    }
    await handleDeleteMessage(deleteModal.message);
  };

  const openProfileModal = () => {
    if (!selectedPhone) return;
    setProfileForm({
      name: contactProfile?.name || '',
      profile_name: contactProfile?.profile_name || '',
      display_name: contactProfile?.display_name || '',
      email: contactProfile?.email || '',
      language: contactProfile?.language || '',
      status: contactProfile?.status || '',
      notes: contactProfile?.notes || '',
      assigned_to: contactProfile?.assigned_to || '',
    });
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    if (!selectedPhone) return;
    try {
      setSavingProfile(true);
      setError('');
      const response = await axios.put<{ ok: boolean; item: ContactProfile }>(
        `${botBaseUrl}/admin/chat/contacts/${selectedPhone}`,
        {
          name: profileForm.name.trim() || null,
          profile_name: profileForm.profile_name.trim() || null,
          display_name: profileForm.display_name.trim() || null,
          email: profileForm.email.trim() || null,
          language: profileForm.language.trim() || null,
          status: profileForm.status.trim() || null,
          notes: profileForm.notes.trim() || null,
          assigned_to: profileForm.assigned_to.trim() || null,
        },
        axiosConfig
      );
      const updated = response.data?.item || null;
      setContactProfile(updated);
      setContactDirectory((prev) => ({
        ...prev,
        [selectedPhone]: {
          name:
            updated?.display_name ||
            updated?.name ||
            updated?.profile_name ||
            prev[selectedPhone]?.name ||
            formatPhone(selectedPhone),
        },
      }));
      setShowProfileModal(false);
      setRefreshTick((x) => x + 1);
    } catch {
      setError('Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
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

  const handleCreateContactAndSend = async () => {
    const phone = newContactPhone.replace(/\D/g, '');
    const name = newContactName.trim();
    const firstMessage = newContactMessage.trim();

    if (!phone) {
      setError('Enter a valid contact number.');
      return;
    }

    try {
      setSavingContact(true);
      setError('');

      setContactDirectory((prev) => ({
        ...prev,
        [phone]: {
          name: name || prev[phone]?.name || formatPhone(phone),
        },
      }));

      if (firstMessage) {
        await axios.post(
          `${botBaseUrl}/admin/chat/send`,
          {
            phone,
            text: firstMessage,
          },
          axiosConfig
        );
      }

      setSelectedPhone(phone);
      setDraftMessage('');
      setNewContactName('');
      setNewContactPhone('');
      setNewContactMessage('Namaste! MandiPlus se aapka swagat hai. Hum aapki kaise madad kar sakte hain?');
      setShowNewContactModal(false);
      setRefreshTick((x) => x + 1);
    } catch {
      setError('Could not create the contact and send the message.');
    } finally {
      setSavingContact(false);
    }
  };

  const handleCallButtonClick = () => {
    if (!selectedPhone) return;
    window.dispatchEvent(new CustomEvent('wa-initiate-call', { detail: { phone: selectedPhone } }));
  };

  const filterButtons: Array<{
    key: ChatFilter;
    label: string;
    count: number;
    tone: string;
    activeTone: string;
  }> = [
      {
        key: 'all',
        label: 'All chats',
        count: filterCountsSafe.all,
        tone: 'text-slate-600',
        activeTone: 'bg-slate-900 text-white',
      },
      {
        key: 'unread',
        label: 'Unread',
        count: filterCountsSafe.unread,
        tone: 'text-emerald-700',
        activeTone: 'bg-emerald-600 text-white',
      },
      {
        key: 'delivered',
        label: 'Delivered',
        count: filterCountsSafe.delivered,
        tone: 'text-sky-700',
        activeTone: 'bg-sky-600 text-white',
      },
      {
        key: 'failed',
        label: 'Failed',
        count: filterCountsSafe.failed,
        tone: 'text-rose-700',
        activeTone: 'bg-rose-600 text-white',
      },
    ];

  return (
    <div className={standalone ? `${isDark ? 'h-dvh bg-[#0b141a] p-0 lg:p-3 text-slate-100' : 'h-dvh bg-[#edf1f5] p-0 lg:p-3'}` : 'h-dvh lg:h-[calc(100vh-7.5rem)] py-0 lg:py-5'}>

      {error ? (
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div
        className={`flex h-full gap-0 lg:gap-3 ${standalone ? 'lg:grid lg:grid-cols-[210px_360px_minmax(0,1fr)_300px]' : 'lg:rounded-[28px] lg:border lg:border-slate-200 lg:p-3 lg:shadow-sm lg:grid lg:grid-cols-[380px_1fr]'} ${currentTheme.shell}`}
      >
        {standalone ? (
          <aside className={`hidden lg:flex h-full flex-col rounded-[24px] border shadow-sm ${isDark ? 'border-[#25323a] bg-[#111b21] text-slate-100' : 'border-slate-200 bg-white'}`}>
            <div className={`px-4 py-5 ${isDark ? 'border-b border-[#25323a]' : 'border-b border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366]">
                  <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <p className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>MandiPlus</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>WhatsApp Business</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 px-3 py-4">
              {filterButtons.map((filter) => {
                const active = chatFilter === filter.key;
                return (
                  <button
                    key={`rail-${filter.key}`}
                    type="button"
                    onClick={() => setChatFilter(filter.key)}
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${active ? 'bg-emerald-600 text-white' : isDark ? 'text-slate-200 hover:bg-[#1f2c33]' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    <span>{filter.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/15 text-white' : isDark ? 'bg-[#1f2c33] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={`mx-3 pt-4 ${isDark ? 'border-t border-[#25323a]' : 'border-t border-slate-200'}`}>
              <p className={`px-2 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Themes</p>
              <div className="mt-2 space-y-1">
                {themeOptions.map((theme) => {
                  const active = theme.key === chatTheme;
                  return (
                    <button
                      key={`rail-theme-${theme.key}`}
                      type="button"
                      onClick={() => setChatTheme(theme.key)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${active ? isDark ? 'bg-[#1f2c33] text-white' : 'bg-slate-100 text-slate-900' : isDark ? 'text-slate-300 hover:bg-[#1a262d]' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-white shadow-sm"
                        style={{ backgroundColor: theme.key === 'dark' ? '#0b141a' : '#25d366' }}
                      />
                      <span>{theme.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto" />
          </aside>
        ) : null}
        <aside className={`${selectedPhone ? 'hidden lg:flex' : 'flex'} h-full w-full lg:w-auto flex-col overflow-hidden lg:rounded-[24px] lg:border ${standalone ? (isDark ? 'lg:border-[#25323a] bg-[#111b21] lg:shadow-sm' : 'lg:border-slate-200 bg-white lg:shadow-sm') : `lg:border-slate-200 ${currentTheme.panel}`}`}>
          {/* ── Mobile header (standalone only, visible on small screens) ── */}
          {standalone && (
            <div className={`flex lg:hidden items-center gap-3 px-4 py-3 ${isDark ? 'border-b border-[#25323a] bg-[#111b21]' : 'border-b border-slate-200 bg-white'}`} style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>MandiPlus</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewContactModal(true)}
                className={`flex h-9 w-9 items-center justify-center rounded-full ${isDark ? 'text-slate-300 hover:bg-[#1f2c33]' : 'text-slate-600 hover:bg-slate-100'}`}
                aria-label="New chat"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Main tab switcher ── */}
          <div className={`flex border-b ${isDark && standalone ? 'border-[#25323a]' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setMainTab('chats')}
              className={`flex-1 py-3 text-sm font-medium transition ${mainTab === 'chats'
                ? (isDark && standalone ? 'border-b-2 border-emerald-500 text-emerald-400' : 'border-b-2 border-emerald-600 text-emerald-700')
                : (isDark && standalone ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}
            >
              Chats
            </button>
            <button
              type="button"
              onClick={() => setMainTab('calls')}
              className={`relative flex-1 py-3 text-sm font-medium transition ${mainTab === 'calls'
                ? (isDark && standalone ? 'border-b-2 border-emerald-500 text-emerald-400' : 'border-b-2 border-emerald-600 text-emerald-700')
                : (isDark && standalone ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}
            >
              Calls
            </button>
          </div>

          <div className={`px-3 lg:px-4 py-3 lg:py-4 ${isDark && standalone ? 'border-b border-[#25323a]' : 'border-b border-slate-200'}`}>
            {mainTab === 'chats' ? (
              <>
                <div className="mb-2 lg:mb-3 hidden lg:flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-lg font-semibold ${isDark && standalone ? 'text-slate-100' : 'text-slate-900'}`}>Chats</p>
                    <p className={`text-xs ${isDark && standalone ? 'text-slate-400' : 'text-slate-500'}`}>Search by number, name, or preview</p>
                  </div>
                  {standalone ? (
                    <button
                      type="button"
                      onClick={() => setShowNewContactModal(true)}
                      className={`rounded-xl px-3 py-2 text-xs font-medium transition ${isDark ? 'border border-[#31424c] bg-[#1a262d] text-slate-200 hover:bg-[#22323b]' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      New contact
                    </button>
                  ) : (
                    <div className="h-8 w-8" />
                  )}
                </div>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className={`w-full rounded-full lg:rounded-2xl border px-4 py-2.5 lg:py-3 text-sm outline-none transition focus:border-emerald-500 ${isDark && standalone ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500 focus:bg-[#1f2c33]' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                />

                <div className={`mt-2 mt-3 flex flex-wrap gap-1.5 gap-2 ${standalone ? 'lg:hidden' : ''}`}>
                  {filterButtons.map((filter) => {
                    const active = chatFilter === filter.key;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setChatFilter(filter.key)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${active
                          ? `${filter.activeTone} border-transparent shadow-sm`
                          : standalone && isDark
                            ? `border-[#31424c] bg-[#1a262d] ${filter.tone === 'text-slate-600' ? 'text-slate-300' : filter.tone}`
                            : `border-slate-200 bg-white hover:bg-slate-50 ${filter.tone}`
                          }`}
                      >
                        <span>{filter.label}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : standalone && isDark ? 'bg-[#233138] text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
                          {filter.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Calls header */
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-lg font-semibold ${isDark && standalone ? 'text-slate-100' : 'text-slate-900'}`}>Calls</p>
                  <p className={`text-xs ${isDark && standalone ? 'text-slate-400' : 'text-slate-500'}`}>Recent call history</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRefreshTick((x) => x + 1)}
                  className={`rounded-xl px-3 py-2 text-xs font-medium transition ${isDark && standalone ? 'border border-[#31424c] bg-[#1a262d] text-slate-200 hover:bg-[#22323b]' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Refresh
                </button>
              </div>
            )}
          </div>

          <div className={`flex-1 overflow-y-auto ${standalone ? (isDark ? 'bg-[#111b21]' : 'bg-white') : 'bg-[#fcfdfd]'}`}>
            {mainTab === 'calls' ? (
              /* ── Call history list ── */
              loadingCalls ? (
                <p className={`p-4 text-sm ${isDark && standalone ? 'text-slate-400' : 'text-slate-500'}`}>Loading calls...</p>
              ) : callHistory.length === 0 ? (
                <p className={`p-4 text-sm ${isDark && standalone ? 'text-slate-400' : 'text-slate-400'}`}>No calls yet.</p>
              ) : (
                <div className={`divide-y ${isDark && standalone ? 'divide-[#1a262d]' : 'divide-slate-100'}`}>
                  {callHistory.map((call) => {
                    const isMissed = call.status === 'missed';
                    const isInbound = call.direction === 'inbound';
                    const phone = isInbound ? call.from : call.to;
                    const contactName = contactDirectory[phone]?.name || null;
                    const initials = contactName
                      ? contactName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
                      : phone.slice(-2).toUpperCase();
                    const timeLabel = new Date(call.started_at * 1000).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    });
                    const durationLabel = call.duration > 0
                      ? call.duration >= 60
                        ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
                        : `${call.duration}s`
                      : null;
                    return (
                      <button
                        key={call.call_id}
                        type="button"
                        onClick={() => setSelectedPhone(phone)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${isDark && standalone
                          ? 'bg-[#111b21] hover:bg-[#162229]'
                          : 'bg-white hover:bg-slate-50'
                          }`}
                      >
                        {/* Avatar */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isMissed ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${isMissed ? (isDark && standalone ? 'text-rose-400' : 'text-rose-600') : (isDark && standalone ? 'text-slate-100' : 'text-slate-800')}`}>
                            {contactName || formatPhone(phone)}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1">
                            {/* Direction arrow */}
                            <svg className={`h-3.5 w-3.5 ${isMissed ? 'text-rose-400' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              {isInbound
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15M4.5 4.5v10m0-10h10" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15M19.5 19.5V9.5m0 10h-10" />
                              }
                            </svg>
                            <span className={`text-xs ${isMissed ? (isDark && standalone ? 'text-rose-400' : 'text-rose-500') : (isDark && standalone ? 'text-slate-400' : 'text-slate-500')}`}>
                              {isMissed ? 'Missed call' : `${isInbound ? 'Incoming' : 'Outgoing'}${durationLabel ? ` · ${durationLabel}` : ''}`}
                            </span>
                          </div>
                        </div>
                        <span className={`shrink-0 text-[11px] ${isDark && standalone ? 'text-slate-500' : 'text-slate-400'}`}>{timeLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )
            ) : loadingConversations ? (
              <p className={`p-4 text-sm ${standalone && isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading conversations...</p>
            ) : filteredConversations.length === 0 ? (
              <p className={`p-4 text-sm ${standalone && isDark ? 'text-slate-400' : 'text-slate-500'}`}>No conversations found.</p>
            ) : (
              filteredConversations.map((conv) => {
                const active = conv.phone === selectedPhone;
                const conversationName = getDisplayName(conv);
                const unread = isUnreadConversation(conv);
                const showConversationTicks = conv.last_direction === 'outbound';
                return (
                  <button
                    type="button"
                    key={conv.phone}
                    onClick={() => { mobileBackRef.current = false; setSelectedPhone(conv.phone); }}
                    className={`flex w-full items-center gap-3 border-b px-3 lg:px-4 py-3 text-left transition active:scale-[0.98] ${standalone && isDark
                      ? active
                        ? 'border-[#25323a] bg-[#1a262d]'
                        : 'border-[#1a262d] bg-[#111b21] hover:bg-[#162229]'
                      : active
                        ? 'border-slate-100 bg-emerald-50'
                        : 'border-slate-100 bg-white hover:bg-slate-50'
                      }`}
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${standalone && isDark ? 'bg-[#233138] text-slate-100' : 'bg-[#d9fdd3] text-emerald-900'}`}>
                      {getConversationName(conv, contactDirectory)
                        ? getConversationInitials({
                          ...conv,
                          name: getConversationName(conv, contactDirectory),
                          profile_name: null,
                          display_name: null,
                          contact_name: null,
                        })
                        : getConversationInitials(conv)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${standalone && isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            {conversationName}
                          </p>
                          <p className={`truncate text-xs ${standalone && isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {formatPhone(conv.phone)}
                          </p>
                        </div>
                        <p
                          className={`shrink-0 text-[11px] font-medium ${unread ? 'text-emerald-700' : standalone && isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                        >
                          {formatTime(conv.last_message_at)}
                        </p>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        {showConversationTicks ? (
                          <WhatsappTicks status={conv.last_status} className="shrink-0" />
                        ) : null}
                        <p className={`min-w-0 flex-1 truncate text-sm ${standalone && isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {previewText(conv.last_text, conv.last_message_type, undefined, templatesByName)}
                        </p>
                        {unread ? (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white">
                            {conv.unread_count}
                          </span>
                        ) : null}
                      </div>

                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className={`${selectedPhone ? 'flex' : 'hidden lg:flex'} h-full w-full lg:w-auto flex-col overflow-hidden lg:rounded-[24px] lg:border ${standalone ? (isDark ? 'lg:border-[#25323a] bg-[#111b21] lg:shadow-sm' : 'lg:border-slate-200 bg-white lg:shadow-sm') : `lg:border-slate-200 ${currentTheme.panel}`}`}>
          <div className={`flex items-center justify-between px-2 lg:px-4 py-3 ${standalone ? (isDark ? 'border-b border-[#25323a] bg-[#111b21]' : 'border-b border-slate-200 bg-white') : `border-b border-slate-200 ${currentTheme.topbar}`}`}>
            <div className="flex min-w-0 items-center gap-2 lg:gap-3">
              <button
                type="button"
                onClick={() => { mobileBackRef.current = true; setSelectedPhone(''); }}
                className={`flex lg:hidden h-10 w-10 items-center justify-center rounded-full shrink-0 ${isDark && standalone ? 'text-slate-200 hover:bg-[#1f2c33]' : 'text-slate-600 hover:bg-slate-100'}`}
                aria-label="Back to chats"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div className={`flex h-10 w-10 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${standalone && isDark ? 'bg-[#233138] text-slate-100' : 'bg-[#d9fdd3] text-emerald-900'}`}>
                {selectedConversation
                  ? getConversationInitials({
                    ...selectedConversation,
                    name: getConversationName(selectedConversation, contactDirectory),
                    profile_name: null,
                    display_name: null,
                    contact_name: null,
                  })
                  : 'WA'}
              </div>
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${isDark && standalone ? 'text-slate-100' : 'text-slate-900'}`}>
                  {selectedConversation
                    ? getDisplayName(selectedConversation)
                    : 'Select a conversation'}
                </p>
                <div className={`flex flex-wrap items-center gap-2 text-xs ${isDark && standalone ? 'text-slate-400' : 'text-slate-500'}`}>
                  {selectedConversation ? (
                    <>
                      <span>{formatPhone(selectedConversation.phone)}</span>
                      {selectedUnreadCount > 0 ? (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                            {selectedUnreadCount} unread
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="hidden lg:inline">Choose a chat from the left panel</span>
                  )}
                </div>
              </div>
            </div>
            {!standalone ? (
              <div className="relative flex items-center gap-1">
                {selectedConversation && (
                  <button
                    type="button"
                    onClick={handleCallButtonClick}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-600"
                    title="Call customer"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowHeaderMenu((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showHeaderMenu && (
                  <div className="absolute right-0 top-11 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => { setShowHeaderMenu(false); window.open('/whatsapp-chats', '_blank', 'noopener,noreferrer'); }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Open in new tab
                    </button>
                    {selectedConversation && (
                      <button
                        type="button"
                        onClick={() => { setShowHeaderMenu(false); openDeleteConversationModal(); }}
                        disabled={deletingConversation}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Delete conversation
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
            {standalone && selectedConversation ? (
              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCallButtonClick}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${isDark
                    ? 'text-slate-300 hover:bg-emerald-900/30 hover:text-emerald-400'
                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                    }`}
                  title="Call customer"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHeaderMenu((v) => !v)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${isDark
                    ? 'text-slate-300 hover:bg-[#1f2c33]'
                    : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showHeaderMenu && (
                  <div className={`absolute right-0 top-11 z-20 w-48 rounded-xl border p-1 shadow-lg ${isDark ? 'border-[#31424c] bg-[#111b21]' : 'border-slate-200 bg-white'}`}>
                    <button
                      type="button"
                      onClick={() => { setShowHeaderMenu(false); openProfileModal(); }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${isDark ? 'text-slate-200 hover:bg-[#1f2c33]' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      Contact info
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowHeaderMenu(false); openDeleteConversationModal(); }}
                      disabled={deletingConversation}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${isDark ? 'text-rose-300 hover:bg-[#2a1f22]' : 'text-rose-600 hover:bg-rose-50'} disabled:opacity-60`}
                    >
                      Delete conversation
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto px-2 lg:px-4 py-3 lg:py-4 overscroll-contain"
            style={{
              backgroundColor: currentTheme.pane,
              backgroundImage: currentTheme.wallpaper,
              backgroundRepeat: 'repeat',
            }}
          >
            {loadingOlder && (
              <div className="mb-3 flex justify-center">
                <div className="rounded-full bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow-sm">Loading older messages...</div>
              </div>
            )}
            {!selectedPhone ? (
              <p className="hidden lg:block text-sm text-slate-500">Choose a chat from the left panel.</p>
            ) : loadingMessages && messages.length === 0 ? (
              <p className="text-sm text-slate-500">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages available for this number.</p>
            ) : (
              groupedMessages.map((group) => (
                <div key={group.label}>
                  <div className="mb-4 flex justify-center">
                    <div className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                      {group.label}
                    </div>
                  </div>

                  {group.items.map((message) => {
                    const incoming = message.direction === 'inbound';
                    const system = message.direction === 'system';
                    const media = extractMessageMedia(message);
                    const mediaUrl = media ? mediaUrls[message.id] : null;
                    const location = extractMessageLocation(message);
                    const messageText = previewText(
                      message.text_content,
                      message.message_type,
                      message.payload,
                      templatesByName
                    );
                    const isVoiceCallEvent =
                      /\[(?:unsupported|error)\].*(?:131051|Message type unknown)/i.test(messageText) ||
                      message.message_type === 'call';
                    const hideMediaPlaceholder =
                      !!media && /^\[(image|video|audio|voice|document|sticker)\]/i.test(messageText.trim());
                    const hideLocationPlaceholder =
                      !!location && /^\[location\]/i.test(messageText.trim());
                    const shouldRenderText = !isVoiceCallEvent && !(hideMediaPlaceholder || hideLocationPlaceholder);
                    const bubbleClass = system
                      ? currentTheme.system
                      : incoming
                        ? currentTheme.incoming
                        : currentTheme.outgoing;

                    return (
                      <div
                        key={message.id}
                        className={`group/msg mb-1.5 flex ${incoming || system ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`relative max-w-[85%] lg:max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-sm ${system ? 'border border-amber-200' : ''
                            } ${bubbleClass}`}
                        >
                          {/* Three-dot menu on hover */}
                          {!system && (
                            <div className="absolute top-1 right-1 hidden group-hover/msg:block">
                              <button
                                type="button"
                                onClick={() => setMsgMenuId(msgMenuId === message.id ? null : message.id)}
                                className={`flex h-6 w-6 items-center justify-center rounded-full ${isDark && standalone ? 'bg-black/20 text-white/70 hover:bg-black/30' : 'bg-black/5 text-slate-500 hover:bg-black/10'}`}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                              {msgMenuId === message.id && (
                                <div className={`absolute right-0 top-7 z-30 w-36 rounded-lg border p-1 shadow-lg ${isDark && standalone ? 'border-[#31424c] bg-[#111b21]' : 'border-slate-200 bg-white'}`}>
                                  <button
                                    type="button"
                                    onClick={() => { setMsgMenuId(null); openDeleteMessageModal(message); }}
                                    className={`w-full rounded-md px-3 py-1.5 text-left text-xs ${isDark && standalone ? 'text-rose-300 hover:bg-[#2a1f22]' : 'text-rose-600 hover:bg-rose-50'}`}
                                  >
                                    Delete message
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {media ? (
                            <div className="mb-2">
                              {media.kind === 'image' || media.kind === 'sticker' ? (
                                mediaUrl ? (
                                  <div className="space-y-2">
                                    <button
                                      type="button"
                                      onClick={() => openAttachment(media, mediaUrl)}
                                      className="block"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={mediaUrl}
                                        alt={media.kind}
                                        className="max-h-80 max-w-full rounded-2xl border border-slate-200 object-contain"
                                      />
                                    </button>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openAttachment(media, mediaUrl)}
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Open
                                      </button>
                                      <a
                                        href={mediaUrl}
                                        download={media.filename || `${media.kind}-${message.id}`}
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Download
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500">Loading {media.kind}...</p>
                                )
                              ) : null}

                              {media.kind === 'video' ? (
                                mediaUrl ? (
                                  <div className="space-y-2">
                                    <video
                                      src={mediaUrl}
                                      controls
                                      className="max-h-80 max-w-full rounded-2xl border border-slate-200"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openAttachment(media, mediaUrl)}
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Open
                                      </button>
                                      <a
                                        href={mediaUrl}
                                        download={media.filename || `video-${message.id}`}
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Download
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500">Loading video...</p>
                                )
                              ) : null}

                              {media.kind === 'audio' ? (
                                mediaUrl ? (
                                  <div className="space-y-2">
                                    <audio src={mediaUrl} controls className="w-full min-w-[240px]" />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openAttachment(media, mediaUrl)}
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Open
                                      </button>
                                      <a
                                        href={mediaUrl}
                                        download={media.filename || `audio-${message.id}`}
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Download
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500">
                                    {mediaFailures[message.id]
                                      ? media.isVoice
                                        ? 'Voice note unavailable'
                                        : 'Audio unavailable'
                                      : `Fetching ${media.isVoice ? 'voice note' : 'audio'}...`}
                                  </p>
                                )
                              ) : null}

                              {media.kind === 'document' ? (
                                mediaUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => openAttachment(media, mediaUrl)}
                                    className="block w-full rounded-2xl border border-slate-200 bg-white/90 p-3 text-left"
                                  >
                                    <p className="truncate text-sm font-medium text-slate-800">
                                      {media.filename || 'document'}
                                    </p>
                                    {media.caption ? (
                                      <p className="mt-1 text-xs text-slate-500">{media.caption}</p>
                                    ) : null}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <span
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Open
                                      </span>
                                      <a
                                        href={mediaUrl}
                                        download={media.filename || `document-${message.id}`}
                                        onClick={(event) => event.stopPropagation()}
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                      >
                                        Download
                                      </a>
                                    </div>
                                  </button>
                                ) : (
                                  <p className="text-xs text-slate-500">
                                    Loading {media.filename || 'document'}...
                                  </p>
                                )
                              ) : null}
                            </div>
                          ) : null}

                          {location ? (
                            <div className="mb-2 rounded-2xl border border-slate-200 bg-white/90 p-3 text-xs">
                              <p className="font-medium text-slate-700">Location</p>
                              {location.name ? <p className="text-slate-600">{location.name}</p> : null}
                              {location.address ? <p className="text-slate-600">{location.address}</p> : null}
                              {location.latitude !== undefined && location.longitude !== undefined ? (
                                <a
                                  href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-700 underline"
                                >
                                  Open in Maps ({location.latitude}, {location.longitude})
                                </a>
                              ) : null}
                            </div>
                          ) : null}

                          {isVoiceCallEvent ? (
                            <div className="flex items-center gap-2 py-0.5">
                              <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                              </svg>
                              <span className="text-sm">WhatsApp Voice Call</span>
                            </div>
                          ) : shouldRenderText ? (
                            <LinkifiedText text={messageText} />
                          ) : null}

                          {/* URL buttons from template/interactive messages */}
                          {(() => {
                            const urlButtons = extractUrlButtons(message.payload);
                            if (urlButtons.length === 0) return null;
                            return (
                              <div className="mt-2 flex flex-col gap-1 border-t border-black/10 pt-2">
                                {urlButtons.map((btn, i) => (
                                  <a
                                    key={i}
                                    href={btn.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                  >
                                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                    </svg>
                                    {btn.text}
                                  </a>
                                ))}
                              </div>
                            );
                          })()}

                          <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] text-slate-500">
                            <span>{formatTime(message.created_at)}</span>
                            {message.direction === 'outbound' ? (
                              <WhatsappTicks status={message.status} />
                            ) : null}
                          </div>
                          {message.error_text ? (
                            <p className="mt-2 rounded-2xl bg-rose-100 px-2 py-1.5 text-xs text-rose-700">
                              {message.error_text}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className={`border-t px-2 py-2 lg:p-3 ${standalone ? (isDark ? 'border-[#25323a] bg-[#111b21]' : 'border-slate-200 bg-white') : `border-slate-200 ${currentTheme.topbar}`}`} style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleSendMedia(file);
                  }
                }}
              />
              <input
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder={selectedPhone ? 'Type a message' : 'Select a conversation first'}
                disabled={!selectedPhone || sendingMessage || sendingMedia}
                className={`min-w-0 flex-1 rounded-full border px-3 lg:px-4 py-2.5 lg:py-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100 ${standalone && isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500 focus:bg-[#22323b]' : 'border-slate-200 bg-white'}`}
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu((v) => !v)}
                  disabled={!selectedPhone}
                  className={`flex h-10 w-10 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-full border text-lg leading-none disabled:cursor-not-allowed disabled:bg-slate-100 ${standalone && isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-200 hover:bg-[#22323b]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  +
                </button>
                {showActionMenu ? (
                  <div className={`absolute bottom-14 right-0 z-20 w-52 rounded-2xl border p-1.5 shadow-lg ${standalone && isDark ? 'border-[#31424c] bg-[#111b21]' : 'border-slate-200 bg-white'}`}>
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm ${standalone && isDark ? 'text-slate-200 hover:bg-[#1f2c33]' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      Send File
                    </button>
                    <button
                      type="button"
                      onClick={openTemplateModal}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm ${standalone && isDark ? 'text-slate-200 hover:bg-[#1f2c33]' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      Template Message
                    </button>
                    <button
                      type="button"
                      onClick={openDeleteConversationModal}
                      disabled={!selectedConversation || deletingConversation}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm ${standalone && isDark
                        ? 'text-rose-300 hover:bg-[#2a1f22]'
                        : 'text-rose-700 hover:bg-rose-50'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {deletingConversation ? 'Deleting Conversation...' : 'Delete Conversation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowActionMenu(false)}
                      className="w-full cursor-not-allowed rounded-xl px-3 py-2 text-left text-sm text-slate-400"
                    >
                      Send Flow (Coming Soon)
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={!selectedPhone || !draftMessage.trim() || sendingMessage || sendingMedia}
                className="flex h-10 w-10 lg:h-11 lg:w-auto shrink-0 items-center justify-center rounded-full bg-emerald-600 lg:px-5 lg:py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                <svg className="h-5 w-5 lg:hidden" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                <span className="hidden lg:inline">{sendingMessage || sendingMedia ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
          </form>
        </section>

        {standalone ? (
          <aside className={`hidden lg:flex h-full flex-col overflow-hidden rounded-[24px] border shadow-sm ${isDark ? 'border-[#25323a] bg-[#111b21] text-slate-100' : 'border-slate-200 bg-white'}`}>
            <div className={`px-5 py-5 text-center ${isDark ? 'border-b border-[#25323a]' : 'border-b border-slate-200'}`}>
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 text-2xl font-semibold text-slate-600">
                {selectedConversation
                  ? getConversationInitials({
                    ...selectedConversation,
                    name: getConversationName(selectedConversation, contactDirectory),
                    profile_name: null,
                    display_name: null,
                    contact_name: null,
                  })
                  : 'WA'}
              </div>
              <p className={`mt-4 text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {selectedConversation
                  ? getDisplayName(selectedConversation)
                  : 'No contact selected'}
              </p>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {selectedConversation ? formatPhone(selectedConversation.phone) : 'Pick a chat to inspect details'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selectedConversation ? (
                <>
                  {/* Contact details */}
                  <div className={`space-y-3 rounded-2xl p-4 ${isDark ? 'bg-[#1a262d]' : 'bg-slate-50'}`}>
                    {contactProfile?.status && (
                      <div className="flex items-center justify-between text-sm">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Status</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>{contactProfile.status}</span>
                      </div>
                    )}
                    {contactProfile?.assigned_to && (
                      <div className="flex items-center justify-between text-sm">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Assigned to</span>
                        <span className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{contactProfile.assigned_to}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Last active</span>
                      <span className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{formatTime(selectedConversation.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Messages</span>
                      <span className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{selectedConversation.total_messages}</span>
                    </div>
                    {contactProfile?.notes && (
                      <div className="pt-2 border-t border-slate-200/50">
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Notes</p>
                        <p className={`mt-1 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{contactProfile.notes}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Select a conversation to view contact details and recent context.</p>
              )}
            </div>
          </aside>
        ) : null}
      </div>

      {deleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className={`w-full max-w-md rounded-[28px] border p-6 shadow-2xl ${isDark ? 'border-[#31424c] bg-[#111b21] text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
            <p className="text-lg font-semibold">
              {deleteModal.type === 'conversation' ? 'Delete conversation?' : 'Delete message?'}
            </p>
            <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {deleteModal.type === 'conversation'
                ? `This will remove the full stored chat history for ${deleteModal.label} from the admin panel.`
                : `This will remove this ${messageMetaLabel(deleteModal.message).toLowerCase()} message from the admin chat log.`}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${isDark
                  ? 'border border-[#31424c] bg-[#1a262d] text-slate-200 hover:bg-[#22323b]'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteModal()}
                disabled={
                  deleteModal.type === 'conversation'
                    ? deletingConversation
                    : deletingMessageId === deleteModal.message.id
                }
                className={`rounded-full px-4 py-2 text-sm font-semibold ${deletePillClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {deleteModal.type === 'conversation'
                  ? deletingConversation
                    ? 'Deleting...'
                    : 'Delete conversation'
                  : deletingMessageId === deleteModal.message.id
                    ? 'Deleting...'
                    : 'Delete message'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showProfileModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className={`w-full max-w-2xl rounded-[28px] border p-6 shadow-2xl ${isDark ? 'border-[#31424c] bg-[#111b21] text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Edit profile</p>
                <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Manage this contact profile from the chat workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isDark ? 'bg-[#1a262d] text-slate-300 hover:bg-[#22323b]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input
                value={profileForm.display_name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, display_name: e.target.value }))}
                placeholder="Display name"
                className={`rounded-2xl border px-4 py-3 text-sm outline-none ${isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white'}`}
              />
              <input
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Name"
                className={`rounded-2xl border px-4 py-3 text-sm outline-none ${isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white'}`}
              />
              <input
                value={profileForm.profile_name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, profile_name: e.target.value }))}
                placeholder="Meta profile name"
                className={`rounded-2xl border px-4 py-3 text-sm outline-none ${isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white'}`}
              />
              <input
                value={profileForm.assigned_to}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
                placeholder="Assigned to"
                className={`rounded-2xl border px-4 py-3 text-sm outline-none ${isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white'}`}
              />
              <input
                value={profileForm.email}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className={`rounded-2xl border px-4 py-3 text-sm outline-none ${isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white'}`}
              />
              <input
                value={profileForm.language}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, language: e.target.value }))}
                placeholder="Language"
                className={`rounded-2xl border px-4 py-3 text-sm outline-none ${isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white'}`}
              />
              <input
                value={profileForm.status}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="Status"
                className={`rounded-2xl border px-4 py-3 text-sm outline-none md:col-span-2 ${isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white'}`}
              />
              <textarea
                value={profileForm.notes}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes"
                rows={4}
                className={`rounded-2xl border px-4 py-3 text-sm outline-none md:col-span-2 ${isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white'}`}
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${isDark
                  ? 'border border-[#31424c] bg-[#1a262d] text-slate-200 hover:bg-[#22323b]'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNewContactModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">New Contact</p>
              <p className="text-sm text-slate-500">Save a name and send the first message from here.</p>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Contact name</label>
                <input
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Farmer name"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone number</label>
                <input
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="919876543210"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">First message</label>
                <textarea
                  value={newContactMessage}
                  onChange={(e) => setNewContactMessage(e.target.value)}
                  placeholder="Type the first message to send"
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowNewContactModal(false);
                  setNewContactName('');
                  setNewContactPhone('');
                  setNewContactMessage('Namaste! MandiPlus se aapka swagat hai. Hum aapki kaise madad kar sakte hain?');
                }}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateContactAndSend}
                disabled={savingContact}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {savingContact ? 'Saving...' : 'Save and send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showTemplateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">Template Message</p>
              <p className="text-xs text-slate-500">Send to {formatPhone(selectedPhone)}</p>
            </div>

            <div className="grid max-h-[72vh] grid-cols-1 gap-0 overflow-hidden md:grid-cols-[320px_1fr]">
              <div className="border-r border-slate-200 bg-slate-50">
                <div className="p-3">
                  <input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="max-h-[60vh] overflow-y-auto border-t border-slate-100 bg-white">
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
                          className={`w-full border-b border-slate-100 px-3 py-3 text-left ${active ? 'bg-emerald-50' : 'hover:bg-slate-50'
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

              <div className="max-h-[72vh] overflow-y-auto p-5">
                {!selectedTemplate ? (
                  <p className="text-sm text-slate-500">Select a template from the left list.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedTemplate.name}</p>
                      <p className="mt-2 whitespace-pre-wrap rounded-3xl border border-slate-200 bg-[#d9fdd3] p-4 text-sm text-slate-700">
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
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">This template has no body variables.</p>
                    )}
                  </div>
                )}

                {templateError ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {templateError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateError('');
                }}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTemplate}
                disabled={!selectedTemplate || sendingTemplate}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
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

export default function AdminChatLogsPage() {
  return <AdminChatLogsView />;
}

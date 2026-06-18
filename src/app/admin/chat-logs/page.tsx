'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
type MainTab = 'chats' | 'invoice-details';

type InvoiceCollection = {
  id: string;
  phone: string;
  display_name: string | null;
  status: 'pending' | 'done';
  window_started_at: string | null;
  window_closed_at: string;
  message_count: number;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  ai_draft?: {
    commodity?: string | null;
    quantity?: number | null;
    unit?: string | null;
    rate?: number | null;
    total_amount?: number | null;
    buyer_name?: string | null;
    seller_name?: string | null;
    invoice_date?: string | null;
    vehicle_number?: string | null;
    notes?: string | null;
    confidence?: 'high' | 'medium' | 'low';
    missing_fields?: string[];
    ai_note?: string;
    error?: string;
  } | null;
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
  if (text && text.trim()) return text.trim();
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

export function AdminChatLogsView({ standalone = false }: { standalone?: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [contactDirectory, setContactDirectory] = useState<Record<string, { name: string }>>({});

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
  const [chatTheme, setChatTheme] = useState<ChatTheme>('light');
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
  const [newContactMessage, setNewContactMessage] = useState('');
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
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Invoice Details tab
  const [mainTab, setMainTab] = useState<MainTab>('chats');
  const [invoiceCollections, setInvoiceCollections] = useState<InvoiceCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasLoadedConversationsRef = useRef(false);
  const hasLoadedMessagesRef = useRef(false);
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
      const storedContacts = localStorage.getItem('chatContactDirectory');
      if (storedContacts) {
        setContactDirectory(JSON.parse(storedContacts));
      }
      const storedTheme = localStorage.getItem('chatLogsTheme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setChatTheme(storedTheme);
      }
    } catch { }
  }, []);

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

  // Fetch invoice collections whenever the tab is active or refreshTick changes
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingCollections(true);
    const url = collectionFilter === 'all'
      ? `${botBaseUrl}/admin/invoice-collections?limit=200`
      : `${botBaseUrl}/admin/invoice-collections?status=${collectionFilter}&limit=200`;
    axios.get(url, axiosConfig)
      .then((res) => setInvoiceCollections(res.data?.items ?? []))
      .catch((err) => console.error('invoice-collections fetch error:', err))
      .finally(() => setLoadingCollections(false));
  }, [isAuthenticated, botBaseUrl, axiosConfig, collectionFilter, refreshTick]);

  const markCollectionDone = async (id: string) => {
    if (completingId) return;
    setCompletingId(id);
    try {
      await axios.post(
        `${botBaseUrl}/admin/invoice-collections/${id}/complete`,
        null,
        axiosConfig,
      );
      setInvoiceCollections((prev) =>
        prev.map((c) => c.id === id ? { ...c, status: 'done' } : c)
      );
    } catch { } finally {
      setCompletingId(null);
    }
  };


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
        } else if (!selectedPhone && items.length > 0) {
          setSelectedPhone(items[0].phone);
        } else if (
          selectedPhone &&
          !items.find((item) => item.phone === selectedPhone) &&
          items.length > 0
        ) {
          setSelectedPhone(items[0].phone);
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
          `${botBaseUrl}/admin/chat/conversations/${selectedPhone}/messages?limit=700`,
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
    const snapshot = scrollSnapshotRef.current;
    const container = messagesContainerRef.current;
    if (!snapshot || !container) return;

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
    setMediaUrls((prev) => {
      Object.values(prev).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch { }
      });
      return {};
    });
    setMediaFailures({});
    hasLoadedMessagesRef.current = false;
  }, [selectedPhone]);

  useEffect(() => {
    if (!selectedPhone || messages.length === 0) return;

    let cancelled = false;

    const resolveMedia = async () => {
      const targets = messages
        .map((message) => ({ message, media: extractMessageMedia(message) }))
        .filter((item) => item.media && !mediaUrls[item.message.id]);

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
  }, [messages, selectedPhone, botBaseUrl, axiosConfig, mediaUrls]);

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

  const filterCountsSafe = useMemo(
    () => ({
      all: uniqueConversations.length,
      unread: uniqueConversations.filter(isUnreadConversation).length,
      delivered: uniqueConversations.filter(isDeliveredConversation).length,
      failed: uniqueConversations.filter(isFailedConversation).length,
    }),
    [uniqueConversations]
  );

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
      setNewContactMessage('');
      setShowNewContactModal(false);
      setRefreshTick((x) => x + 1);
    } catch {
      setError('Could not create the contact and send the message.');
    } finally {
      setSavingContact(false);
    }
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
    <div className={standalone ? `${isDark ? 'h-screen bg-[#0b141a] p-3 text-slate-100' : 'h-screen bg-[#edf1f5] p-3'}` : 'h-[calc(100vh-7.5rem)] py-5'}>

      {error ? (
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div
        className={`grid h-full grid-cols-1 gap-3 ${standalone ? 'xl:grid-cols-[210px_360px_minmax(0,1fr)_300px]' : 'rounded-[28px] border border-slate-200 p-3 shadow-sm lg:grid-cols-[380px_1fr]'} ${currentTheme.shell}`}
      >
        {standalone ? (
          <aside className={`flex h-full flex-col rounded-[24px] border shadow-sm ${isDark ? 'border-[#25323a] bg-[#111b21] text-slate-100' : 'border-slate-200 bg-white'}`}>
            <div className={`px-4 py-5 ${isDark ? 'border-b border-[#25323a]' : 'border-b border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                  WA
                </div>
                <div>
                  <p className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Inbox</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>WhatsApp workspace</p>
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
        <aside className={`flex h-full flex-col overflow-hidden rounded-[24px] border ${standalone ? (isDark ? 'border-[#25323a] bg-[#111b21] shadow-sm' : 'border-slate-200 bg-white shadow-sm') : `border-slate-200 ${currentTheme.panel}`}`}>
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
              onClick={() => setMainTab('invoice-details')}
              className={`relative flex-1 py-3 text-sm font-medium transition ${mainTab === 'invoice-details'
                ? (isDark && standalone ? 'border-b-2 border-emerald-500 text-emerald-400' : 'border-b-2 border-emerald-600 text-emerald-700')
                : (isDark && standalone ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}
            >
              Invoice Details
              {invoiceCollections.filter((c) => c.status === 'pending').length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  {invoiceCollections.filter((c) => c.status === 'pending').length}
                </span>
              )}
            </button>
          </div>

          <div className={`px-4 py-4 ${isDark && standalone ? 'border-b border-[#25323a]' : 'border-b border-slate-200'}`}>
            {mainTab === 'chats' ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
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
                  placeholder="Search name, number, or message"
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-emerald-500 ${isDark && standalone ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500 focus:bg-[#1f2c33]' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                />

                {!standalone ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filterButtons.map((filter) => {
                      const active = chatFilter === filter.key;
                      return (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={() => setChatFilter(filter.key)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${active
                            ? `${filter.activeTone} border-transparent shadow-sm`
                            : `border-slate-200 bg-white hover:bg-slate-50 ${filter.tone}`
                            }`}
                        >
                          <span>{filter.label}</span>
                          <span className={`rounded-full px-2 py-0.5 ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                            {filter.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : (
              /* Invoice Details header */
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className={`text-lg font-semibold ${isDark && standalone ? 'text-slate-100' : 'text-slate-900'}`}>Invoice Details</p>
                    <p className={`text-xs ${isDark && standalone ? 'text-slate-400' : 'text-slate-500'}`}>Collected from WhatsApp</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRefreshTick((x) => x + 1)}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition ${isDark && standalone ? 'border border-[#31424c] bg-[#1a262d] text-slate-200 hover:bg-[#22323b]' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    Refresh
                  </button>
                </div>
                <div className="flex gap-2">
                  {(['pending', 'done', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCollectionFilter(f)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${collectionFilter === f
                        ? 'border-transparent bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={`flex-1 overflow-y-auto ${standalone ? (isDark ? 'bg-[#111b21]' : 'bg-white') : 'bg-[#fcfdfd]'}`}>
            {mainTab === 'invoice-details' ? (
              /* ── Invoice Details card list ── */
              loadingCollections ? (
                <p className="p-4 text-sm text-slate-500">Loading...</p>
              ) : invoiceCollections.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">No invoice details found.</p>
              ) : (
                <div className="divide-y">
                  {invoiceCollections.map((col) => {
                    const isSelected = selectedCollectionId === col.id;
                    const isDone = col.status === 'done';
                    return (
                      <div
                        key={col.id}
                        className={`cursor-pointer px-4 py-3 transition hover:bg-emerald-50 ${isSelected ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''
                          }`}
                        onClick={() => {
                          setSelectedCollectionId(col.id);
                          setSelectedPhone(col.phone);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {col.display_name || col.phone}
                            </p>
                            <p className="text-xs text-slate-500">{col.phone}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {new Date(col.window_closed_at).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                              })}
                              {' · '}{col.message_count} msg{col.message_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDone
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                              }`}>
                              {isDone ? '✓ Done' : 'Pending'}
                            </span>
                            {!isDone && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); markCollectionDone(col.id); }}
                                disabled={completingId === col.id}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {completingId === col.id ? '...' : 'Mark Done'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* AI Draft panel — shown when card is selected */}
                        {isSelected && col.ai_draft && !col.ai_draft.error && (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-700">🤖 AI Invoice Draft</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.ai_draft.confidence === 'high' ? 'bg-emerald-100 text-emerald-700'
                                : col.ai_draft.confidence === 'medium' ? 'bg-amber-100 text-amber-700'
                                  : 'bg-rose-100 text-rose-700'
                                }`}>
                                {col.ai_draft.confidence ?? 'low'} confidence
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                              {col.ai_draft.commodity && <><span className="text-slate-400">Commodity</span><span className="font-medium text-slate-700">{col.ai_draft.commodity}</span></>}
                              {col.ai_draft.quantity != null && <><span className="text-slate-400">Qty</span><span className="font-medium text-slate-700">{col.ai_draft.quantity} {col.ai_draft.unit || ''}</span></>}
                              {col.ai_draft.rate != null && <><span className="text-slate-400">Rate</span><span className="font-medium text-slate-700">₹{col.ai_draft.rate}</span></>}
                              {col.ai_draft.total_amount != null && <><span className="text-slate-400">Total</span><span className="font-medium text-emerald-700">₹{col.ai_draft.total_amount.toLocaleString('en-IN')}</span></>}
                              {col.ai_draft.buyer_name && <><span className="text-slate-400">Buyer</span><span className="font-medium text-slate-700">{col.ai_draft.buyer_name}</span></>}
                              {col.ai_draft.seller_name && <><span className="text-slate-400">Seller</span><span className="font-medium text-slate-700">{col.ai_draft.seller_name}</span></>}
                              {col.ai_draft.vehicle_number && <><span className="text-slate-400">Vehicle</span><span className="font-medium text-slate-700">{col.ai_draft.vehicle_number}</span></>}
                              {col.ai_draft.invoice_date && <><span className="text-slate-400">Date</span><span className="font-medium text-slate-700">{col.ai_draft.invoice_date}</span></>}
                            </div>
                            {col.ai_draft.notes && (
                              <p className="mt-2 text-[11px] text-slate-500 italic">{col.ai_draft.notes}</p>
                            )}
                            {/* Missing fields warning */}
                            {col.ai_draft.missing_fields && col.ai_draft.missing_fields.length > 0 && (
                              <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5">
                                <p className="text-[11px] font-semibold text-amber-700">⚠ Missing: {col.ai_draft.missing_fields.join(', ')}</p>
                              </div>
                            )}
                            {/* AI note for exec */}
                            {col.ai_draft.ai_note && (
                              <p className="mt-1.5 text-[11px] text-slate-500 italic">💬 {col.ai_draft.ai_note}</p>
                            )}
                          </div>
                        )}
                        {isSelected && col.ai_draft?.error && (
                          <p className="mt-2 text-[11px] text-rose-400 italic">AI extraction unavailable</p>
                        )}
                        {isSelected && !col.ai_draft && (
                          <p className="mt-2 text-[11px] text-slate-400 italic">AI draft processing...</p>
                        )}
                      </div>
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
                    onClick={() => setSelectedPhone(conv.phone)}
                    className={`flex w-full items-start gap-3 border-b px-4 py-3 text-left transition ${standalone && isDark
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

        <section className={`flex h-full flex-col overflow-hidden rounded-[24px] border ${standalone ? (isDark ? 'border-[#25323a] bg-[#111b21] shadow-sm' : 'border-slate-200 bg-white shadow-sm') : `border-slate-200 ${currentTheme.panel}`}`}>
          <div className={`flex items-center justify-between px-4 py-3 ${standalone ? (isDark ? 'border-b border-[#25323a] bg-[#111b21]' : 'border-b border-slate-200 bg-white') : `border-b border-slate-200 ${currentTheme.topbar}`}`}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d9fdd3] text-sm font-semibold text-emerald-900">
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
                    <span>Choose a chat from the left panel</span>
                  )}
                </div>
              </div>
            </div>
            {!standalone ? (
              <div className="relative hidden items-center sm:flex">
                <button
                  type="button"
                  onClick={() => setShowActionMenu((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showActionMenu && (
                  <div className="absolute right-0 top-11 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => { setShowActionMenu(false); window.open('/whatsapp-chats', '_blank', 'noopener,noreferrer'); }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Open in new tab
                    </button>
                    {selectedConversation && (
                      <button
                        type="button"
                        onClick={() => { setShowActionMenu(false); openDeleteConversationModal(); }}
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu((v) => !v)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${isDark
                    ? 'text-slate-300 hover:bg-[#1f2c33]'
                    : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showActionMenu && (
                  <div className={`absolute right-0 top-11 z-20 w-48 rounded-xl border p-1 shadow-lg ${isDark ? 'border-[#31424c] bg-[#111b21]' : 'border-slate-200 bg-white'}`}>
                    <button
                      type="button"
                      onClick={() => { setShowActionMenu(false); openProfileModal(); }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${isDark ? 'text-slate-200 hover:bg-[#1f2c33]' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      Edit profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowActionMenu(false); openDeleteConversationModal(); }}
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
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{
              backgroundColor: currentTheme.pane,
              backgroundImage: currentTheme.wallpaper,
              backgroundRepeat: 'repeat',
            }}
          >
            {!selectedPhone ? (
              <p className="text-sm text-slate-500">Choose a chat from the left panel.</p>
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
                    const hideMediaPlaceholder =
                      !!media && /^\[(image|video|audio|voice|document|sticker)\]/i.test(messageText.trim());
                    const hideLocationPlaceholder =
                      !!location && /^\[location\]/i.test(messageText.trim());
                    const shouldRenderText = !(hideMediaPlaceholder || hideLocationPlaceholder);
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
                          className={`relative max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm ${system ? 'border border-amber-200' : ''
                            } ${bubbleClass}`}
                        >
                          {/* Three-dot menu on hover */}
                          {!system && (
                            <button
                              type="button"
                              onClick={() => openDeleteMessageModal(message)}
                              className={`absolute top-1 ${incoming ? 'right-1' : 'left-1'} hidden h-6 w-6 items-center justify-center rounded-full group-hover/msg:flex ${isDark && standalone ? 'bg-black/20 text-white/70 hover:bg-black/30' : 'bg-black/5 text-slate-500 hover:bg-black/10'}`}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
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

                          {shouldRenderText ? (
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{messageText}</p>
                          ) : null}

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

          <form onSubmit={handleSendMessage} className={`border-t p-3 ${standalone ? (isDark ? 'border-[#25323a] bg-[#111b21]' : 'border-slate-200 bg-white') : `border-slate-200 ${currentTheme.topbar}`}`}>
            <div className="flex items-center gap-2">
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
                className={`w-full rounded-full border px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100 ${standalone && isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-100 placeholder:text-slate-500 focus:bg-[#22323b]' : 'border-slate-200 bg-white'}`}
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu((v) => !v)}
                  disabled={!selectedPhone}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg leading-none disabled:cursor-not-allowed disabled:bg-slate-100 ${standalone && isDark ? 'border-[#31424c] bg-[#1a262d] text-slate-200 hover:bg-[#22323b]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
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
                className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {sendingMessage || sendingMedia ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </section>

        {standalone ? (
          <aside className={`flex h-full flex-col overflow-hidden rounded-[24px] border shadow-sm ${isDark ? 'border-[#25323a] bg-[#111b21] text-slate-100' : 'border-slate-200 bg-white'}`}>
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
                  <div className={`space-y-3 rounded-2xl p-4 ${isDark ? 'bg-[#1a262d]' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Direction</span>
                      <span className={`font-medium capitalize ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{selectedConversation.last_direction || 'unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Last activity</span>
                      <span className={`text-right font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{formatTime(selectedConversation.last_message_at)}</span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="mt-5 space-y-2">
                    <button
                      type="button"
                      onClick={openProfileModal}
                      className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition ${isDark ? 'bg-[#1a262d] text-slate-200 hover:bg-[#22323b]' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                    >
                      Edit contact info
                    </button>
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
                  setNewContactMessage('');
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

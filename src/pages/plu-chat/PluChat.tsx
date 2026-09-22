import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Map, PanelLeftOpen, Plus, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./pluChat.css";
import PluMapPanel, { type MapData } from "./PluMapPanel";
import PluChatSidebar, { type SessionSummary } from "./PluChatSidebar";
import PluRawContextPanel from "./PluRawContextPanel";
import {
  PLU_COMMUNE_CONFIG,
  pluApiRoot,
  type PluCommuneSlug,
} from "./communeConfig";
import {
  fetchPluSessionMap,
  mapDataHasParcelleGeometry,
  pluAuthHeaders,
} from "./pluAuth";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");
const RESPONSE_MODE_KEY = "plu-chat-response-mode";
const CONTEXT_TOKEN_LIMIT = 250_000;
type ResponseMode = "concis" | "approfondi";

function readStoredResponseMode(): ResponseMode {
  try {
    const raw = localStorage.getItem(RESPONSE_MODE_KEY);
    if (raw === "approfondi" || raw === "concis") return raw;
  } catch {
    /* ignore */
  }
  return "concis";
}

type PluChatProps = {
  commune?: PluCommuneSlug;
};

async function fetchSessionMap(
  apiRoot: string,
  sessionId: string,
): Promise<MapData | null> {
  try {
    const res = await fetchPluSessionMap(apiRoot, sessionId);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Carte PLU:", res.status, detail);
      return null;
    }
    const data = (await res.json()) as MapData;
    return mapDataHasParcelleGeometry(data.parcelle) ? data : null;
  } catch (err) {
    console.error("Carte PLU:", err);
    return null;
  }
}

function mapDataFromTurn(data: { map_data?: MapData | null }): MapData | null {
  const md = data.map_data;
  return md && mapDataHasParcelleGeometry(md.parcelle) ? md : null;
}

function turnRequestedMap(data: { show_map?: boolean }): boolean {
  return Boolean(data.show_map);
}

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  meta?: string;
  mapData?: MapData | null;
  /** Id message Supabase (réponses assistant) pour GET raw-context */
  dbMessageId?: string;
  hasRawContext?: boolean;
  confirmParcels?: ParcelResolveResponse;
};

type ToolCall = { name: string; result_summary: string };

type TurnUsage = {
  prompt_tokens?: number | null;
  candidate_tokens?: number | null;
  total_tokens?: number | null;
  tokens_source?: string | null;
  cost_usd?: number | null;
  input_usd?: number | null;
  output_usd?: number | null;
  context_tokens?: number | null;
};

type ApiTurn = {
  answer: string;
  tool_calls?: ToolCall[];
  latency_ms?: number;
  zones_summary?: string;
  map_data?: MapData | null;
  show_map?: boolean;
  model_message_id?: string;
  usage?: TurnUsage | null;
  context_tokens?: number | null;
  context_limit?: number | null;
  context_limit_reached?: boolean;
};

type SessionState = {
  session_id: string;
  zones: { code_zone?: string; pct_parcelle_couverte?: number }[];
  messages: {
    id: string;
    role: string;
    content: string;
    has_raw_context?: boolean;
    usage?: TurnUsage | null;
  }[];
  context_tokens?: number | null;
  context_limit?: number | null;
  context_limit_reached?: boolean;
};

type ParcellePair = { section: string; numero: string };

type ParcelRef = {
  section?: string;
  numero?: string;
  idu?: string;
  parcelles?: ParcellePair[];
  idus?: string[];
};

type ParcelResolveItem = {
  official: string;
  found: boolean;
  section?: string | null;
  numero?: string | null;
  idu?: string | null;
  contenance?: number | null;
};

type ParcelResolveResponse = {
  commune: string;
  insee?: string | null;
  items: ParcelResolveItem[];
  all_found: boolean;
  found_count: number;
  missing_count: number;
};

type PendingParcelConfirm = {
  text: string;
  ref: ParcelRef;
  resolve: ParcelResolveResponse;
};

function parcelRefDetected(ref: ParcelRef): boolean {
  return Boolean(
    ref.section ||
      ref.idu ||
      (ref.parcelles && ref.parcelles.length > 0) ||
      (ref.idus && ref.idus.length > 0),
  );
}

const CONFIRM_YES_RE = /^(oui|ok|okay|oké|continues?|confirme[rz]?|vas[- ]y|c['’]est bon|go)\b/i;

function confirmAssistantText(resolved: ParcelResolveResponse): string {
  const found = resolved.items.filter((i) => i.found);
  const n = found.length;
  const commune = resolved.commune;
  if (n === 0) {
    return `Je n'ai trouvé aucune de ces parcelles à ${commune}. Tu peux retaper les références (ex. AL 74 AL 416).`;
  }
  if (n === 1) {
    return `J'ai reconnu la parcelle **${found[0].official}** à ${commune}. C'est bien celle-là ?`;
  }
  return `J'ai reconnu **${n} parcelles** pour l'unité foncière à ${commune}. Ce sont bien celles-là ?`;
}

function refsFromResolve(resolved: ParcelResolveResponse): ParcelRef {
  const found = resolved.items.filter(
    (item): item is ParcelResolveItem & { section: string; numero: string } =>
      Boolean(item.found && item.section && item.numero),
  );
  if (found.length >= 2) {
    return { parcelles: found.map((item) => ({ section: item.section, numero: item.numero })) };
  }
  if (found.length === 1) {
    return {
      section: found[0].section,
      numero: found[0].numero,
      ...(found[0].idu ? { idu: found[0].idu } : {}),
    };
  }
  return {};
}

function ParcelPill({
  item,
  onRemove,
  disabled,
}: {
  item: ParcelResolveItem;
  onRemove?: (official: string) => void;
  disabled?: boolean;
}) {
  return (
    <span
      className={`plu-chat__pill ${item.found ? "plu-chat__pill--ok" : "plu-chat__pill--missing"}${
        onRemove ? " plu-chat__pill--removable" : ""
      }`}
    >
      {item.official}
      {onRemove && (
        <button
          type="button"
          className="plu-chat__pill-remove"
          disabled={disabled}
          aria-label={`Retirer ${item.official}`}
          title="Retirer cette parcelle"
          onClick={() => onRemove(item.official)}
        >
          <X size={8} strokeWidth={2.8} aria-hidden />
        </button>
      )}
    </span>
  );
}

function ConfirmParcelsBlock({
  resolve,
  onContinue,
  onAddParcel,
  onRemoveParcel,
  disabled,
}: {
  resolve: ParcelResolveResponse;
  onContinue: () => void;
  onAddParcel?: (raw: string) => void;
  onRemoveParcel?: (official: string) => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const found = resolve.items.filter((i) => i.found);
  const missing = resolve.items.filter((i) => !i.found);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const submitAdd = () => {
    const raw = draft.trim();
    if (!raw || disabled) return;
    onAddParcel?.(raw);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="plu-chat__confirm">
      <div className="plu-chat__pills" aria-label="Parcelles reconnues">
        {found.map((item) => (
          <ParcelPill
            key={item.official}
            item={item}
            disabled={disabled}
            onRemove={onRemoveParcel}
          />
        ))}
        {missing.map((item) => (
          <ParcelPill
            key={item.official}
            item={item}
            disabled={disabled}
            onRemove={onRemoveParcel}
          />
        ))}
        {onAddParcel && adding && (
          <form
            className="plu-chat__pill-add-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitAdd();
            }}
          >
            <input
              ref={addInputRef}
              className="plu-chat__pill-add-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="AL 419"
              aria-label="Référence à ajouter"
              disabled={disabled}
            />
          </form>
        )}
        {onAddParcel && !adding && (
          <button
            type="button"
            className="plu-chat__pill plu-chat__pill--add"
            disabled={disabled}
            aria-label="Ajouter une parcelle"
            title="Ajouter une parcelle"
            onClick={() => setAdding(true)}
          >
            <Plus size={14} strokeWidth={2.6} aria-hidden />
          </button>
        )}
      </div>
      {missing.length > 0 && (
        <p className="plu-chat__confirm-hint">
          {missing.map((i) => i.official).join(", ")} introuvable{missing.length > 1 ? "s" : ""} à{" "}
          {resolve.commune}
          {resolve.insee ? ` (INSEE ${resolve.insee})` : ""}.
        </p>
      )}
      <div className="plu-chat__pills plu-chat__pills--actions">
        <button
          type="button"
          className="plu-chat__pill plu-chat__pill--action"
          disabled={disabled || found.length === 0}
          onClick={onContinue}
        >
          Oui, continuer
        </button>
      </div>
      <p className="plu-chat__confirm-hint">
        Sinon, retape les parcelles ci-dessous — ex. <code>AL 74 AL 416 AL 417 AL 418</code>
      </p>
    </div>
  );
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const FUNCTION_SECTIONS = new Set([
  "DE", "DU", "LE", "LA", "ET", "OU", "EN", "AU", "CE", "IL", "ON",
  "SE", "SA", "SI", "NE", "NI", "OR", "UN", "ME", "TE", "TU", "CA",
]);
const AMBIGUOUS_SECTIONS = new Set(["AN", "AI", "AS"]);
const ARTICLE_LETTERS = new Set(["L", "R", "D"]);
const CADASTRAL_CUE = /\b(?:parcelles?|cadastr\w*|feuilles?|idus?|sections?|unit[eé]s?\s+fonci[eè]res?)\b/i;
const UNIT_AFTER = /^\s*(?:%|€|euros?|m(?:²|2)?\b|cm\b|mm\b|ha\b|ans\b|mètres?\b|metres?\b)/i;

/** Aligné sur le parseur backend (AL 74, AL74, A7, AN 0076). Le serveur re-parse. */
function extractSectionNumeroPairs(text: string): ParcellePair[] {
  const seen = new Set<string>();
  const pairs: ParcellePair[] = [];
  const context = CADASTRAL_CUE.test(text);
  const re = /(?<![0-9A-Za-z])([A-Za-z]{1,2})(?:[\s._/-]*n[°o]\s*|[\s._/-]*num[ée]ro\s+|[\s._/-]*)(\d{1,4})(?!\d)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const rawSection = m[1];
    const numero = m[2];
    const section = rawSection.toUpperCase();
    const after = text.slice(m.index + m[0].length);
    const before = text.slice(0, m.index);
    if (UNIT_AFTER.test(after) || /^-\d/.test(after)) continue;
    if (/\b(?:zones?|secteurs?|types?)\s+$/i.test(before)) continue;
    if (/\b(?:articles?|art\.?)\s+$/i.test(before)) continue;
    if (section === "A" && /\by\s+$/i.test(before)) continue;
    if (/^(?:19|20)\d{2}$/.test(numero) && (FUNCTION_SECTIONS.has(section) || AMBIGUOUS_SECTIONS.has(section))) {
      continue;
    }
    if (ARTICLE_LETTERS.has(section) && numero.length >= 3 && !context) continue;
    if ((section === "ET" || section === "OU") && !/\b(?:parcelles?|feuilles?|sections?|idus?)\s+$/i.test(before)) {
      continue;
    }
    if (FUNCTION_SECTIONS.has(section) && !context) continue;
    const between = text.slice(m.index + rawSection.length, m.index + m[0].length - numero.length);
    const glued = between === "";
    if (
      AMBIGUOUS_SECTIONS.has(section) &&
      !context &&
      !numero.startsWith("0") &&
      !glued &&
      numero.length < 3
    ) {
      continue;
    }
    if (section.length === 1 && rawSection === "a" && !glued && !context) continue;
    const addPair = (sec: string, num: string) => {
      const key = `${sec}:${num.padStart(4, "0")}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ section: sec, numero: num });
    };
    addPair(section, numero);

    let cursor = m.index + m[0].length;
    let lastSection = section;
    while (true) {
      const rest = text.slice(cursor);
      const fm = rest.match(
        /^(?:\s*(?:,|;|\/|et|ou)\s+|\s+)(?:([A-Za-z]{1,2})(?:[\s._/-]*n[°o]\s*|[\s._/-]*num[ée]ro\s+|[\s._/-]*))?(\d{1,4})(?!\d)/i,
      );
      if (!fm) break;
      const followSec = (fm[1] || lastSection).toUpperCase();
      const followNum = fm[2];
      const fEnd = cursor + fm[0].length;
      const fAfter = text.slice(fEnd);
      if (UNIT_AFTER.test(fAfter) || /^-\d/.test(fAfter)) break;
      if (FUNCTION_SECTIONS.has(followSec) && !context) break;
      addPair(followSec, followNum);
      lastSection = followSec;
      cursor = fEnd;
    }
  }
  return pairs;
}

/** Corps POST /session : question + refs parcellaires optionnelles (préchargement zonage). */
function buildSessionCreateBody(
  question: string,
  ref: ParcelRef,
  extras?: { refsLocked?: boolean; responseMode?: ResponseMode },
): Record<string, unknown> {
  const body: Record<string, unknown> = { question };
  if (ref.section) body.section = ref.section;
  if (ref.numero) body.numero = ref.numero;
  if (ref.idu) body.idu = ref.idu;
  if (ref.parcelles?.length) body.parcelles = ref.parcelles;
  if (ref.idus?.length) body.idus = ref.idus;
  if (extras?.refsLocked) body.refs_locked = true;
  if (extras?.responseMode) body.response_mode = extras.responseMode;
  return body;
}

function parseParcelRef(text: string): ParcelRef {
  // IDU cadastral générique France: 5 chars INSEE + 5 chars section paddée + 4 chars numéro.
  const iduMatches = [...text.matchAll(/\b([0-9A-Z]{10}\d{4})\b/gi)];
  if (iduMatches.length > 1) {
    return { idus: iduMatches.map((m) => m[1].toUpperCase()) };
  }
  if (iduMatches.length === 1) {
    return { idu: iduMatches[0][1].toUpperCase() };
  }

  const pairs = extractSectionNumeroPairs(text);
  if (pairs.length >= 2) {
    return { parcelles: pairs };
  }
  if (pairs.length === 1) {
    return { section: pairs[0].section, numero: pairs[0].numero };
  }

  const sectionNum = text.match(
    /section\s+([A-Za-z]{1,2})\s+(?:n[°o]?\s*|num[ée]ro\s+)?(\d{1,4})\b/i,
  );
  if (sectionNum) {
    return { section: sectionNum[1].toUpperCase(), numero: sectionNum[2] };
  }

  return {};
}

function zonesSummaryFromZones(zones: SessionState["zones"]) {
  return (
    zones
      .map((z) => `${z.code_zone ?? "?"} (${z.pct_parcelle_couverte ?? "?"}%)`)
      .join(", ") || null
  );
}

function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function contextLimitReachedFromPayload(data: {
  context_limit_reached?: boolean;
  context_tokens?: number | null;
  context_limit?: number | null;
  usage?: TurnUsage | null;
}): boolean {
  if (data.context_limit_reached) return true;
  const limit = data.context_limit ?? CONTEXT_TOKEN_LIMIT;
  const n =
    data.context_tokens ??
    data.usage?.context_tokens ??
    data.usage?.prompt_tokens ??
    0;
  return n >= limit;
}

function formatUsageMeta(usage?: TurnUsage | null): string | null {
  if (!usage) return null;
  const parts: string[] = [];
  if (usage.total_tokens != null && usage.total_tokens > 0) {
    const src = usage.tokens_source === "estimate" ? " est." : "";
    parts.push(`${usage.total_tokens.toLocaleString("fr-FR")} tok${src}`);
  }
  if (usage.cost_usd != null && usage.cost_usd > 0) {
    parts.push(formatUsd(usage.cost_usd));
  }
  return parts.length ? parts.join(" · ") : null;
}

function formatMeta(data: ApiTurn, zonesSummary?: string) {
  const tools = data.tool_calls?.map((t) => t.name);
  return [
    zonesSummary,
    data.latency_ms != null ? `${(data.latency_ms / 1000).toFixed(1)} s` : null,
    formatUsageMeta(data.usage),
    tools?.length ? `🔧 ${tools.join(" · ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function mapSessionMessages(raw: SessionState["messages"]): ChatMessage[] {
  return raw.map((m) => ({
    id: uid(),
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    dbMessageId: m.role === "model" || m.role === "assistant" ? m.id : undefined,
    hasRawContext: Boolean(m.has_raw_context),
    meta: formatUsageMeta(m.usage) || undefined,
  }));
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="plu-chat__markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children, ...props }) => (
            <div className="plu-chat__markdown-table-wrap">
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function PluChat({ commune = "argeles" }: PluChatProps) {
  const communeConfig = PLU_COMMUNE_CONFIG[commune];
  const apiRoot = pluApiRoot(API_BASE, commune);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [zonesSummary, setZonesSummary] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [activeMapData, setActiveMapData] = useState<MapData | null>(null);
  const [rawContextTarget, setRawContextTarget] = useState<{
    messageId: string;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingParcelConfirm | null>(null);
  const [contextLimitReached, setContextLimitReached] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>(readStoredResponseMode);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasStarted = messages.length > 0;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    try {
      localStorage.setItem(RESPONSE_MODE_KEY, responseMode);
    } catch {
      /* ignore */
    }
  }, [responseMode]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const auth = await pluAuthHeaders();
      const res = await fetch(`${apiRoot}/sessions?limit=50`, { headers: auth });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("Historique PLU:", res.status, detail);
        return;
      }
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err) {
      console.error("Historique PLU:", err);
    } finally {
      setLoadingSessions(false);
    }
  }, [apiRoot]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
    setSessionId(null);
    setZonesSummary(null);
    setMapVisible(false);
    setActiveMapData(null);
    setRawContextTarget(null);
    setPendingConfirm(null);
    setContextLimitReached(false);
  };

  const deleteSession = async (id: string) => {
    if (deletingSessionId) return;
    setDeletingSessionId(id);
    try {
      const auth = await pluAuthHeaders();
      const res = await fetch(`${apiRoot}/session/${id}`, {
        method: "DELETE",
        headers: auth,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Erreur HTTP ${res.status}`);
      }
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
      if (sessionId === id) {
        resetChat();
      }
    } catch (err) {
      console.error("Suppression session:", err);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const loadSession = async (id: string) => {
    if (isLoading || loadingSessionId) return;
    setLoadingSessionId(id);
    try {
      const res = await fetch(`${apiRoot}/session/${id}`, {
        headers: await pluAuthHeaders(),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Erreur HTTP ${res.status}`);
      }
      const data: SessionState = await res.json();
      setSessionId(data.session_id);
      setZonesSummary(zonesSummaryFromZones(data.zones));
      setMessages(mapSessionMessages(data.messages));
      setContextLimitReached(contextLimitReachedFromPayload(data));
      setInput("");

      const mapPayload = await fetchSessionMap(apiRoot, data.session_id);
      if (mapPayload) {
        setActiveMapData(mapPayload);
        setMapVisible(true);
      } else {
        setActiveMapData(null);
        setMapVisible(false);
      }
    } catch (err) {
      setMessages([
        {
          id: uid(),
          role: "assistant",
          content:
            err instanceof Error
              ? `Impossible de charger la conversation : ${err.message}`
              : "Impossible de charger la conversation.",
        },
      ]);
    } finally {
      setLoadingSessionId(null);
    }
  };

  const revealMapPanel = useCallback(
    async (
      data: ApiTurn,
      sid: string | null,
      options?: { fetchIfParcelleSession?: boolean },
    ) => {
      const inline = mapDataFromTurn(data);
      if (inline) {
        setActiveMapData(inline);
        setMapVisible(true);
        return;
      }
      if (!sid) return;

      const shouldFetch =
        turnRequestedMap(data) || Boolean(options?.fetchIfParcelleSession);
      if (!shouldFetch) return;

      const fetched = await fetchSessionMap(apiRoot, sid);
      if (fetched) {
        setActiveMapData(fetched);
        setMapVisible(true);
      }
    },
    [apiRoot],
  );

  const appendAssistant = useCallback(
    async (
      data: ApiTurn,
      summary?: string | null,
      sid?: string | null,
      revealOptions?: { fetchIfParcelleSession?: boolean },
    ) => {
      const mapData = mapDataFromTurn(data);

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: data.answer || "Aucune réponse reçue.",
          meta: formatMeta(data, summary ?? zonesSummary ?? undefined) || undefined,
          mapData: mapData ?? data.map_data ?? null,
          dbMessageId: data.model_message_id,
          hasRawContext: Boolean(data.model_message_id),
        },
      ]);

      setContextLimitReached(contextLimitReachedFromPayload(data));
      await revealMapPanel(data, sid ?? sessionId, revealOptions);
    },
    [sessionId, zonesSummary, revealMapPanel],
  );

  const sendMessage = async (text: string, options?: { confirmed?: boolean }) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const auth = await pluAuthHeaders();

      if (!sessionId && pendingConfirm && !options?.confirmed && CONFIRM_YES_RE.test(trimmed)) {
        setMessages((prev) => [...prev, { id: uid(), role: "user", content: trimmed }]);
        setInput("");
        await sendMessage(pendingConfirm.text, { confirmed: true });
        return;
      }

      if (!sessionId && !options?.confirmed) {
        const ref = parseParcelRef(trimmed);
        if (parcelRefDetected(ref)) {
          setMessages((prev) => [...prev, { id: uid(), role: "user", content: trimmed }]);
          setInput("");
          setIsLoading(true);
          const preview = await fetch(`${apiRoot}/parcelles/resolve`, {
            method: "POST",
            headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify(buildSessionCreateBody(trimmed, ref)),
          });
          if (!preview.ok) {
            const detail = await preview.text();
            throw new Error(detail || `Erreur HTTP ${preview.status}`);
          }
          const resolved = (await preview.json()) as ParcelResolveResponse;
          const original = pendingConfirm?.text ?? trimmed;
          setPendingConfirm({ text: original, ref: refsFromResolve(resolved), resolve: resolved });
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: confirmAssistantText(resolved),
              confirmParcels: resolved,
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      const lockedRef = options?.confirmed
        ? pendingConfirm?.ref ?? parseParcelRef(trimmed)
        : parseParcelRef(trimmed);
      const question = options?.confirmed ? pendingConfirm?.text ?? trimmed : trimmed;
      setPendingConfirm(null);
      if (!options?.confirmed) {
        setMessages((prev) => [...prev, { id: uid(), role: "user", content: trimmed }]);
      }
      setInput("");
      setIsLoading(true);

      if (!sessionId) {
        const ref = lockedRef;
        const response = await fetch(`${apiRoot}/session`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify(
            buildSessionCreateBody(question, ref, {
              refsLocked: Boolean(options?.confirmed),
              responseMode,
            }),
          ),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Erreur HTTP ${response.status}`);
        }

        const data = await response.json();
        setSessionId(data.session_id);
        const summary = data.zones_summary as string | undefined;
        setZonesSummary(summary || null);

        if (data.answer) {
          await appendAssistant(data, summary, data.session_id, {
            fetchIfParcelleSession: (data.zones?.length ?? 0) > 0,
          });
        } else if ((data.zones?.length ?? 0) > 0) {
          await revealMapPanel(data, data.session_id, { fetchIfParcelleSession: true });
        }
        void fetchSessions();
      } else {
        const response = await fetch(`${apiRoot}/chat/${sessionId}`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, response_mode: responseMode }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Erreur HTTP ${response.status}`);
        }

        const data: ApiTurn = await response.json();
        await appendAssistant(data, undefined, sessionId);
        void fetchSessions();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            err instanceof Error
              ? `Une erreur est survenue : ${err.message}`
              : "Une erreur est survenue lors de l'appel à l'agent PLU.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyConfirmResolve = (resolved: ParcelResolveResponse) => {
    setPendingConfirm((prev) =>
      prev
        ? { text: prev.text, ref: refsFromResolve(resolved), resolve: resolved }
        : prev,
    );
    setMessages((prev) => {
      const lastIdx = prev.reduce((acc, msg, i) => (msg.confirmParcels ? i : acc), -1);
      if (lastIdx < 0) return prev;
      const next = [...prev];
      next[lastIdx] = {
        ...next[lastIdx],
        content: confirmAssistantText(resolved),
        confirmParcels: resolved,
      };
      return next;
    });
  };

  const resolveOfficials = async (officials: string[], errorLabel: string) => {
    if (!pendingConfirm || isLoading || sessionId) return;
    if (officials.length === 0) {
      applyConfirmResolve({
        commune: pendingConfirm.resolve.commune,
        insee: pendingConfirm.resolve.insee,
        items: [],
        all_found: false,
        found_count: 0,
        missing_count: 0,
      });
      return;
    }
    const combined = officials.join(" ");
    const ref = parseParcelRef(combined);
    if (!parcelRefDetected(ref)) return;

    try {
      setIsLoading(true);
      const auth = await pluAuthHeaders();
      const preview = await fetch(`${apiRoot}/parcelles/resolve`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(buildSessionCreateBody(combined, ref)),
      });
      if (!preview.ok) {
        const detail = await preview.text();
        throw new Error(detail || `Erreur HTTP ${preview.status}`);
      }
      applyConfirmResolve((await preview.json()) as ParcelResolveResponse);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            err instanceof Error
              ? `${errorLabel} : ${err.message}`
              : errorLabel,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const addParcelToConfirm = async (raw: string) => {
    if (!pendingConfirm) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const lastSection = [...pendingConfirm.resolve.items]
      .reverse()
      .find((item) => item.section)?.section;
    const extra = /^\d{1,4}$/.test(trimmed) && lastSection ? `${lastSection} ${trimmed}` : trimmed;
    await resolveOfficials(
      [...pendingConfirm.resolve.items.map((item) => item.official), extra],
      "Impossible d'ajouter cette parcelle",
    );
  };

  const removeParcelFromConfirm = async (official: string) => {
    if (!pendingConfirm) return;
    await resolveOfficials(
      pendingConfirm.resolve.items
        .filter((item) => item.official !== official)
        .map((item) => item.official),
      "Impossible de retirer cette parcelle",
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const composer = (
    <form
      onSubmit={handleSubmit}
      className={`plu-chat__composer-wrap${hasStarted ? "" : " plu-chat__composer-wrap--centered"}`}
    >
      <div className="plu-chat__composer">
        <textarea
          ref={textareaRef}
          className="plu-chat__input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingConfirm
              ? "Oui, ou retape les parcelles (ex. AL 74 AL 416 AL 417 AL 418)…"
              : "Posez votre question ici en indiquant les parcelles concernées, ex. BD 634, BD 518…"
          }
          rows={1}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="plu-chat__send"
          disabled={isLoading || !input.trim()}
          aria-label="Envoyer"
        >
          <ArrowUp size={18} strokeWidth={2.25} />
        </button>
      </div>
      <div className="plu-chat__mode" role="group" aria-label="Longueur de réponse">
        <button
          type="button"
          className={`plu-chat__mode-btn${responseMode === "concis" ? " is-active" : ""}`}
          aria-pressed={responseMode === "concis"}
          onClick={() => setResponseMode("concis")}
        >
          Concis
        </button>
        <button
          type="button"
          className={`plu-chat__mode-btn${responseMode === "approfondi" ? " is-active" : ""}`}
          aria-pressed={responseMode === "approfondi"}
          onClick={() => setResponseMode("approfondi")}
        >
          Approfondi
        </button>
      </div>
    </form>
  );

  return (
    <div
      className={`plu-chat${sidebarOpen ? " plu-chat--sidebar-open" : ""}${mapVisible ? " plu-chat--map-open" : ""}`}
    >
      <PluChatSidebar
        isOpen={sidebarOpen}
        sessions={sessions}
        loadingSessions={loadingSessions}
        loadingSessionId={loadingSessionId}
        deletingSessionId={deletingSessionId}
        activeSessionId={sessionId}
        onClose={() => setSidebarOpen(false)}
        onNewChat={resetChat}
        onSelectSession={(id) => void loadSession(id)}
        onDeleteSession={deleteSession}
      />

      <div className="plu-chat__panel">
        <header className="plu-chat__header">
          <div className="plu-chat__header-left">
            {!sidebarOpen && (
              <button
                type="button"
                className="plu-chat__icon-btn"
                aria-label="Afficher l'historique"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <div className="plu-chat__brand">
              <span className="plu-chat__brand-dot" aria-hidden />
              <div>
                <div className="plu-chat__brand-title">Agent PLU</div>
                <div className="plu-chat__brand-sub">{communeConfig.brandSub}</div>
              </div>
            </div>
            {sessionId && (
              <button
                type="button"
                className={`plu-chat__map-toggle${mapVisible ? " plu-chat__map-toggle--active" : ""}`}
                onClick={() => setMapVisible((v) => !v)}
                title={mapVisible ? "Masquer la carte" : "Afficher la carte"}
                aria-label={mapVisible ? "Masquer la carte PLU" : "Afficher la carte PLU"}
                aria-pressed={mapVisible}
              >
                <Map size={15} strokeWidth={2.25} aria-hidden />
                {mapVisible ? "Masquer la carte" : "Afficher la carte"}
              </button>
            )}
          </div>
        </header>

        <main className="plu-chat__main">
          {!hasStarted ? (
            <div className="plu-chat__empty">
              <h1 className="plu-chat__hero-title">Une question sur une parcelle ou une unité foncière ?</h1>
              {composer}
            </div>
          ) : (
            <>
              <div className="plu-chat__messages">
                <div className="plu-chat__messages-inner">
                  {messages.map((msg, idx) => {
                    const lastConfirmIdx = messages.reduce(
                      (acc, m, i) => (m.confirmParcels ? i : acc),
                      -1,
                    );
                    const isActiveConfirm =
                      Boolean(msg.confirmParcels) &&
                      pendingConfirm != null &&
                      idx === lastConfirmIdx;
                    return (
                    <div key={msg.id} className={`plu-chat__message plu-chat__message--${msg.role}`}>
                      <span className="plu-chat__message-label">
                        {msg.role === "user" ? "Vous" : "Kerelia"}
                      </span>
                      {msg.role === "user" ? (
                        <div className="plu-chat__bubble-user">{msg.content}</div>
                      ) : (
                        <>
                          <div className="plu-chat__bubble-assistant">
                            <AssistantMarkdown content={msg.content} />
                            {msg.confirmParcels && (
                              <ConfirmParcelsBlock
                                resolve={msg.confirmParcels}
                                disabled={!isActiveConfirm || isLoading}
                                onAddParcel={
                                  isActiveConfirm
                                    ? (raw) => void addParcelToConfirm(raw)
                                    : undefined
                                }
                                onRemoveParcel={
                                  isActiveConfirm
                                    ? (official) => void removeParcelFromConfirm(official)
                                    : undefined
                                }
                                onContinue={() => {
                                  setMessages((prev) => [
                                    ...prev,
                                    { id: uid(), role: "user", content: "Oui, continuer" },
                                  ]);
                                  void sendMessage(pendingConfirm?.text ?? "", { confirmed: true });
                                }}
                              />
                            )}
                          </div>
                          {msg.meta && <div className="plu-chat__meta">{msg.meta}</div>}
                          {msg.role === "assistant" && sessionId && msg.dbMessageId && (
                              <button
                                type="button"
                                className="plu-chat__ctx-btn"
                                onClick={() =>
                                  setRawContextTarget({ messageId: msg.dbMessageId! })
                                }
                              >
                                Voir contexte
                              </button>
                            )}
                        </>
                      )}
                    </div>
                    );
                  })}

                  {isLoading && (
                    <div className="plu-chat__message plu-chat__message--assistant">
                      <span className="plu-chat__message-label">Kerelia</span>
                      <div className="plu-chat__typing" aria-label="Réponse en cours">
                        <span className="plu-chat__typing-dot" />
                        <span className="plu-chat__typing-dot" />
                        <span className="plu-chat__typing-dot" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              {contextLimitReached && (
                <div className="plu-chat__limit" role="status">
                  <p>
                    Cette conversation approche la limite de contexte (250 000
                    tokens). Démarrez une nouvelle discussion pour garder des
                    réponses fiables.
                  </p>
                  <button
                    type="button"
                    className="plu-chat__limit-btn"
                    onClick={resetChat}
                  >
                    Nouvelle conversation
                  </button>
                </div>
              )}
              {composer}
            </>
          )}
        </main>
      </div>

      <PluMapPanel
        sessionId={sessionId}
        mapData={activeMapData}
        apiRoot={apiRoot}
        isVisible={mapVisible}
        onClose={() => setMapVisible(false)}
      />

      {rawContextTarget && sessionId && (
        <PluRawContextPanel
          apiRoot={apiRoot}
          sessionId={sessionId}
          messageId={rawContextTarget.messageId}
          onClose={() => setRawContextTarget(null)}
        />
      )}
    </div>
  );
}

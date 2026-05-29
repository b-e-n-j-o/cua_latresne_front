import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Map, PanelLeftOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./pluChat.css";
import PluMapPanel, { type MapData } from "./PluMapPanel";
import PluChatSidebar, { type SessionSummary } from "./PluChatSidebar";
import {
  PLU_COMMUNE_CONFIG,
  pluApiRoot,
  type PluCommuneSlug,
} from "./communeConfig";
import { MAP_BUFFER_M } from "./map/colors";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

type PluChatProps = {
  commune?: PluCommuneSlug;
};

async function fetchSessionMap(
  apiRoot: string,
  sessionId: string,
): Promise<MapData | null> {
  try {
    const res = await fetch(
      `${apiRoot}/session/${sessionId}/map?buffer_m=${MAP_BUFFER_M}`,
    );
    if (!res.ok) return null;
    const data: MapData = await res.json();
    return parcelleMapHasGeometry(data.parcelle) ? data : null;
  } catch {
    return null;
  }
}

function parcelleMapHasGeometry(
  parcelle: MapData["parcelle"] | null | undefined,
): boolean {
  if (!parcelle) return false;
  if (parcelle.type === "Feature") return Boolean(parcelle.geometry);
  if (parcelle.type === "FeatureCollection") {
    return parcelle.features.some((f) => f.geometry);
  }
  return false;
}

function mapDataFromTurn(data: { map_data?: MapData | null }): MapData | null {
  const md = data.map_data;
  return md && parcelleMapHasGeometry(md.parcelle) ? md : null;
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
};

type ToolCall = { name: string; result_summary: string };

type ApiTurn = {
  answer: string;
  tool_calls?: ToolCall[];
  latency_ms?: number;
  zones_summary?: string;
  map_data?: MapData | null;
  show_map?: boolean;
};

type SessionState = {
  session_id: string;
  zones: { code_zone?: string; pct_parcelle_couverte?: number }[];
  messages: { role: string; content: string }[];
};

type ParcellePair = { section: string; numero: string };

type ParcelRef = {
  section?: string;
  numero?: string;
  idu?: string;
  parcelles?: ParcellePair[];
  idus?: string[];
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Extrait toutes les paires section + numéro (ex. « BD 634 et BD 518 »). */
function extractSectionNumeroPairs(text: string): ParcellePair[] {
  const seen = new Set<string>();
  const pairs: ParcellePair[] = [];
  const re = /\b([A-Za-z]{1,2})\s+(\d{1,4})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const section = m[1].toUpperCase();
    const numero = m[2];
    const key = `${section}:${numero.padStart(4, "0")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ section, numero });
  }
  return pairs;
}

/** Corps POST /session : question + refs parcellaires optionnelles (préchargement zonage). */
function buildSessionCreateBody(question: string, ref: ParcelRef): Record<string, unknown> {
  const body: Record<string, unknown> = { question };
  if (ref.section) body.section = ref.section;
  if (ref.numero) body.numero = ref.numero;
  if (ref.idu) body.idu = ref.idu;
  if (ref.parcelles?.length) body.parcelles = ref.parcelles;
  if (ref.idus?.length) body.idus = ref.idus;
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

function formatMeta(data: ApiTurn, zonesSummary?: string) {
  const tools = data.tool_calls?.map((t) => t.name);
  return [
    zonesSummary,
    data.latency_ms != null ? `${(data.latency_ms / 1000).toFixed(1)} s` : null,
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
  }));
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="plu-chat__markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasStarted = messages.length > 0;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`${apiRoot}/sessions?limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      /* historique optionnel */
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
  };

  const deleteSession = async (id: string) => {
    if (deletingSessionId) return;
    setDeletingSessionId(id);
    try {
      const res = await fetch(`${apiRoot}/session/${id}`, {
        method: "DELETE",
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
      const res = await fetch(`${apiRoot}/session/${id}`);
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Erreur HTTP ${res.status}`);
      }
      const data: SessionState = await res.json();
      setSessionId(data.session_id);
      setZonesSummary(zonesSummaryFromZones(data.zones));
      setMessages(mapSessionMessages(data.messages));
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
        },
      ]);

      await revealMapPanel(data, sid ?? sessionId, revealOptions);
    },
    [sessionId, zonesSummary, revealMapPanel],
  );

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { id: uid(), role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      if (!sessionId) {
        const ref = parseParcelRef(trimmed);
        const response = await fetch(`${apiRoot}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSessionCreateBody(trimmed, ref)),
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
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
          placeholder="Question PLU, code de l'urbanisme, ou parcelle (ex. BD 634 et BD 518)…"
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
              <h1 className="plu-chat__hero-title">Une question sur le PLU ?</h1>
              {composer}
            </div>
          ) : (
            <>
              <div className="plu-chat__messages">
                <div className="plu-chat__messages-inner">
                  {messages.map((msg) => (
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
                          </div>
                          {msg.meta && <div className="plu-chat__meta">{msg.meta}</div>}
                        </>
                      )}
                    </div>
                  ))}

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
    </div>
  );
}

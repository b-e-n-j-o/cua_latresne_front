import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./pluChat.css";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  meta?: string;
};

type ToolCall = { name: string; result_summary: string };

type ApiTurn = {
  answer: string;
  tool_calls?: ToolCall[];
  latency_ms?: number;
  zones_summary?: string;
};

type SessionSummary = {
  session_id: string;
  title: string;
  zones_summary: string;
  total_turns: number;
  updated_at: string;
  preview?: string | null;
};

type SessionState = {
  session_id: string;
  zones: { code_zone?: string; pct_parcelle_couverte?: number }[];
  messages: { role: string; content: string }[];
};

type ParcelRef = {
  section?: string;
  numero?: string;
  idu?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseParcelRef(text: string): ParcelRef {
  const iduMatch = text.match(/\b(66008\d{3}[A-Z]{1,2}\d{1,4})\b/i);
  if (iduMatch) return { idu: iduMatch[1].toUpperCase() };

  const sectionNum = text.match(
    /section\s+([A-Za-z]{1,2})\s+(?:n[°o]?\s*|num[ée]ro\s+)?(\d{1,4})\b/i,
  );
  if (sectionNum) {
    return { section: sectionNum[1].toUpperCase(), numero: sectionNum[2] };
  }

  const compact = text.match(/\bparcelle\s+([A-Za-z]{1,2})\s+(\d{1,4})\b/i);
  if (compact) {
    return { section: compact[1].toUpperCase(), numero: compact[2] };
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
  const tools = data.tool_calls?.map((t) => t.result_summary).filter(Boolean);
  return [
    zonesSummary,
    data.latency_ms != null ? `${(data.latency_ms / 1000).toFixed(1)} s` : null,
    tools?.length ? tools.join(" · ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatSessionDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export default function PluChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [zonesSummary, setZonesSummary] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
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
      const res = await fetch(`${API_BASE}/api/plu/argeles/sessions?limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      /* historique optionnel */
    } finally {
      setLoadingSessions(false);
    }
  }, []);

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
  };

  const loadSession = async (id: string) => {
    if (isLoading || loadingSessionId) return;
    setLoadingSessionId(id);
    try {
      const res = await fetch(`${API_BASE}/api/plu/argeles/session/${id}`);
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Erreur HTTP ${res.status}`);
      }
      const data: SessionState = await res.json();
      setSessionId(data.session_id);
      setZonesSummary(zonesSummaryFromZones(data.zones));
      setMessages(mapSessionMessages(data.messages));
      setInput("");
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

  const appendAssistant = (data: ApiTurn, summary?: string | null) => {
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant",
        content: data.answer || "Aucune réponse reçue.",
        meta: formatMeta(data, summary ?? zonesSummary ?? undefined) || undefined,
      },
    ]);
  };

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
        if (!ref.section && !ref.numero && !ref.idu) {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content:
                "Pour démarrer une conversation, mentionnez une parcelle d'Argelès-sur-Mer " +
                "(ex. « section AC numéro 45 » ou un IDU). Les questions de suivi pourront ensuite " +
                "porter sur le PLU sans répéter la référence parcellaire.",
            },
          ]);
          return;
        }

        const response = await fetch(`${API_BASE}/api/plu/argeles/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section: ref.section,
            numero: ref.numero,
            idu: ref.idu,
            question: trimmed,
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Erreur HTTP ${response.status}`);
        }

        const data = await response.json();
        setSessionId(data.session_id);
        const summary = data.zones_summary as string | undefined;
        if (summary) setZonesSummary(summary);

        if (data.answer) {
          appendAssistant(data, summary);
        }
        void fetchSessions();
      } else {
        const response = await fetch(`${API_BASE}/api/plu/argeles/chat/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Erreur HTTP ${response.status}`);
        }

        const data: ApiTurn = await response.json();
        appendAssistant(data);
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
          placeholder="Posez votre question sur le PLU d'Argelès-sur-Mer…"
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
    <div className={`plu-chat${sidebarOpen ? " plu-chat--sidebar-open" : ""}`}>
      {sidebarOpen && (
        <button
          type="button"
          className="plu-chat__sidebar-backdrop"
          aria-label="Fermer l'historique"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className="plu-chat__sidebar" aria-label="Historique des conversations">
        <div className="plu-chat__sidebar-head">
          <span className="plu-chat__sidebar-title">Historique</span>
          <button
            type="button"
            className="plu-chat__icon-btn"
            aria-label="Masquer l'historique"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <button type="button" className="plu-chat__sidebar-new" onClick={resetChat}>
          <Plus size={16} />
          Nouvelle conversation
        </button>

        <div className="plu-chat__sidebar-list">
          {loadingSessions && sessions.length === 0 && (
            <p className="plu-chat__sidebar-empty">Chargement…</p>
          )}
          {!loadingSessions && sessions.length === 0 && (
            <p className="plu-chat__sidebar-empty">Aucune conversation enregistrée.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.session_id}
              type="button"
              className={`plu-chat__sidebar-item${sessionId === s.session_id ? " plu-chat__sidebar-item--active" : ""}`}
              onClick={() => void loadSession(s.session_id)}
              disabled={loadingSessionId === s.session_id}
            >
              <span className="plu-chat__sidebar-item-title">{s.title}</span>
              {s.zones_summary && s.zones_summary !== "aucune zone trouvée" && (
                <span className="plu-chat__sidebar-item-zones">{s.zones_summary}</span>
              )}
              {s.preview && (
                <span className="plu-chat__sidebar-item-preview">{s.preview}</span>
              )}
              <span className="plu-chat__sidebar-item-date">
                {formatSessionDate(s.updated_at)}
                {s.total_turns > 0 ? ` · ${s.total_turns} échange${s.total_turns > 1 ? "s" : ""}` : ""}
              </span>
            </button>
          ))}
        </div>
      </aside>

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
                <div className="plu-chat__brand-sub">Argelès-sur-Mer · analyse réglementaire</div>
              </div>
            </div>
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
    </div>
  );
}

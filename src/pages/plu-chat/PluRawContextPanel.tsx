import { type ReactNode, useEffect, useState } from "react";
import { X } from "lucide-react";
import { pluAuthHeaders } from "./pluAuth";

type RawContextPayload = {
  version?: number;
  captured_at?: string;
  commune?: string;
  model?: string;
  system_instruction?: string;
  session_zones_preloaded?: unknown[];
  prior_messages?: { role: string; content: string }[];
  user_message?: string;
  tool_invocations?: {
    index: number;
    name: string;
    args: Record<string, unknown>;
    result_summary?: string;
    result_raw?: unknown;
    result_sent_to_llm?: unknown;
  }[];
  tool_count?: number;
  model_answer?: string;
};

type Props = {
  apiRoot: string;
  sessionId: string;
  messageId: string;
  onClose: () => void;
};

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="plu-raw-ctx__section" open={defaultOpen}>
      <summary className="plu-raw-ctx__section-title">{title}</summary>
      <div className="plu-raw-ctx__section-body">{children}</div>
    </details>
  );
}

function PreBlock({ text }: { text: string }) {
  return <pre className="plu-raw-ctx__pre">{text}</pre>;
}

export default function PluRawContextPanel({ apiRoot, sessionId, messageId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<RawContextPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const auth = await pluAuthHeaders();
        const res = await fetch(
          `${apiRoot}/session/${sessionId}/messages/${messageId}/raw-context`,
          { headers: auth },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { detail?: string }).detail || `Erreur HTTP ${res.status}`,
          );
        }
        const data = await res.json();
        if (!cancelled) {
          setCtx((data as { raw_context: RawContextPayload }).raw_context);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Chargement impossible");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRoot, sessionId, messageId]);

  return (
    <div className="plu-raw-ctx" role="dialog" aria-labelledby="plu-raw-ctx-title">
      <div className="plu-raw-ctx__backdrop" onClick={onClose} aria-hidden />
      <div className="plu-raw-ctx__panel">
        <header className="plu-raw-ctx__head">
          <div>
            <h2 id="plu-raw-ctx-title" className="plu-raw-ctx__title">
              Contexte brut LLM
            </h2>
            <p className="plu-raw-ctx__sub">
              Prompt système, historique, tools et réponse — message {messageId.slice(0, 8)}…
            </p>
          </div>
          <button type="button" className="plu-raw-ctx__close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>

        <div className="plu-raw-ctx__body">
          {loading && <p className="plu-raw-ctx__status">Chargement…</p>}
          {error && <p className="plu-raw-ctx__error">{error}</p>}
          {!loading && !error && ctx && (
            <>
              <p className="plu-raw-ctx__meta">
                {ctx.commune && <>Commune : {ctx.commune} · </>}
                {ctx.model && <>Modèle : {ctx.model} · </>}
                {ctx.tool_count != null && <>{ctx.tool_count} tool(s)</>}
              </p>

              <Section title="Prompt système (assemblé)">
                <PreBlock text={ctx.system_instruction || "(vide)"} />
              </Section>

              {ctx.session_zones_preloaded && (ctx.session_zones_preloaded as unknown[]).length > 0 && (
                <Section title="Zones PLU préchargées (session)" defaultOpen={false}>
                  <PreBlock
                    text={JSON.stringify(ctx.session_zones_preloaded, null, 2)}
                  />
                </Section>
              )}

              {ctx.prior_messages && ctx.prior_messages.length > 0 && (
                <Section title={`Historique (${ctx.prior_messages.length} message(s))`)} defaultOpen={false}>
                  <PreBlock text={JSON.stringify(ctx.prior_messages, null, 2)} />
                </Section>
              )}

              <Section title="Message utilisateur (ce tour)">
                <PreBlock text={ctx.user_message || "(vide)"} />
              </Section>

              {ctx.tool_invocations?.map((t) => (
                <Section
                  key={t.index}
                  title={`Tool #${t.index} — ${t.name}${t.result_summary ? ` · ${t.result_summary}` : ""}`}
                  defaultOpen={t.index === 1}
                >
                  <p className="plu-raw-ctx__label">Arguments</p>
                  <PreBlock text={JSON.stringify(t.args, null, 2)} />
                  <p className="plu-raw-ctx__label">Résultat brut (Python)</p>
                  <PreBlock text={JSON.stringify(t.result_raw, null, 2)} />
                  <p className="plu-raw-ctx__label">JSON renvoyé au modèle</p>
                  <PreBlock text={JSON.stringify(t.result_sent_to_llm, null, 2)} />
                </Section>
              ))}

              <Section title="Réponse modèle (texte final)">
                <PreBlock text={ctx.model_answer || "(vide)"} />
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

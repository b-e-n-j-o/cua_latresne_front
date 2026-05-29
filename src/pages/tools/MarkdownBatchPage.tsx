import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_BASE || "";

type TokenUsage = {
  prompt_token_count: number;
  candidates_token_count: number;
  thoughts_token_count: number;
  cached_content_token_count: number;
  total_token_count: number;
};

type TokenUsageBreakdown = {
  extract: TokenUsage;
  judge: TokenUsage | null;
  total: TokenUsage;
};

type FileResult = {
  zone: string;
  status: string;
  verdict?: string | null;
  routed_to?: string | null;
  error?: string | null;
  total_cost_usd?: number | null;
  duration_s?: number | null;
  tokens?: TokenUsageBreakdown | null;
};

type JobStatus = {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  total: number;
  processed: number;
  current_file?: string | null;
  error?: string | null;
  results: FileResult[];
  download_ready: boolean;
  tokens_total?: TokenUsageBreakdown | null;
};

function formatTokens(t: TokenUsage): string {
  return t.total_token_count.toLocaleString("fr-FR");
}

function TokenDetail({ label, usage }: { label: string; usage: TokenUsage }) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.7, opacity: 0.85 }}>
      <strong style={{ opacity: 1 }}>{label}</strong>
      <div>
        Total : {formatTokens(usage)} — entrée {usage.prompt_token_count.toLocaleString("fr-FR")} · sortie{" "}
        {usage.candidates_token_count.toLocaleString("fr-FR")}
        {usage.thoughts_token_count > 0 && (
          <> · réflexion {usage.thoughts_token_count.toLocaleString("fr-FR")}</>
        )}
        {usage.cached_content_token_count > 0 && (
          <> · cache {usage.cached_content_token_count.toLocaleString("fr-FR")}</>
        )}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  queued: "En file d'attente",
  running: "En cours",
  done: "Terminé",
  failed: "Échec",
};

export default function MarkdownBatchPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [skipJudge, setSkipJudge] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API}/plu-txt-markdown/batch/jobs/${id}`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail || res.statusText);
          }
          const data: JobStatus = await res.json();
          setStatus(data);
          if (data.status === "done" || data.status === "failed") {
            stopPolling();
            setSubmitting(false);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erreur de suivi");
          stopPolling();
          setSubmitting(false);
        }
      }, 2500);
    },
    [stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setJobId(null);

    if (!files?.length) {
      setError("Sélectionnez au moins un fichier .txt");
      return;
    }

    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));

    setSubmitting(true);
    try {
      const url = new URL(`${API}/plu-txt-markdown/batch/jobs`);
      url.searchParams.set("skip_judge", skipJudge ? "true" : "false");

      const res = await fetch(url.toString(), { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText);
      }
      const data = await res.json();
      setJobId(data.job_id);
      pollJob(data.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du lancement");
      setSubmitting(false);
    }
  };

  const downloadZip = () => {
    if (!jobId) return;
    window.open(`${API}/plu-txt-markdown/batch/jobs/${jobId}/download`, "_blank");
  };

  const progressPct =
    status && status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e0c",
        color: "#fff",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        padding: "32px max(24px, 5vw) 64px",
      }}
    >
      <a
        href="/"
        style={{
          color: "rgba(255,255,255,0.45)",
          fontSize: 12,
          textDecoration: "none",
          letterSpacing: "0.08em",
        }}
      >
        ← KERELIA
      </a>

      <h1 style={{ fontSize: 28, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>
        PLU — TXT → Markdown
      </h1>
      <p style={{ color: "rgba(255,255,255,0.55)", maxWidth: 640, lineHeight: 1.6, marginBottom: 32 }}>
        Conversion batch de textes bruts (OCR / export) en Markdown structuré, via le même pipeline
        LLM que Latresne (retranscription fidèle + audit optionnel).
      </p>

      <form
        onSubmit={onSubmit}
        style={{
          maxWidth: 560,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ display: "block", fontSize: 13, marginBottom: 8, opacity: 0.8 }}>
            Fichiers .txt (max 20, 12 Mo chacun)
          </span>
          <input
            type="file"
            accept=".txt,text/plain"
            multiple
            disabled={submitting}
            onChange={(ev) => setFiles(ev.target.files)}
            style={{ width: "100%", color: "#ccc" }}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 14,
            marginBottom: 20,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={skipJudge}
            disabled={submitting}
            onChange={(ev) => setSkipJudge(ev.target.checked)}
          />
          Désactiver l&apos;audit juge (plus rapide, moins cher)
        </label>

        <button
          type="submit"
          disabled={submitting}
          style={{
            background: submitting ? "#444" : "#c8e6a0",
            color: "#0e0e0c",
            border: "none",
            borderRadius: 8,
            padding: "12px 24px",
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Traitement en cours…" : "Lancer la conversion"}
        </button>
      </form>

      {error && (
        <p style={{ color: "#f87171", marginTop: 20, maxWidth: 560 }} role="alert">
          {error}
        </p>
      )}

      {status && (
        <div style={{ marginTop: 32, maxWidth: 720 }}>
          <p style={{ fontSize: 14, opacity: 0.7 }}>
            Job <code style={{ opacity: 0.9 }}>{jobId}</code> — {STATUS_LABEL[status.status] || status.status}
            {status.current_file ? ` — ${status.current_file}` : ""}
          </p>

          <div
            style={{
              height: 6,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 3,
              marginTop: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "#c8e6a0",
                transition: "width 0.3s",
              }}
            />
          </div>
          <p style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>
            {status.processed} / {status.total} fichiers
          </p>

          {status.error && (
            <p style={{ color: "#f87171", marginTop: 12 }}>{status.error}</p>
          )}

          {status.results.length > 0 && (
            <table
              style={{
                width: "100%",
                marginTop: 20,
                fontSize: 13,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.6 }}>
                  <th style={{ padding: "8px 12px 8px 0" }}>Fichier</th>
                  <th style={{ padding: "8px 12px" }}>Statut</th>
                  <th style={{ padding: "8px 12px" }}>Verdict</th>
                  <th style={{ padding: "8px 12px" }}>Coût</th>
                  <th style={{ padding: "8px 0 8px 12px" }}>Jetons (total)</th>
                </tr>
              </thead>
              <tbody>
                {status.results.map((r) => (
                  <tr key={r.zone} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "10px 12px 10px 0" }}>{r.zone}</td>
                    <td style={{ padding: "10px 12px" }}>{r.status}</td>
                    <td style={{ padding: "10px 12px" }}>{r.routed_to || r.verdict || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {r.total_cost_usd != null ? `$${r.total_cost_usd.toFixed(3)}` : "—"}
                    </td>
                    <td style={{ padding: "10px 0 10px 12px" }}>
                      {r.tokens?.total ? formatTokens(r.tokens.total) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {status.tokens_total && (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: "rgba(200,230,160,0.08)",
                border: "1px solid rgba(200,230,160,0.25)",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#c8e6a0" }}>
                Jetons Gemini — total du batch
              </p>
              <TokenDetail label="Total (tous fichiers)" usage={status.tokens_total.total} />
              <TokenDetail label="Extraction" usage={status.tokens_total.extract} />
              {status.tokens_total.judge && (
                <TokenDetail label="Audit juge" usage={status.tokens_total.judge} />
              )}
            </div>
          )}

          {status.download_ready && status.status === "done" && (
            <button
              type="button"
              onClick={downloadZip}
              style={{
                marginTop: 24,
                background: "transparent",
                color: "#c8e6a0",
                border: "1px solid #c8e6a0",
                borderRadius: 8,
                padding: "10px 20px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Télécharger le ZIP (markdown + audits)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

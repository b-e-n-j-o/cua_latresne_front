import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";

const GEMINI_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
] as const;

type GeminiModel = (typeof GEMINI_MODELS)[number];

type SelectedFileInfo = {
  name: string;
  zone: string;
  charCount: number | null;
  sizeBytes: number;
  loading: boolean;
  error?: string;
};

type FileCompare = {
  zone: string;
  source_txt: string;
  markdown: string | null;
  status?: string | null;
  routed_to?: string | null;
};

function fileStem(filename: string): string {
  let base = filename.split(/[/\\]/).pop() || "document";
  if (base.toLowerCase().endsWith(".txt")) base = base.slice(0, -4);
  const stem = base.replace(/[^\w.\-]/g, "_").replace(/^[._]+|[._]+$/g, "");
  return stem || "document";
}

function formatChars(n: number): string {
  return n.toLocaleString("fr-FR");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

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
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  total: number;
  processed: number;
  current_file?: string | null;
  model?: string | null;
  error?: string | null;
  results: FileResult[];
  download_ready: boolean;
  tokens_total?: TokenUsageBreakdown | null;
};

function formatTokens(t: TokenUsage): string {
  return t.total_token_count.toLocaleString("fr-FR");
}

function formatTokenTriple(t: TokenUsage): string {
  return `${t.prompt_token_count.toLocaleString("fr-FR")} / ${t.candidates_token_count.toLocaleString("fr-FR")} / ${t.thoughts_token_count.toLocaleString("fr-FR")}`;
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

const paneStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  margin: 0,
  padding: 16,
  overflow: "auto",
  fontSize: 12,
  lineHeight: 1.55,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "rgba(0,0,0,0.35)",
  border: "none",
  color: "rgba(255,255,255,0.9)",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "En file d'attente",
  running: "En cours",
  done: "Terminé",
  failed: "Échec",
  cancelled: "Annulé",
};

export default function MarkdownBatchPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileInfo[]>([]);
  const [geminiModel, setGeminiModel] = useState<GeminiModel>("gemini-3.1-pro-preview");
  const [skipJudge, setSkipJudge] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [compareZone, setCompareZone] = useState<string | null>(null);
  const [compare, setCompare] = useState<FileCompare | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
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
          if (data.status === "done" || data.status === "failed" || data.status === "cancelled") {
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

  const loadCompare = useCallback(
    async (zone: string) => {
      if (!jobId) return;
      setCompareZone(zone);
      setCompareLoading(true);
      setCompare(null);
      try {
        const res = await fetch(
          `${API}/plu-txt-markdown/batch/jobs/${jobId}/files/${encodeURIComponent(zone)}/compare`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || res.statusText);
        }
        setCompare(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible de charger la comparaison");
        setCompareZone(null);
      } finally {
        setCompareLoading(false);
      }
    },
    [jobId],
  );

  const onFilesChange = async (ev: ChangeEvent<HTMLInputElement>) => {
    const list = ev.target.files;
    setFiles(list);
    setCompareZone(null);
    setCompare(null);

    if (!list?.length) {
      setSelectedFiles([]);
      return;
    }

    const pending: SelectedFileInfo[] = Array.from(list).map((f) => ({
      name: f.name,
      zone: fileStem(f.name),
      charCount: null,
      sizeBytes: f.size,
      loading: true,
    }));
    setSelectedFiles(pending);

    const loaded = await Promise.all(
      Array.from(list).map(async (f): Promise<SelectedFileInfo> => {
        try {
          const text = await f.text();
          return {
            name: f.name,
            zone: fileStem(f.name),
            charCount: [...text].length,
            sizeBytes: f.size,
            loading: false,
          };
        } catch {
          return {
            name: f.name,
            zone: fileStem(f.name),
            charCount: null,
            sizeBytes: f.size,
            loading: false,
            error: "Lecture impossible",
          };
        }
      }),
    );
    setSelectedFiles(loaded);
  };

  const totalChars = selectedFiles.reduce((sum, f) => sum + (f.charCount ?? 0), 0);
  const filesStillLoading = selectedFiles.some((f) => f.loading);
  const jobFinished =
    status?.status === "done" || status?.status === "cancelled" || status?.status === "failed";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setJobId(null);
    setCompareZone(null);
    setCompare(null);

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
      url.searchParams.set("model", geminiModel);

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

  const cancelJob = async () => {
    if (!jobId) return;
    if (!window.confirm("Annuler le batch ? Le fichier en cours finira, les suivants seront ignorés.")) {
      return;
    }
    try {
      const res = await fetch(`${API}/plu-txt-markdown/batch/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText);
      }
      const pollRes = await fetch(`${API}/plu-txt-markdown/batch/jobs/${jobId}`);
      if (pollRes.ok) {
        setStatus(await pollRes.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Annulation impossible");
    }
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
            onChange={onFilesChange}
            style={{ width: "100%", color: "#ccc" }}
          />
        </label>

        {selectedFiles.length > 0 && (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              background: "rgba(0,0,0,0.25)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.04em",
                opacity: 0.75,
                textTransform: "uppercase",
              }}
            >
              Fichiers sélectionnés ({selectedFiles.length})
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                maxHeight: 280,
                overflowY: "auto",
              }}
            >
              {selectedFiles.map((f) => (
                <li
                  key={f.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 12,
                    padding: "8px 0",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={f.name}
                  >
                    {f.name}
                  </span>
                  <span style={{ flexShrink: 0, opacity: 0.65, fontSize: 11 }}>
                    {formatBytes(f.sizeBytes)}
                  </span>
                  <span style={{ flexShrink: 0, minWidth: 100, textAlign: "right", color: "#c8e6a0" }}>
                    {f.loading && "…"}
                    {!f.loading && f.error && (
                      <span style={{ color: "#f87171" }}>{f.error}</span>
                    )}
                    {!f.loading && f.charCount != null && (
                      <>{formatChars(f.charCount)} car.</>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {!filesStillLoading && selectedFiles.length > 1 && (
              <p
                style={{
                  margin: "10px 0 0",
                  paddingTop: 10,
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 12,
                  opacity: 0.7,
                  textAlign: "right",
                }}
              >
                Total : <strong style={{ color: "#c8e6a0" }}>{formatChars(totalChars)}</strong> caractères
              </p>
            )}
          </div>
        )}

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ display: "block", fontSize: 13, marginBottom: 8, opacity: 0.8 }}>
            Modèle Gemini
          </span>
          <select
            value={geminiModel}
            disabled={submitting}
            onChange={(ev) => setGeminiModel(ev.target.value as GeminiModel)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: 14,
            }}
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
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
          disabled={submitting || filesStillLoading || !selectedFiles.length}
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
        <div style={{ marginTop: 32, maxWidth: "min(1400px, 100%)" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              fontSize: 14,
              opacity: 0.85,
            }}
          >
            <p style={{ margin: 0, flex: 1, minWidth: 200 }}>
              Job <code style={{ opacity: 0.9 }}>{jobId}</code> —{" "}
              {STATUS_LABEL[status.status] || status.status}
              {status.model ? ` — ${status.model}` : ""}
              {status.current_file ? ` — ${status.current_file}` : ""}
            </p>
            {(status.status === "queued" || status.status === "running") && (
              <button
                type="button"
                onClick={cancelJob}
                style={{
                  background: "transparent",
                  color: "#f87171",
                  border: "1px solid rgba(248,113,113,0.5)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Annuler le batch
              </button>
            )}
          </div>

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
            <>
              <p style={{ fontSize: 12, opacity: 0.55, marginTop: 16, marginBottom: 8 }}>
                {jobFinished
                  ? "Cliquez sur un fichier pour comparer le .txt source et le Markdown généré."
                  : "Jetons par fichier : entrée / sortie / réflexion"}
              </p>
              <table
                style={{
                  width: "100%",
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
                    <th style={{ padding: "8px 12px" }} title="entrée / sortie / réflexion">
                      Jetons (in / out / think)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {status.results.map((r) => {
                    const clickable = jobFinished && r.status !== "extract_failed";
                    const selected = compareZone === r.zone;
                    return (
                      <tr
                        key={r.zone}
                        onClick={() => clickable && loadCompare(r.zone)}
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                          cursor: clickable ? "pointer" : "default",
                          background: selected ? "rgba(200,230,160,0.12)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px 12px 10px 0" }}>
                          {r.zone}
                          {clickable && (
                            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.45 }}>
                              comparer →
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>{r.status}</td>
                        <td style={{ padding: "10px 12px" }}>{r.routed_to || r.verdict || "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {r.total_cost_usd != null ? `$${r.total_cost_usd.toFixed(3)}` : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>
                          {r.tokens?.total ? formatTokenTriple(r.tokens.total) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
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

          {status.download_ready && (status.status === "done" || status.status === "cancelled") && (
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

          {jobFinished && compareZone && (
            <div style={{ marginTop: 32 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 12,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  Comparaison — {compareZone}
                </h2>
                {compare?.routed_to && (
                  <span style={{ fontSize: 12, opacity: 0.55 }}>Dossier : {compare.routed_to}</span>
                )}
              </div>

              {compareLoading && (
                <p style={{ opacity: 0.6, fontSize: 14 }}>Chargement…</p>
              )}

              {!compareLoading && compare && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 0,
                    height: "min(72vh, 720px)",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <div
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        background: "rgba(255,255,255,0.06)",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      Texte source (.txt)
                    </div>
                    <pre style={paneStyle}>{compare.source_txt}</pre>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 0,
                      borderLeft: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        background: "rgba(200,230,160,0.1)",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        color: "#c8e6a0",
                      }}
                    >
                      Markdown généré
                    </div>
                    <pre style={paneStyle}>
                      {compare.markdown ?? "(Aucun markdown — échec d'extraction ou fichier non traité)"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

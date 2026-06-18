/**
 * DocumentsOfficiels.tsx
 * ----------------------
 * Documents officiels du Géoportail de l'urbanisme (PLU, PADD, annexes…).
 * Liste à gauche, visualisation PDF à droite.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = Record<string, any>;
type Toast = { id: number; type: "ok" | "error"; msg: string } | null;

interface Props {
  apiBase?: string;
  token?: string;
  communeSlug: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(1).replace(".", ",")} Mo`;
  const ko = bytes / 1024;
  return `${Math.round(ko)} Ko`;
}

export default function DocumentsOfficiels({ apiBase = "", token, communeSlug }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | null>(null);

  const api = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const res = await fetch(
        `${apiBase}/communes/${encodeURIComponent(communeSlug)}/documents${path}`,
        {
          ...opts,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opts.headers || {}),
          },
        }
      );
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const j = await res.json();
          detail = j.detail || detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      if (res.status === 204) return null;
      return res.json();
    },
    [apiBase, token, communeSlug]
  );

  const flash = useCallback((type: "ok" | "error", msg: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, type, msg });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadList = useCallback(
    async (q: string) => {
      setLoadingList(true);
      try {
        const qs = q ? `?search=${encodeURIComponent(q)}` : "";
        const data = await api(qs);
        setRows(data);
      } catch (e: any) {
        flash("error", e.message);
        setRows([]);
      } finally {
        setLoadingList(false);
      }
    },
    [api, flash]
  );

  useEffect(() => {
    loadList("");
    setSearch("");
    setSelectedId(null);
    setSelected(null);
  }, [loadList]);

  useEffect(() => {
    const t = window.setTimeout(() => loadList(search), 250);
    return () => window.clearTimeout(t);
  }, [search, loadList]);

  const selectRow = useCallback(
    async (id: string) => {
      setSelectedId(id);
      try {
        const row = await api(`/${encodeURIComponent(id)}`);
        setSelected(row);
      } catch (e: any) {
        flash("error", e.message);
      }
    },
    [api, flash]
  );

  const groupedCount = useMemo(() => rows.length, [rows]);

  return (
    <div className="doc-root">
      <style>{CSS}</style>

      <section className="doc-list" aria-label="Documents officiels">
        <div className="doc-list-top">
          <div className="doc-list-head">
            <h1 className="doc-list-title">Documents officiels</h1>
            <span className="doc-list-count">{groupedCount}</span>
          </div>
          <div className="doc-search">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un document…"
              aria-label="Rechercher"
            />
          </div>
        </div>

        <div className="doc-list-body">
          {loadingList && <div className="doc-muted">Chargement…</div>}
          {!loadingList && rows.length === 0 && (
            <div className="doc-empty">Aucun document trouvé.</div>
          )}
          {!loadingList &&
            rows.map((r) => (
              <button
                key={r.id}
                className={`doc-row ${selectedId === r.id ? "is-selected" : ""}`}
                onClick={() => selectRow(r.id)}
              >
                <span className="doc-row-primary">{r.title || r.file_name}</span>
                <span className="doc-row-secondary">{r.categorie}</span>
              </button>
            ))}
        </div>
      </section>

      <section className="doc-viewer" aria-label="Visualiseur">
        {!selected && (
          <div className="doc-viewer-empty">
            <DocIcon />
            <p>Sélectionne un document à gauche pour l&apos;afficher.</p>
            <p className="doc-muted">Source : Géoportail de l&apos;urbanisme</p>
          </div>
        )}

        {selected && (
          <>
            <header className="doc-viewer-head">
              <div>
                <div className="doc-viewer-kicker">Document officiel</div>
                <h2 className="doc-viewer-title">{selected.title || selected.file_name}</h2>
                <p className="doc-viewer-meta">
                  {selected.categorie}
                  {selected.file_name ? ` · ${selected.file_name}` : ""}
                </p>
              </div>
            </header>
            <GpuPdfViewer
              apiBase={apiBase}
              communeSlug={communeSlug}
              token={token}
              piece={selected}
            />
          </>
        )}
      </section>

      {toast && (
        <div className={`doc-toast ${toast.type === "error" ? "is-error" : "is-ok"}`} role="status">
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function GpuPdfViewer({
  apiBase,
  communeSlug,
  token,
  piece,
}: {
  apiBase: string;
  communeSlug: string;
  token?: string;
  piece: Row;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!piece?.is_pdf) {
      setLoading(false);
      setPdfUrl(null);
      setBlob(null);
      setSizeBytes(null);
      setError(null);
      return;
    }

    const params = new URLSearchParams({
      document_id: String(piece.document_id),
      file_name: String(piece.file_name),
    });
    const url = `${apiBase}/communes/${encodeURIComponent(communeSlug)}/documents/file?${params}`;
    let revoked: string | null = null;
    setLoading(true);
    setError(null);

    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        if (!res.ok) {
          let detail = res.statusText;
          try {
            const j = await res.json();
            detail = j.detail || detail;
          } catch {
            /* ignore */
          }
          throw new Error(detail);
        }
        return res.blob();
      })
      .then((b) => {
        setBlob(b);
        setSizeBytes(b.size);
        revoked = URL.createObjectURL(b);
        setPdfUrl(revoked);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));

    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [apiBase, communeSlug, token, piece.document_id, piece.file_name, piece.is_pdf]);

  const downloadFile = () => {
    if (!blob || !piece.file_name) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = String(piece.file_name);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!piece?.is_pdf) {
    return (
      <div className="doc-nonpdf">
        <p>Aperçu indisponible pour ce type de fichier.</p>
        <p className="doc-muted">{piece.file_name}</p>
      </div>
    );
  }

  return (
    <div className="doc-pdf-wrap">
      <div className="doc-pdf-toolbar">
        {loading && <span className="doc-muted">Chargement du PDF…</span>}
        {!loading && sizeBytes != null && (
          <span className="doc-pdf-size">{formatBytes(sizeBytes)}</span>
        )}
        {!loading && blob && (
          <button type="button" className="doc-btn-download" onClick={downloadFile}>
            Télécharger
          </button>
        )}
      </div>
      {error && <div className="doc-pdf-error">Impossible d&apos;afficher le PDF : {error}</div>}
      {!error && pdfUrl && (
        <iframe
          className="doc-pdf-frame"
          src={pdfUrl}
          title={String(piece.title || piece.file_name || "Document PDF")}
        />
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 2h8l4 4v16H6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v4h4M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const CSS = `
.doc-root{
  --ink:#111111; --paper:#ffffff; --panel:#fafafa;
  --line:#e8e8e8; --muted:#4b4b4b;
  --accent:#85e372; --accent-d:#289f01; --accent-soft:rgba(133,227,114,.14);
  --danger:#c0362c;
  --font-ui:"Kerelia Sans","Inter",-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  display:grid; grid-template-columns:320px 1fr;
  height:100%; min-height:600px; color:var(--ink);
  font-family:var(--font-ui); background:var(--paper);
  border:1px solid var(--line); border-radius:12px; overflow:hidden;
}
.doc-root *{box-sizing:border-box;}
.doc-list{background:var(--panel); border-right:1px solid var(--line); display:flex; flex-direction:column; min-height:0;}
.doc-list-top{padding:14px; border-bottom:1px solid var(--line); display:flex; flex-direction:column; gap:10px;}
.doc-list-head{display:flex; align-items:center; justify-content:space-between; gap:8px;}
.doc-list-title{margin:0; font-size:15px; font-weight:600;}
.doc-list-count{font-size:12px; background:var(--accent-soft); color:var(--accent-d); border-radius:999px; padding:2px 8px; font-weight:600;}
.doc-search{display:flex; align-items:center; gap:8px; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:8px 10px; color:var(--muted);}
.doc-search input{border:0; outline:0; flex:1; font-family:inherit; font-size:13px; color:var(--ink); background:transparent;}
.doc-list-body{overflow:auto; padding:8px; flex:1; min-height:0;}
.doc-row{display:flex; flex-direction:column; gap:2px; width:100%; text-align:left; background:transparent; border:0; border-radius:8px; padding:10px 12px; font-family:inherit; cursor:pointer; transition:background .1s;}
.doc-row:hover{background:#f0f0f0;}
.doc-row.is-selected{background:var(--paper); box-shadow:inset 3px 0 0 var(--accent-d);}
.doc-row-primary{font-weight:600; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.doc-row-secondary{font-size:12px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.doc-empty,.doc-muted{color:var(--muted); font-size:13px; padding:16px; line-height:1.5;}
.doc-viewer{display:flex; flex-direction:column; min-height:0; background:var(--paper);}
.doc-viewer-empty{flex:1; display:grid; place-items:center; text-align:center; color:var(--muted); line-height:1.6; padding:24px;}
.doc-viewer-empty svg{color:var(--line); margin-bottom:12px;}
.doc-viewer-head{padding:20px 28px; border-bottom:1px solid var(--line);}
.doc-viewer-kicker{font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--accent-d); font-weight:600;}
.doc-viewer-title{margin:4px 0 0; font-size:22px; font-weight:600; letter-spacing:-.01em;}
.doc-viewer-meta{margin:6px 0 0; font-size:13px; color:var(--muted);}
.doc-pdf-wrap{flex:1; display:flex; flex-direction:column; min-height:0;}
.doc-pdf-toolbar{display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 28px; border-bottom:1px solid var(--line); background:var(--panel);}
.doc-pdf-size{font-size:13px; color:var(--muted); font-weight:500;}
.doc-btn-download{background:var(--paper); border:1px solid var(--accent-d); color:var(--accent-d); font-family:inherit; font-weight:600; padding:7px 14px; border-radius:8px; cursor:pointer; font-size:13px;}
.doc-btn-download:hover{background:var(--accent-d); color:#fff;}
.doc-pdf-frame{flex:1; width:100%; min-height:0; border:0; background:#525659;}
.doc-pdf-error,.doc-nonpdf{padding:24px 28px; color:var(--danger); line-height:1.6;}
.doc-nonpdf{color:var(--muted);}
.doc-toast{position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 20px; border-radius:10px; font-size:14px; font-weight:500; color:#fff; box-shadow:0 8px 24px rgba(0,0,0,.18); z-index:50;}
.doc-toast.is-ok{background:var(--accent-d);}
.doc-toast.is-error{background:var(--danger);}
@media (max-width:900px){
  .doc-root{grid-template-columns:1fr; grid-auto-rows:auto;}
  .doc-list{max-height:280px; border-right:0; border-bottom:1px solid var(--line);}
}
`;

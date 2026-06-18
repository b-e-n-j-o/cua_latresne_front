/**
 * ReglementsAdmin.tsx
 * -------------------
 * Back-office d'édition des règlements (PLU / PPR / PPRIF / Servitudes).
 *
 * Entièrement piloté par le backend : il appelle GET /communes/{slug}/reglements/sources
 * pour connaître les tables, leurs colonnes et lesquelles sont du "texte long".
 * Ajouter une table côté backend = elle apparaît ici automatiquement.
 *
 * Usage :
 *   <ReglementsAdmin apiBase="https://api.kerelia.fr" token={jwt} />
 *
 * Les champs "texte long" (règlement, résumé…) sont éditables en markdown avec
 * aperçu en direct (mode Édition / Côte à côte / Aperçu). Les modifications sont
 * persistées en base via PATCH.
 *
 * Dépendances : react-markdown, remark-gfm (déjà dans le projet, cf. PluChat).
 * Style isolé sous le préfixe .rga- — charte Kerelia (blanc / noir / vert).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Kind = "text" | "longtext" | "bool" | "date" | "int";

interface Col {
  name: string;
  label: string;
  kind: Kind;
  editable: boolean;
  creatable: boolean;
  pk: boolean;
}

interface Source {
  source: string;
  label: string;
  table: string;
  pk: string;
  list_primary: string;
  list_secondary: string | null;
  search_cols: string[];
  columns: Col[];
  aggregated?: boolean;
  creatable?: boolean;
  deletable?: boolean;
}

type Row = Record<string, any>;

interface Props {
  apiBase?: string;
  token?: string;
  communeSlug: string;
}

type Toast = { id: number; type: "ok" | "error"; msg: string } | null;

export default function ReglementsAdmin({ apiBase = "", token, communeSlug }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState<Row | null>(null);
  const [original, setOriginal] = useState<Row | null>(null);
  const [mode, setMode] = useState<"edit" | "create">("edit");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRow, setLoadingRow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | null>(null);

  const api = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const res = await fetch(
        `${apiBase}/communes/${encodeURIComponent(communeSlug)}/reglements${path}`,
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

  const activeSource = useMemo(
    () => sources.find((s) => s.source === active) || null,
    [sources, active]
  );
  const canCreate = activeSource?.creatable !== false;
  const canDelete = activeSource?.deletable !== false;

  // -- chargement initial des sources --
  useEffect(() => {
    api("/sources")
      .then((data: Source[]) => {
        setSources(data);
        if (data.length) setActive(data[0].source);
      })
      .catch((e) => flash("error", `Chargement des sources : ${e.message}`));
  }, [api, flash]);

  // -- chargement de la liste --
  const loadList = useCallback(
    async (src: string, q: string) => {
      setLoadingList(true);
      try {
        const qs = q ? `?search=${encodeURIComponent(q)}` : "";
        const data = await api(`/${src}${qs}`);
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
    if (!active) return;
    setSelectedKey(null);
    setForm(null);
    setOriginal(null);
    loadList(active, "");
    setSearch("");
  }, [active, loadList]);

  // recherche (debounce léger)
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => loadList(active, search), 250);
    return () => window.clearTimeout(t);
  }, [search, active, loadList]);

  // -- sélection d'une ligne --
  const selectRow = useCallback(
    async (src: Source, keyVal: string) => {
      setMode("edit");
      setSelectedKey(keyVal);
      setLoadingRow(true);
      try {
        const row = await api(`/${src.source}/${encodeURIComponent(keyVal)}`);
        setForm(row);
        setOriginal(row);
      } catch (e: any) {
        flash("error", e.message);
      } finally {
        setLoadingRow(false);
      }
    },
    [api, flash]
  );

  const startCreate = useCallback(() => {
    if (!activeSource || activeSource.creatable === false) return;
    const blank: Row = {};
    for (const c of activeSource.columns) {
      if (!c.creatable) continue;
      blank[c.name] = c.kind === "bool" ? false : "";
    }
    setMode("create");
    setSelectedKey(null);
    setForm(blank);
    setOriginal(null);
  }, [activeSource]);

  const dirty = useMemo(() => {
    if (mode === "create") return form && Object.values(form).some((v) => v !== "" && v !== false);
    if (!form || !original) return false;
    return Object.keys(form).some((k) => form[k] !== original[k]);
  }, [form, original, mode]);

  const setField = (name: string, value: any) =>
    setForm((f) => (f ? { ...f, [name]: value } : f));

  // -- sauvegarde (persiste en base) --
  const save = async () => {
    if (!activeSource || !form) return;
    setSaving(true);
    try {
      let saved: Row;
      if (mode === "create") {
        const payload: Row = {};
        for (const c of activeSource.columns) {
          if (c.creatable && form[c.name] !== "" && form[c.name] !== undefined) {
            payload[c.name] = form[c.name];
          }
        }
        saved = await api(`/${activeSource.source}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        flash("ok", "Entrée créée");
      } else {
        const payload: Row = {};
        for (const c of activeSource.columns) {
          if (c.editable && original && form[c.name] !== original[c.name]) {
            payload[c.name] = form[c.name];
          }
        }
        saved = await api(`/${activeSource.source}/${encodeURIComponent(selectedKey!)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        flash("ok", "Modifications enregistrées");
      }
      setForm(saved);
      setOriginal(saved);
      setMode("edit");
      setSelectedKey(String(saved[activeSource.pk]));
      await loadList(activeSource.source, search);
    } catch (e: any) {
      flash("error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!activeSource || mode === "create" || selectedKey == null) return;
    if (!window.confirm("Supprimer définitivement cette entrée ?")) return;
    try {
      await api(`/${activeSource.source}/${encodeURIComponent(selectedKey)}`, {
        method: "DELETE",
      });
      flash("ok", "Entrée supprimée");
      setForm(null);
      setOriginal(null);
      setSelectedKey(null);
      await loadList(activeSource.source, search);
    } catch (e: any) {
      flash("error", e.message);
    }
  };

  // -- champs visibles selon le mode --
  const visibleCols = useMemo(() => {
    if (!activeSource) return [];
    return mode === "create"
      ? activeSource.columns.filter((c) => c.creatable)
      : activeSource.columns;
  }, [activeSource, mode]);

  const shortCols = visibleCols.filter((c) => c.kind !== "longtext");
  const longCols = visibleCols.filter((c) => c.kind === "longtext");
  const hasReglementationCol = activeSource?.columns.some((c) => c.name === "reglementation") ?? false;

  const isReglementationMissing = (row: Row) =>
    hasReglementationCol && row.reglementation_manquante === true;

  return (
    <div className="rga-root">
      <style>{CSS}</style>

      {/* Rail : choix du document */}
      <nav className="rga-rail" aria-label="Type de document">
        <div className="rga-rail-head">Documents</div>
        {sources.map((s) => (
          <button
            key={s.source}
            className={`rga-rail-item ${active === s.source ? "is-active" : ""}`}
            onClick={() => setActive(s.source)}
            aria-current={active === s.source}
          >
            <span className="rga-rail-label">{s.label}</span>
            {active === s.source && <span className="rga-rail-count">{rows.length}</span>}
          </button>
        ))}
      </nav>

      {/* Liste des zones/entrées */}
      <section className="rga-list" aria-label="Entrées">
        <div className="rga-list-top">
          <div className="rga-search">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une zone, un code, un texte…"
              aria-label="Rechercher"
            />
          </div>
          <button className="rga-new" onClick={startCreate} disabled={!activeSource || !canCreate}>
            + Nouvelle entrée
          </button>
        </div>

        <div className="rga-list-body">
          {loadingList && <div className="rga-muted">Chargement…</div>}
          {!loadingList && rows.length === 0 && (
            <div className="rga-empty">
              {canCreate
                ? "Aucune entrée. Crée-en une avec « Nouvelle entrée »."
                : "Aucune entrée trouvée."}
            </div>
          )}
          {!loadingList &&
            activeSource &&
            rows.map((r) => {
              const keyVal = String(r[activeSource.pk]);
              const primary = r[activeSource.list_primary] ?? keyVal;
              const secondary = activeSource.list_secondary
                ? r[activeSource.list_secondary]
                : null;
              return (
                <button
                  key={keyVal}
                  className={`rga-row ${selectedKey === keyVal ? "is-selected" : ""}`}
                  onClick={() => selectRow(activeSource, keyVal)}
                >
                  <div className="rga-row-head">
                    <span className="rga-row-primary">{primary || "—"}</span>
                    {isReglementationMissing(r) && (
                      <span className="rga-badge-todo" title="Règlement vide en base">
                        À remplir
                      </span>
                    )}
                  </div>
                  {secondary && <span className="rga-row-secondary">{secondary}</span>}
                </button>
              );
            })}
        </div>
      </section>

      {/* Éditeur */}
      <section className="rga-editor" aria-label="Éditeur">
        {!form && (
          <div className="rga-editor-empty">
            <div className="rga-editor-empty-inner">
              <DocIcon />
              <p>Sélectionne une entrée à gauche pour modifier son règlement,</p>
              <p>ou crée une nouvelle entrée.</p>
            </div>
          </div>
        )}

        {form && (
          <>
            <header className="rga-editor-head">
              <div>
                <div className="rga-editor-kicker">
                  {activeSource?.label} {mode === "create" ? "· nouvelle entrée" : ""}
                </div>
                <h2 className="rga-editor-title">
                  {mode === "create"
                    ? "Nouvelle entrée"
                    : form[activeSource!.list_primary] || "(sans titre)"}
                </h2>
              </div>
              {dirty && <span className="rga-badge-dirty">Non enregistré</span>}
            </header>

            <div className="rga-editor-body">
              {loadingRow && <div className="rga-muted">Chargement de l'entrée…</div>}

              {!loadingRow && (
                <>
                  {/* champs courts en grille */}
                  <div className="rga-grid">
                    {shortCols.map((c) => (
                      <Field
                        key={c.name}
                        col={c}
                        value={form[c.name]}
                        readOnly={mode === "edit" && !c.editable}
                        onChange={(v) => setField(c.name, v)}
                      />
                    ))}
                  </div>

                  {/* textes longs : éditable (markdown) + aperçu en direct */}
                  {longCols.map((c) => (
                    <LongTextField
                      key={c.name}
                      col={c}
                      value={form[c.name] ?? ""}
                      readOnly={mode === "edit" && !c.editable}
                      onChange={(v) => setField(c.name, v)}
                    />
                  ))}
                </>
              )}
            </div>

            <footer className="rga-savebar">
              <div className="rga-savebar-status">
                {dirty ? "Modifications en attente" : "À jour"}
              </div>
              <div className="rga-savebar-actions">
                {mode === "edit" && canDelete && (
                  <button className="rga-btn-danger" onClick={remove}>
                    Supprimer
                  </button>
                )}
                <button
                  className="rga-btn-primary"
                  onClick={save}
                  disabled={saving || !dirty}
                >
                  {saving
                    ? "Enregistrement…"
                    : mode === "create"
                    ? "Créer l'entrée"
                    : "Enregistrer"}
                </button>
              </div>
            </footer>
          </>
        )}
      </section>

      {toast && (
        <div className={`rga-toast ${toast.type === "error" ? "is-error" : "is-ok"}`} role="status">
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Markdown (même stack que PluChat)                                          */
/* -------------------------------------------------------------------------- */
function ReglementMarkdown({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="rga-markdown-empty">Aucun contenu.</p>;
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children, ...props }) => (
          <div className="rga-markdown-table-wrap">
            <table {...props}>{children}</table>
          </div>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* -------------------------------------------------------------------------- */
/* Champ texte long : édition markdown + aperçu en direct                     */
/* Modes : Édition (textarea seul) / Côte à côte / Aperçu                      */
/* -------------------------------------------------------------------------- */
function LongTextField({
  col,
  value,
  readOnly,
  onChange,
}: {
  col: Col;
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
}) {
  const isReglement = col.name === "reglementation";
  // le règlement s'ouvre côte à côte (lecture confortable + édition) ;
  // les autres champs longs s'ouvrent en édition directe.
  const [view, setView] = useState<"edit" | "split" | "preview">(
    isReglement ? "split" : "edit"
  );

  const editor = (
    <textarea
      id={`f-${col.name}`}
      className={`rga-textarea ${isReglement ? "is-reglement" : ""}`}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      spellCheck
      placeholder="Texte au format Markdown (titres ##, listes -, gras **…**, tableaux |…|)"
    />
  );

  const preview = (
    <div
      className={`rga-markdown ${isReglement ? "is-reglement" : ""}`}
      aria-label={`Aperçu — ${col.label}`}
    >
      <ReglementMarkdown content={value} />
    </div>
  );

  // lecture seule : aperçu uniquement
  if (readOnly) {
    return (
      <div className="rga-longfield">
        <div className="rga-longfield-head">
          <label className="rga-label">
            {col.label}
            <span className="rga-ro">lecture seule</span>
            <span className="rga-chars">{(value || "").length} caractères</span>
          </label>
        </div>
        {preview}
      </div>
    );
  }

  return (
    <div className="rga-longfield">
      <div className="rga-longfield-head">
        <label className="rga-label" htmlFor={view === "preview" ? undefined : `f-${col.name}`}>
          {col.label}
          <span className="rga-chars">{(value || "").length} caractères</span>
        </label>
        <div className="rga-view-toggle" role="tablist" aria-label={`Affichage — ${col.label}`}>
          <button
            type="button"
            role="tab"
            className={`rga-view-toggle-btn ${view === "edit" ? "is-active" : ""}`}
            aria-selected={view === "edit"}
            onClick={() => setView("edit")}
          >
            Édition
          </button>
          <button
            type="button"
            role="tab"
            className={`rga-view-toggle-btn ${view === "split" ? "is-active" : ""}`}
            aria-selected={view === "split"}
            onClick={() => setView("split")}
          >
            Côte à côte
          </button>
          <button
            type="button"
            role="tab"
            className={`rga-view-toggle-btn ${view === "preview" ? "is-active" : ""}`}
            aria-selected={view === "preview"}
            onClick={() => setView("preview")}
          >
            Aperçu
          </button>
        </div>
      </div>

      {view === "split" ? (
        <div className="rga-split">
          <div className="rga-split-pane">
            <div className="rga-pane-tag">Markdown — modifiable</div>
            {editor}
          </div>
          <div className="rga-split-pane">
            <div className="rga-pane-tag">Aperçu</div>
            {preview}
          </div>
        </div>
      ) : view === "edit" ? (
        editor
      ) : (
        preview
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Champ générique (courts)                                                   */
/* -------------------------------------------------------------------------- */
function Field({
  col,
  value,
  readOnly,
  onChange,
}: {
  col: Col;
  value: any;
  readOnly: boolean;
  onChange: (v: any) => void;
}) {
  if (col.kind === "bool") {
    return (
      <div className="rga-field rga-field-bool">
        <label className="rga-switch">
          <input
            type="checkbox"
            checked={!!value}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="rga-switch-track" />
          <span className="rga-switch-text">{col.label}</span>
        </label>
      </div>
    );
  }

  const type = col.kind === "date" ? "date" : col.kind === "int" ? "number" : "text";
  const v =
    col.kind === "date" && typeof value === "string" ? value.slice(0, 10) : value ?? "";

  return (
    <div className="rga-field">
      <label className="rga-label" htmlFor={`f-${col.name}`}>
        {col.label}
        {readOnly && <span className="rga-ro">lecture seule</span>}
      </label>
      <input
        id={`f-${col.name}`}
        className="rga-input"
        type={type}
        value={v}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Icônes                                                                     */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/* Styles (isolés sous .rga-) — charte Kerelia : blanc / noir / vert          */
/* -------------------------------------------------------------------------- */
const CSS = `
.rga-root{
  --ink:#111111; --paper:#ffffff; --panel:#fafafa; --rail:#111111;
  --line:#e8e8e8; --muted:#4b4b4b;
  --accent:#85e372; --accent-d:#289f01; --accent-soft:rgba(133,227,114,.14);
  --green:#289f01; --danger:#c0362c;
  --font-ui:"Kerelia Sans","Inter",-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  display:grid; grid-template-columns:200px 320px 1fr;
  height:100%; min-height:600px; color:var(--ink);
  font-family:var(--font-ui); font-weight:400; background:var(--paper);
  border:1px solid var(--line); border-radius:12px; overflow:hidden;
}
.rga-root *{box-sizing:border-box;}

/* rail (noir) */
.rga-rail{background:var(--rail); color:#d4d4d4; padding:18px 12px; display:flex; flex-direction:column; gap:4px;}
.rga-rail-head{font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#7a7a7a; padding:0 8px 12px;}
.rga-rail-item{display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; text-align:left; background:transparent; border:0; color:#d4d4d4; padding:10px 12px; border-radius:8px; font-size:14px; font-family:inherit; cursor:pointer; transition:background .12s,color .12s;}
.rga-rail-item:hover{background:rgba(255,255,255,.07); color:#fff;}
.rga-rail-item.is-active{background:var(--accent); color:#111; font-weight:600;}
.rga-rail-count{font-size:12px; background:rgba(0,0,0,.16); color:#111; border-radius:999px; padding:1px 8px;}

/* liste */
.rga-list{background:var(--panel); border-right:1px solid var(--line); display:flex; flex-direction:column; min-height:0;}
.rga-list-top{padding:14px; border-bottom:1px solid var(--line); display:flex; flex-direction:column; gap:10px;}
.rga-search{display:flex; align-items:center; gap:8px; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:8px 10px; color:var(--muted);}
.rga-search input{border:0; outline:0; flex:1; font-family:inherit; font-size:13px; color:var(--ink); background:transparent;}
.rga-new{background:var(--paper); border:1px solid var(--accent-d); color:var(--accent-d); font-family:inherit; font-weight:600; padding:8px; border-radius:8px; cursor:pointer; font-size:13px;}
.rga-new:hover{background:var(--accent-d); color:#fff;}
.rga-new:disabled{opacity:.5; cursor:default;}
.rga-list-body{overflow:auto; padding:8px; flex:1; min-height:0;}
.rga-row{display:flex; flex-direction:column; gap:2px; width:100%; text-align:left; background:transparent; border:0; border-radius:8px; padding:10px 12px; font-family:inherit; cursor:pointer; transition:background .1s;}
.rga-row:hover{background:#f0f0f0;}
.rga-row.is-selected{background:var(--paper); box-shadow:inset 3px 0 0 var(--accent-d);}
.rga-row-head{display:flex; align-items:center; gap:8px; min-width:0;}
.rga-row-primary{font-weight:600; font-size:14px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.rga-badge-todo{
  flex-shrink:0; font-size:10px; font-weight:700; letter-spacing:.02em;
  color:#8a4b00; background:#ffe8c8; border:1px solid #f5b84a;
  border-radius:999px; padding:2px 8px; line-height:1.3;
}
.rga-row-secondary{font-size:12px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.rga-empty,.rga-muted{color:var(--muted); font-size:13px; padding:16px; line-height:1.5;}

/* éditeur */
.rga-editor{display:flex; flex-direction:column; min-height:0; background:var(--paper);}
.rga-editor-empty{flex:1; display:grid; place-items:center; color:var(--muted);}
.rga-editor-empty-inner{text-align:center; line-height:1.6;}
.rga-editor-empty-inner svg{color:var(--line); margin-bottom:12px;}
.rga-editor-head{display:flex; align-items:flex-start; justify-content:space-between; padding:20px 28px; border-bottom:1px solid var(--line);}
.rga-editor-kicker{font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--accent-d); font-weight:600;}
.rga-editor-title{margin:4px 0 0; font-size:22px; font-weight:600; letter-spacing:-.01em;}
.rga-badge-dirty{align-self:center; font-size:12px; font-weight:600; color:#fff; background:#111; padding:4px 10px; border-radius:999px;}
.rga-editor-body{overflow:auto; padding:24px 28px; flex:1; min-height:0;}
.rga-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:20px;}
.rga-field{display:flex; flex-direction:column; gap:6px;}
.rga-field-bool{justify-content:flex-end;}
.rga-label{font-size:12px; font-weight:600; color:#2a2a2a; display:flex; align-items:baseline; gap:8px;}
.rga-ro,.rga-chars{font-weight:400; font-size:11px; color:var(--muted);}
.rga-chars{margin-left:auto;}
.rga-input{font-family:inherit; font-size:14px; padding:9px 11px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink); outline:0;}
.rga-input:focus{border-color:var(--accent-d); box-shadow:0 0 0 3px var(--accent-soft);}
.rga-input[readonly]{background:var(--panel); color:var(--muted);}

/* switch */
.rga-switch{display:flex; align-items:center; gap:10px; cursor:pointer; font-size:14px;}
.rga-switch input{position:absolute; opacity:0; width:0; height:0;}
.rga-switch-track{width:38px; height:22px; border-radius:999px; background:#cfcfcf; position:relative; transition:background .15s;}
.rga-switch-track::after{content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .15s; box-shadow:0 1px 2px rgba(0,0,0,.2);}
.rga-switch input:checked + .rga-switch-track{background:var(--accent-d);}
.rga-switch input:checked + .rga-switch-track::after{transform:translateX(16px);}
.rga-switch input:focus-visible + .rga-switch-track{box-shadow:0 0 0 3px var(--accent-soft);}

/* champ texte long */
.rga-longfield{margin-bottom:20px;}
.rga-longfield-head{display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; flex-wrap:wrap;}
.rga-longfield-head .rga-label{flex:1; min-width:0; margin:0;}
.rga-view-toggle{display:inline-flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; background:var(--panel); flex-shrink:0;}
.rga-view-toggle-btn{border:0; background:transparent; padding:6px 12px; font-family:inherit; font-size:12px; font-weight:500; color:var(--muted); cursor:pointer; transition:background .12s,color .12s;}
.rga-view-toggle-btn:hover{color:var(--ink); background:#f0f0f0;}
.rga-view-toggle-btn.is-active{background:var(--paper); color:var(--accent-d); font-weight:600; box-shadow:inset 0 0 0 1px var(--line);}

/* éditeur côte à côte */
.rga-split{display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:stretch;}
.rga-split-pane{display:flex; flex-direction:column; min-width:0;}
.rga-pane-tag{font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;}
.rga-split .rga-textarea,.rga-split .rga-markdown{flex:1;}

.rga-textarea{width:100%; font-family:inherit; font-size:14px; line-height:1.55; padding:12px 14px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink); outline:0; resize:vertical; min-height:120px;}
.rga-textarea:focus{border-color:var(--accent-d); box-shadow:0 0 0 3px var(--accent-soft);}
.rga-textarea[readonly]{background:var(--panel); color:var(--muted);}
.rga-textarea.is-reglement{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; line-height:1.65; min-height:340px;}

.rga-markdown{font-size:15px; line-height:1.7; color:var(--ink); padding:18px 20px; border:1px solid var(--line); border-radius:8px; background:var(--paper); min-height:120px; overflow:auto;}
.rga-markdown.is-reglement{background:linear-gradient(var(--accent),var(--accent)) 14px 0/3px 100% no-repeat, var(--paper); padding-left:26px; min-height:340px;}
.rga-markdown-empty{margin:0; color:var(--muted); font-style:italic;}
.rga-markdown > :first-child{margin-top:0;}
.rga-markdown > :last-child{margin-bottom:0;}
.rga-markdown p{margin:0 0 .85rem;}
.rga-markdown p:last-child{margin-bottom:0;}
.rga-markdown strong{font-weight:600;}
.rga-markdown em{font-style:italic;}
.rga-markdown ul,.rga-markdown ol{margin:.35rem 0 .85rem; padding-left:1.35rem;}
.rga-markdown li{margin:.35rem 0;}
.rga-markdown li::marker{color:var(--accent-d);}
.rga-markdown h1,.rga-markdown h2,.rga-markdown h3{font-weight:600; letter-spacing:-.02em; margin:1.1rem 0 .55rem; line-height:1.3;}
.rga-markdown h1{font-size:1.15rem;}
.rga-markdown h2{font-size:1.05rem;}
.rga-markdown h3{font-size:1rem;}
.rga-markdown code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.88em; background:var(--accent-soft); padding:.1em .35em; border-radius:.25rem;}
.rga-markdown pre{margin:.75rem 0; padding:.85rem 1rem; border-radius:.65rem; background:var(--panel); border:1px solid var(--line); overflow-x:auto;}
.rga-markdown pre code{background:none; padding:0;}
.rga-markdown blockquote{margin:.75rem 0; padding-left:.85rem; border-left:3px solid var(--accent-d); color:var(--muted);}
.rga-markdown hr{border:none; border-top:1px solid var(--line); margin:1rem 0;}
.rga-markdown a{color:var(--accent-d); text-decoration:underline; text-underline-offset:2px;}
.rga-markdown a:hover{color:var(--ink);}
.rga-markdown-table-wrap{margin:.85rem 0; overflow-x:auto; border:1px solid var(--line); border-radius:.65rem; background:#fff;}
.rga-markdown table{width:100%; min-width:28rem; border-collapse:collapse; font-size:.9rem; line-height:1.45;}
.rga-markdown th,.rga-markdown td{padding:.55rem .75rem; text-align:left; vertical-align:top; border-bottom:1px solid var(--line);}
.rga-markdown th{font-weight:600; background:var(--panel); white-space:nowrap;}
.rga-markdown tr:last-child td{border-bottom:none;}
.rga-markdown tbody tr:hover td{background:var(--accent-soft);}

/* barre de sauvegarde */
.rga-savebar{display:flex; align-items:center; justify-content:space-between; padding:14px 28px; border-top:1px solid var(--line); background:var(--panel);}
.rga-savebar-status{font-size:12px; color:var(--muted);}
.rga-savebar-actions{display:flex; gap:10px;}
.rga-btn-primary{background:#111; color:#fff; border:0; padding:10px 18px; border-radius:8px; font-family:inherit; font-weight:600; font-size:14px; cursor:pointer; transition:background .12s;}
.rga-btn-primary:hover{background:var(--accent-d);}
.rga-btn-primary:disabled{opacity:.45; cursor:default;}
.rga-btn-primary:disabled:hover{background:#111;}
.rga-btn-danger{background:transparent; color:var(--danger); border:1px solid #e6c6c3; padding:10px 16px; border-radius:8px; font-family:inherit; font-weight:600; font-size:14px; cursor:pointer;}
.rga-btn-danger:hover{background:#fbeceb;}

/* toast */
.rga-toast{position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 20px; border-radius:10px; font-size:14px; font-weight:500; color:#fff; box-shadow:0 8px 24px rgba(0,0,0,.18); z-index:50;}
.rga-toast.is-ok{background:var(--accent-d);}
.rga-toast.is-error{background:var(--danger);}

:focus-visible{outline:2px solid var(--accent-d); outline-offset:2px;}

@media (max-width:1200px){
  .rga-split{grid-template-columns:1fr;}
}
@media (max-width:900px){
  .rga-root{grid-template-columns:1fr; grid-auto-rows:auto;}
  .rga-rail{flex-direction:row; overflow:auto;}
  .rga-list{border-right:0; border-bottom:1px solid var(--line); max-height:280px;}
}
@media (prefers-reduced-motion:reduce){
  .rga-root *{transition:none !important;}
}
`;
import { useEffect, useMemo, useState, type ComponentType, type ComponentProps } from "react";
import { Clock, MapPin, Search, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { type HistoryPipeline } from "../../tools/carto/HistoryPipelineCard";
import ProjectHistoryCard from "../left-sidebar/ProjectHistoryCard";
import "./CartoHistoryPanel.css";

/** Ligne renvoyée par GET /api/identite-fonciere/history/by_user */
export type IdentiteFonciereHistoryRow = {
  project_id: string;
  commune?: string | null;
  insee?: string | null;
  parcelle_label?: string | null;
  centroid?: { lon: number; lat: number } | string | null;
  carte_url?: string | null;
  pdf_url?: string | null;
  nb_intersections?: number | null;
  created_at?: string | null;
};

export type CartoHistoryPanelProps = {
  rows: HistoryPipeline[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onOpenProject: (slug: string) => void;
  onUpdateProject: (
    slug: string,
    payload: {
      cerfa_data: {
        demandeur?: string;
        numero_cu?: string;
        adresse_terrain?: {
          numero?: string;
          voie?: string;
          code_postal?: string;
          ville?: string;
        };
      };
    },
  ) => Promise<void>;
  onDeleteProject: (slug: string) => Promise<void>;
  onCreateNew?: () => void;
  identiteRows?: IdentiteFonciereHistoryRow[];
  selectedIdentiteProjectId?: string | null;
  onSelectIdentite?: (projectId: string) => void;
  historySidebarTab?: "cua" | "cif";
  onHistorySidebarTabChange?: (tab: "cua" | "cif") => void;
  onDeleteIdentiteProject?: (projectId: string) => Promise<void>;
  /** Affiché en en-tête ; filtrage API à brancher plus tard */
  communeSlug?: string;
  /** Carte projet personnalisée par commune (défaut : ProjectHistoryCard partagé) */
  ProjectCard?: ComponentType<ComponentProps<typeof ProjectHistoryCard>>;
  /** Intégré dans la barre gauche (sans titre dupliqué, layout compact) */
  variant?: "default" | "left";
};

function formatMonthGroupLabel(dateStr?: string | null): string {
  if (!dateStr) return "Date inconnue";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  } catch {
    return "Date inconnue";
  }
}

export default function CartoHistoryPanel({
  rows,
  selectedSlug,
  onSelect,
  onOpenProject,
  onUpdateProject,
  onDeleteProject,
  onCreateNew,
  identiteRows = [],
  selectedIdentiteProjectId = null,
  onSelectIdentite,
  historySidebarTab: controlledTab,
  onHistorySidebarTabChange,
  onDeleteIdentiteProject,
  communeSlug,
  ProjectCard = ProjectHistoryCard,
  variant = "default",
}: CartoHistoryPanelProps) {
  const isLeft = variant === "left";
  const [internalTab, setInternalTab] = useState<"cua" | "cif">("cua");
  const tabControlled =
    controlledTab !== undefined && typeof onHistorySidebarTabChange === "function";
  const productTab = tabControlled ? controlledTab! : internalTab;
  const setProductTab = (t: "cua" | "cif") => {
    if (tabControlled) onHistorySidebarTabChange!(t);
    else setInternalTab(t);
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [updatingSlug, setUpdatingSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [deletingIdentiteId, setDeletingIdentiteId] = useState<string | null>(null);
  const [openMonthGroups, setOpenMonthGroups] = useState<Record<string, boolean>>({});

  /** Par défaut : mois repliés */
  const isMonthGroupOpen = (key: string): boolean => {
    if (key in openMonthGroups) return Boolean(openMonthGroups[key]);
    return false;
  };

  const toggleMonthGroup = (key: string) => {
    setOpenMonthGroups((prev) => ({
      ...prev,
      [key]: !isMonthGroupOpen(key),
    }));
  };

  useEffect(() => {
    if (!selectedSlug) return;
    const row = rows.find((r) => r.slug === selectedSlug);
    if (!row) return;
    const monthKey = `cua:${formatMonthGroupLabel(row.created_at)}`;
    setOpenMonthGroups((prev) => ({ ...prev, [monthKey]: true }));
  }, [selectedSlug, rows]);

  useEffect(() => {
    if (!selectedSlug) return;
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-history-slug="${CSS.escape(selectedSlug)}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [selectedSlug, rows, openMonthGroups]);

  useEffect(() => {
    if (!selectedIdentiteProjectId) return;
    const row = identiteRows.find((r) => r.project_id === selectedIdentiteProjectId);
    if (!row) return;
    const monthKey = `cif:${formatMonthGroupLabel(row.created_at)}`;
    setOpenMonthGroups((prev) => ({ ...prev, [monthKey]: true }));
  }, [selectedIdentiteProjectId, identiteRows]);

  useEffect(() => {
    if (!selectedIdentiteProjectId) return;
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-identite-id="${CSS.escape(selectedIdentiteProjectId)}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [selectedIdentiteProjectId, identiteRows, openMonthGroups]);

  const { matched, others } = useMemo(() => {
    if (!searchTerm.trim()) {
      return { matched: rows, others: [] as HistoryPipeline[] };
    }
    const term = searchTerm.toLowerCase();
    const matches: HistoryPipeline[] = [];
    const rest: HistoryPipeline[] = [];
    for (const row of rows) {
      const numeroCu = row.cerfa_data?.numero_cu || "";
      const demandeur = row.cerfa_data?.demandeur || "";
      const adresse = row.cerfa_data?.adresse_terrain
        ? [
            row.cerfa_data.adresse_terrain.numero,
            row.cerfa_data.adresse_terrain.voie,
            row.cerfa_data.adresse_terrain.code_postal,
            row.cerfa_data.adresse_terrain.ville,
          ]
            .filter(Boolean)
            .join(" ")
        : "";
      const parcelles = row.cerfa_data?.parcelles?.length
        ? row.cerfa_data.parcelles
            .map((p) => `${(p.section || "").toUpperCase()} ${p.numero || ""}`.trim())
            .join(", ")
        : "";
      const haystack = `${numeroCu} ${demandeur} ${adresse} ${parcelles} ${row.creator_label || ""}`.toLowerCase();
      if (haystack.includes(term)) matches.push(row);
      else rest.push(row);
    }
    return { matched: matches, others: rest };
  }, [rows, searchTerm]);

  const filteredIdentite = useMemo(() => {
    if (!searchTerm.trim()) return identiteRows;
    const term = searchTerm.toLowerCase();
    return identiteRows.filter((r) => {
      const h = `${r.commune || ""} ${r.insee || ""} ${r.parcelle_label || ""} ${r.project_id}`.toLowerCase();
      return h.includes(term);
    });
  }, [identiteRows, searchTerm]);

  const groupedCua = useMemo(() => {
    const ordered = searchTerm.trim() ? matched : [...matched, ...others];
    const groups = new Map<string, HistoryPipeline[]>();
    for (const row of ordered) {
      const key = formatMonthGroupLabel(row.created_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries()).map(([month, items]) => ({ month, items }));
  }, [matched, others, searchTerm]);

  const groupedIdentite = useMemo(() => {
    const groups = new Map<string, IdentiteFonciereHistoryRow[]>();
    for (const row of filteredIdentite) {
      const key = formatMonthGroupLabel(row.created_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries()).map(([month, items]) => ({ month, items }));
  }, [filteredIdentite]);

  const getPill = (p: HistoryPipeline) => {
    const isSuccess = Boolean(p.qr_url || p.output_cua);
    if (isSuccess) {
      return { label: "✓", className: "bg-green-500/20 text-green-700" };
    }
    if (typeof p.suivi === "number") {
      return { label: `Étape ${p.suivi}`, className: "bg-[#d5e1e3] text-[#0b131f]/50" };
    }
    return { label: "—", className: "bg-[#d5e1e3] text-[#0b131f]/50" };
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className={`carto-history-panel${isLeft ? " carto-history-panel--left" : ""}`}>
      <div className="carto-history-panel__header">
        {!isLeft ? (
          <div className="carto-history-panel__title-row">
            <Clock className="w-4 h-4 text-slate-400" aria-hidden />
            <h2>Historique</h2>
            {communeSlug ? (
              <span className="carto-history-panel__commune">{communeSlug}</span>
            ) : null}
          </div>
        ) : communeSlug ? (
          <p className="carto-history-panel__commune carto-history-panel__commune--left">{communeSlug}</p>
        ) : null}

        <div className="carto-history-panel__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={productTab === "cua"}
            className={`carto-history-panel__tab${productTab === "cua" ? " carto-history-panel__tab--active" : ""}`}
            onClick={() => setProductTab("cua")}
          >
            Certificat URBA
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={productTab === "cif"}
            className={`carto-history-panel__tab${productTab === "cif" ? " carto-history-panel__tab--active" : ""}`}
            onClick={() => setProductTab("cif")}
          >
            Identité foncière
          </button>
        </div>

        <p className="carto-history-panel__meta">
          {productTab === "cua"
            ? `${rows.length} dossier${rows.length > 1 ? "s" : ""} Certificat URBA`
            : `${identiteRows.length} identité${identiteRows.length > 1 ? "s" : ""} foncière${identiteRows.length > 1 ? "s" : ""}`}
        </p>

        <label className="carto-history-panel__search-wrap">
          <Search className="carto-history-panel__search-icon" size={15} aria-hidden />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              productTab === "cua"
                ? "Rechercher un dossier…"
                : "Rechercher une identité…"
            }
            className="carto-history-panel__search"
            aria-label={
              productTab === "cua"
                ? "Rechercher un dossier dans l'historique"
                : "Rechercher une identité foncière dans l'historique"
            }
          />
        </label>
      </div>

      <div className="carto-history-panel__body">
        {productTab === "cua" ? (
          <>
            {onCreateNew ? (
              <button type="button" className="carto-history-panel__new-btn" onClick={() => onCreateNew()}>
                + Nouveau dossier
              </button>
            ) : null}

            {rows.length === 0 ? (
              <p className="carto-history-panel__empty">Aucun dossier</p>
            ) : groupedCua.length === 0 && searchTerm.trim() ? (
              <p className="carto-history-panel__empty">Aucun résultat pour « {searchTerm} »</p>
            ) : (
              <div className="carto-history-panel__list">
                {groupedCua.map((group) => (
                  <div key={group.month}>
                    <button
                      type="button"
                      className="carto-history-panel__month-btn"
                      onClick={() => toggleMonthGroup(`cua:${group.month}`)}
                      aria-expanded={isMonthGroupOpen(`cua:${group.month}`)}
                    >
                      <span>
                        {group.month}
                        <span style={{ opacity: 0.6, marginLeft: 6 }}>({group.items.length})</span>
                      </span>
                      {isMonthGroupOpen(`cua:${group.month}`) ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {isMonthGroupOpen(`cua:${group.month}`) &&
                      group.items.map((row) => {
                        const isSelected = selectedSlug === row.slug;
                        const pill = getPill(row);
                        return (
                          <div
                            key={row.slug}
                            data-history-slug={row.slug}
                            className={`cua-history-card${isSelected ? " cua-history-card--selected" : ""}`}
                          >
                            <ProjectCard
                              row={row}
                              isSelected={isSelected}
                              pill={pill}
                              formattedDate={formatDate(row.created_at)}
                              onSelect={() => onSelect(row.slug)}
                              onOpenProject={() => onOpenProject(row.slug)}
                              onUpdate={async (slug, payload) => {
                                setUpdatingSlug(slug);
                                try {
                                  await onUpdateProject(slug, payload);
                                } finally {
                                  setUpdatingSlug(null);
                                }
                              }}
                              onDelete={async (slug) => {
                                setDeletingSlug(slug);
                                try {
                                  await onDeleteProject(slug);
                                } finally {
                                  setDeletingSlug(null);
                                }
                              }}
                              isUpdating={updatingSlug === row.slug}
                              isDeleting={deletingSlug === row.slug}
                            />
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="carto-history-panel__list">
            {identiteRows.length === 0 ? (
              <p className="carto-history-panel__empty">
                Aucune carte d&apos;identité enregistrée. Générez une UF sur la carte, puis laissez l&apos;analyse se
                terminer.
              </p>
            ) : groupedIdentite.length === 0 && searchTerm.trim() ? (
              <p className="carto-history-panel__empty">Aucun résultat pour « {searchTerm} »</p>
            ) : (
              groupedIdentite.map((group) => (
                <div key={group.month}>
                  <button
                    type="button"
                    className="carto-history-panel__month-btn"
                    onClick={() => toggleMonthGroup(`cif:${group.month}`)}
                    aria-expanded={isMonthGroupOpen(`cif:${group.month}`)}
                  >
                    <span>
                      {group.month}
                      <span style={{ opacity: 0.6, marginLeft: 6 }}>({group.items.length})</span>
                    </span>
                    {isMonthGroupOpen(`cif:${group.month}`) ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {isMonthGroupOpen(`cif:${group.month}`) &&
                    group.items.map((r) => {
                      const isSel = selectedIdentiteProjectId === r.project_id;
                      return (
                        <div
                          key={r.project_id}
                          data-identite-id={r.project_id}
                          className={`identite-row${isSel ? " identite-row--selected" : ""}`}
                        >
                          <div className="flex items-stretch gap-0">
                            <button
                              type="button"
                              onClick={() => onSelectIdentite?.(r.project_id)}
                              className="flex-1 text-left p-3 min-w-0"
                            >
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-violet-400" />
                                <div className="flex-1 min-w-0">
                                  <div className="identite-row__title truncate">
                                    {r.parcelle_label || "Unité foncière"}
                                  </div>
                                  <div className="identite-row__date">{formatDate(r.created_at)}</div>
                                </div>
                              </div>
                            </button>
                            {onDeleteIdentiteProject ? (
                              <button
                                type="button"
                                title="Supprimer de l'historique"
                                disabled={deletingIdentiteId === r.project_id}
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const ok = window.confirm(
                                    "Supprimer cette identité foncière ? Les fichiers seront retirés du stockage.",
                                  );
                                  if (!ok) return;
                                  setDeletingIdentiteId(r.project_id);
                                  try {
                                    await onDeleteIdentiteProject(r.project_id);
                                  } catch (err: unknown) {
                                    const msg =
                                      err instanceof Error ? err.message : "Échec de la suppression";
                                    window.alert(msg);
                                  } finally {
                                    setDeletingIdentiteId(null);
                                  }
                                }}
                                className="shrink-0 px-2 flex items-center justify-center text-slate-500 hover:text-red-400 disabled:opacity-40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                          </div>
                          {isSel && (r.carte_url || r.pdf_url) && (
                            <div className="px-3 pb-3 flex gap-2">
                              {r.pdf_url ? (
                                <a
                                  href={r.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                                >
                                  PDF
                                </a>
                              ) : null}
                              {r.carte_url ? (
                                <a
                                  href={r.carte_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 text-center text-xs font-medium py-2 rounded-lg border border-violet-500/50 text-violet-200 hover:bg-violet-500/10"
                                >
                                  Carte
                                </a>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

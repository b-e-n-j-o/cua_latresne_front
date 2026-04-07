import { useMemo, useState } from "react";
import { Menu, X, Clock, MapPin, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type HistoryPipeline } from "../../components/tools/carto/HistoryPipelineCard";
import ProjectHistoryCard from "./ProjectHistoryCard";

/** Ligne renvoyée par GET /api/identite-fonciere/history/by_user (schéma Supabase). */
export type IdentiteFonciereHistoryRow = {
  project_id: string;
  commune?: string | null;
  insee?: string | null;
  parcelle_label?: string | null;
  /** Objet ou chaîne JSON (retour Supabase) */
  centroid?: { lon: number; lat: number } | string | null;
  carte_url?: string | null;
  pdf_url?: string | null;
  nb_intersections?: number | null;
  created_at?: string | null;
};

interface HistorySidebarProps {
  rows: HistoryPipeline[];
  isOpen: boolean;
  onToggle: () => void;
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
    }
  ) => Promise<void>;
  onDeleteProject: (slug: string) => Promise<void>;
  onCreateNew?: () => void;
  /** Onglet « identités foncières » : publications POST /publier avec user_id. */
  identiteRows?: IdentiteFonciereHistoryRow[];
  selectedIdentiteProjectId?: string | null;
  onSelectIdentite?: (projectId: string) => void;
  /** Contrôle parent (ex. synchro pings carte CUA / CIF). */
  historySidebarTab?: "cua" | "cif";
  onHistorySidebarTabChange?: (tab: "cua" | "cif") => void;
  /** Suppression CIF (API : base + Storage). */
  onDeleteIdentiteProject?: (projectId: string) => Promise<void>;
}

export default function HistorySidebar({
  rows,
  isOpen,
  onToggle,
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
}: HistorySidebarProps) {
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
      const parcelles =
        row.cerfa_data?.parcelles?.length
          ? row.cerfa_data.parcelles
              .map((p) => `${(p.section || "").toUpperCase()} ${p.numero || ""}`.trim())
              .join(", ")
          : "";

      const haystack = `${numeroCu} ${demandeur} ${adresse} ${parcelles}`.toLowerCase();

      if (haystack.includes(term)) {
        matches.push(row);
      } else {
        rest.push(row);
      }
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
      const d = new Date(dateStr);
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return String(dateStr);
    }
  };

  const tabBtn = (active: boolean) =>
    `flex-1 text-xs font-medium py-1.5 rounded transition ${
      active ? "bg-[#0b131f] text-white" : "text-[#0b131f]/70 hover:bg-[#d5e1e3]/30"
    }`;

  return (
    <>
      <button
        onClick={onToggle}
        className={`fixed top-16 right-4 z-50 p-1.5 bg-white rounded-lg transition-all ${
          isOpen ? "border border-[#d5e1e3]/80 hover:bg-[#d5e1e3]/20" : "border border-[#d5e1e3] hover:bg-[#d5e1e3]/20"
        }`}
        aria-label="Toggle history"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-[#0b131f]" />
        ) : (
          <Menu className="w-5 h-5 text-[#0b131f]" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 lg:hidden"
            />

            <motion.aside
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-14 right-0 bottom-0 w-80 bg-white border-l border-[#d5e1e3] z-40 overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-[#d5e1e3]">
                <div className="flex items-center gap-2 text-[#0b131f]">
                  <Clock className="w-4 h-4" />
                  <h2 className="text-sm font-semibold">Historique</h2>
                </div>

                <div className="flex gap-1 mt-3 p-0.5 rounded-lg bg-[#f4f6f8] border border-[#d5e1e3]">
                  <button type="button" className={tabBtn(productTab === "cua")} onClick={() => setProductTab("cua")}>
                    CUA
                  </button>
                  <button type="button" className={tabBtn(productTab === "cif")} onClick={() => setProductTab("cif")}>
                    CIF
                  </button>
                </div>

                <p className="text-xs text-[#0b131f]/60 mt-2">
                  {productTab === "cua"
                    ? `${rows.length} dossier${rows.length > 1 ? "s" : ""} CUA`
                    : `${identiteRows.length} identité${identiteRows.length > 1 ? "s" : ""} foncière${identiteRows.length > 1 ? "s" : ""}`}
                </p>
                <div className="mt-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={
                      productTab === "cua"
                        ? "Rechercher (CU, demandeur, adresse, parcelles)…"
                        : "Rechercher (parcelles, id…)…"
                    }
                    className="w-full px-2 py-1 text-xs border border-[#d5e1e3] rounded-md focus:outline-none focus:ring-1 focus:ring-[#0b131f]/40"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {productTab === "cua" ? (
                  <>
                    <div className="p-4">
                      <button
                        onClick={() => onCreateNew?.()}
                        className="flex items-center gap-2 px-3 py-2 mb-4 text-sm bg-[#0b131f] text-white rounded-lg hover:bg-[#0b131f]/90 transition w-full"
                      >
                        + Nouveau dossier
                      </button>
                    </div>
                    {rows.length === 0 ? (
                      <div className="p-4 text-center text-[#0b131f]/40 text-sm">Aucun dossier</div>
                    ) : (
                      <div className="p-2">
                        {[...matched, ...others].map((row) => {
                          const isSelected = selectedSlug === row.slug;
                          const pill = getPill(row);
                          return (
                            <ProjectHistoryCard
                              key={row.slug}
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
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-2">
                    {identiteRows.length === 0 ? (
                      <div className="p-4 text-center text-[#0b131f]/40 text-sm leading-relaxed">
                        Aucune carte d&apos;identité enregistrée pour votre compte. Générez une UF sur la carte, puis
                        laissez l&apos;analyse se terminer (publication automatique carte + PDF).
                      </div>
                    ) : (
                      filteredIdentite.map((r) => {
                        const isSel = selectedIdentiteProjectId === r.project_id;
                        return (
                          <div
                            key={r.project_id}
                            className={`mb-2 rounded-lg border transition-all ${
                              isSel ? "border-violet-400 bg-violet-50/50" : "border-transparent hover:bg-[#d5e1e3]/15"
                            }`}
                          >
                            <div className="flex items-stretch gap-0">
                              <button
                                type="button"
                                onClick={() => onSelectIdentite?.(r.project_id)}
                                className="flex-1 text-left p-3 min-w-0"
                              >
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-violet-600/80" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-black truncate">
                                      {r.parcelle_label || "Unité foncière"}
                                    </div>
                                    <div className="text-xs text-[#0b131f]/40 mt-0.5">{formatDate(r.created_at)}</div>
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
                                      "Supprimer cette identité foncière ? Les fichiers (carte, PDF) seront retirés du stockage."
                                    );
                                    if (!ok) return;
                                    setDeletingIdentiteId(r.project_id);
                                    try {
                                      await onDeleteIdentiteProject(r.project_id);
                                    } catch (err: unknown) {
                                      const msg = err instanceof Error ? err.message : "Échec de la suppression";
                                      window.alert(msg);
                                    } finally {
                                      setDeletingIdentiteId(null);
                                    }
                                  }}
                                  className="shrink-0 px-2 flex items-center justify-center text-[#0b131f]/35 hover:text-red-600 hover:bg-red-50/80 disabled:opacity-40 border-l border-transparent hover:border-red-100"
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
                                    className="flex-1 text-center text-xs font-medium py-2 rounded-md bg-violet-700 text-white hover:bg-violet-800 transition-colors"
                                  >
                                    PDF
                                  </a>
                                ) : null}
                                {r.carte_url ? (
                                  <a
                                    href={r.carte_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-center text-xs font-medium py-2 rounded-md border border-violet-300 text-violet-800 bg-white hover:bg-violet-50 transition-colors"
                                  >
                                    Carte
                                  </a>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

import { useMemo, useState } from "react";
import { Menu, X, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import HistoryPipelineCard, { type HistoryPipeline } from "../../components/tools/carto/HistoryPipelineCard";
import ProjectHistoryCard from "./ProjectHistoryCard";

interface HistorySidebarProps {
  rows: HistoryPipeline[];
  isOpen: boolean;
  onToggle: () => void;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onClearSelection: () => void;
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
}

export default function HistorySidebar({
  rows,
  isOpen,
  onToggle,
  selectedSlug,
  onSelect,
  onClearSelection,
  onUpdateProject,
  onDeleteProject,
  onCreateNew,
}: HistorySidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingSlug, setUpdatingSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

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

  const selectedPipeline = useMemo(() => {
    if (!selectedSlug) return null;
    return rows.find((r) => r.slug === selectedSlug) ?? null;
  }, [rows, selectedSlug]);

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

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
                <p className="text-xs text-[#0b131f]/60 mt-1">
                  {rows.length} dossier{rows.length > 1 ? "s" : ""}
                </p>
                <div className="mt-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher (CU, demandeur, adresse, parcelles)…"
                    className="w-full px-2 py-1 text-xs border border-[#d5e1e3] rounded-md focus:outline-none focus:ring-1 focus:ring-[#0b131f]/40"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4">
                    <button
                      onClick={() => onCreateNew?.()}
                      className="flex items-center gap-2 px-3 py-2 mb-4 text-sm bg-[#0b131f] text-white rounded-lg hover:bg-[#0b131f]/90 transition w-full"
                    >
                      + Nouveau dossier
                    </button>
                  </div>
                  {rows.length === 0 ? (
                    <div className="p-4 text-center text-[#0b131f]/40 text-sm">
                      Aucun dossier
                    </div>
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
                </div>

                <div className="border-t border-[#d5e1e3] p-3 bg-white">
                  {selectedPipeline ? (
                    <HistoryPipelineCard
                      pipeline={selectedPipeline}
                      onClose={onClearSelection}
                      embedded={false}
                      mapPopup
                    />
                  ) : (
                    <div className="text-xs text-[#0b131f]/40 text-center py-6">
                      Sélectionnez un dossier pour voir ses références
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
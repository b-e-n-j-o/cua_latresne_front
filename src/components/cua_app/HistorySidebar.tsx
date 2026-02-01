import { useState, useMemo } from "react";
import { Menu, X, FileText, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PipelineRow {
  slug: string;
  created_at?: string;
  status: string;

  // URLs
  qr_url?: string;
  output_cua?: string;
  carte_2d_url?: string;
  carte_3d_url?: string;
  maps_page?: string;

  // ➕ NOUVELLES DONNÉES CERFA
  cerfa_data?: {
    numero_cu?: string;
    date_depot?: string;
    demandeur?: string;
    adresse_terrain?: {
      numero?: string;
      voie?: string;
      code_postal?: string;
      ville?: string;
    };
  };
  // ➕ Nouvelles parcelles historisées (colonne JSONB en base)
  parcelles?: {
    section?: string;
    numero?: string;
  }[];
}

interface HistorySidebarProps {
  rows: PipelineRow[];
  isOpen: boolean;
  onToggle: () => void;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onCreateNew?: () => void;
}

export default function HistorySidebar({
  rows,
  isOpen,
  onToggle,
  selectedSlug,
  onSelect,
  onCreateNew,
}: HistorySidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { matched, others } = useMemo(() => {
    if (!searchTerm.trim()) {
      return { matched: rows, others: [] as PipelineRow[] };
    }

    const term = searchTerm.toLowerCase();

    const matches: PipelineRow[] = [];
    const rest: PipelineRow[] = [];

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
      const parcelles = row.parcelles
        ? row.parcelles
            .map(
              (p) => `${(p.section || "").toUpperCase()} ${p.numero || ""}`.trim()
            )
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

  return (
    <>
      <button
        onClick={onToggle}
        className={`fixed top-16 z-50 p-2.5 bg-white rounded-xl hover:bg-[#d5e1e3]/20 transition-all ${
          isOpen ? "left-[260px] border-0" : "left-4 border border-[#d5e1e3]" 
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
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-14 left-0 bottom-0 w-80 bg-white border-r border-[#d5e1e3] z-40 overflow-hidden flex flex-col"
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
                      
                      // Formatage de la date (date de run du pipeline)
                      const formatDate = (dateStr?: string) => {
                        if (!dateStr) return "—";
                        try {
                          const d = new Date(dateStr);
                          return d.toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });
                        } catch {
                          return dateStr;
                        }
                      };
                      
                      return (
                        <button
                          key={row.slug}
                          onClick={() => onSelect(row.slug)}
                          className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                            isSelected
                              ? "bg-[#d5e1e3]/50 border border-[#d5e1e3]"
                              : "hover:bg-[#d5e1e3]/20 border border-transparent"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <FileText
                              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                isSelected ? "text-[#0b131f]" : "text-[#0b131f]/40"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-sm font-medium truncate ${
                                  isSelected ? "text-[#0b131f]" : "text-[#0b131f]/80"
                                }`}
                              >
                                {row.cerfa_data?.numero_cu || "Certificat d'urbanisme"}
                              </div>
                              <div className="text-xs text-[#0b131f]/40 mt-0.5">
                                Généré le : {formatDate(row.created_at)}
                              </div>
                              <div className="text-xs text-[#0b131f]/40 mt-0.5 truncate">
                                Demandeur : {row.cerfa_data?.demandeur || "—"}
                              </div>
                              <div className="text-xs text-[#0b131f]/40 truncate">
                                {row.cerfa_data?.adresse_terrain
                                  ? [
                                      row.cerfa_data.adresse_terrain.numero,
                                      row.cerfa_data.adresse_terrain.voie,
                                      row.cerfa_data.adresse_terrain.code_postal,
                                      row.cerfa_data.adresse_terrain.ville
                                    ].filter(Boolean).join(" ").trim() || "Adresse : —"
                                  : "Adresse : —"}
                              </div>
                              {row.parcelles && row.parcelles.length > 0 && (
                                <div className="text-xs text-[#0b131f]/40 truncate mt-0.5">
                                  Parcelles :{" "}
                                  {row.parcelles
                                    .map((p) => `${(p.section || "").toUpperCase()} ${p.numero || ""}`.trim())
                                    .join(", ")}
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                row.status === "success"
                                  ? "bg-green-500/20 text-green-700"
                                  : row.status === "error"
                                  ? "bg-red-500/20 text-red-700"
                                  : "bg-[#d5e1e3] text-[#0b131f]/50"
                              }`}
                            >
                              {row.status === "success" ? "✓" : row.status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
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
import { useState } from "react";
import { FileText, Pencil, Save, Trash2, X } from "lucide-react";
import HistoryPipelineCard, { type HistoryPipeline } from "../../components/tools/carto/HistoryPipelineCard";

type EditablePayload = {
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
};

type Props = {
  row: HistoryPipeline;
  isSelected: boolean;
  pill: { label: string; className: string };
  formattedDate: string;
  onSelect: () => void;
  onOpenProject: () => void;
  onUpdate: (slug: string, payload: EditablePayload) => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
};

export default function ProjectHistoryCard({
  row,
  isSelected,
  pill,
  formattedDate,
  onSelect,
  onOpenProject,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [demandeur, setDemandeur] = useState(row.cerfa_data?.demandeur || "");
  const [numeroCu, setNumeroCu] = useState(row.cerfa_data?.numero_cu || "");
  const [adrNumero, setAdrNumero] = useState(row.cerfa_data?.adresse_terrain?.numero || "");
  const [adrVoie, setAdrVoie] = useState(row.cerfa_data?.adresse_terrain?.voie || "");
  const [adrCp, setAdrCp] = useState(row.cerfa_data?.adresse_terrain?.code_postal || "");
  const [adrVille, setAdrVille] = useState(row.cerfa_data?.adresse_terrain?.ville || "");
  const [localError, setLocalError] = useState<string | null>(null);

  const onCancelEdit = () => {
    setIsEditing(false);
    setLocalError(null);
    setDemandeur(row.cerfa_data?.demandeur || "");
    setNumeroCu(row.cerfa_data?.numero_cu || "");
    setAdrNumero(row.cerfa_data?.adresse_terrain?.numero || "");
    setAdrVoie(row.cerfa_data?.adresse_terrain?.voie || "");
    setAdrCp(row.cerfa_data?.adresse_terrain?.code_postal || "");
    setAdrVille(row.cerfa_data?.adresse_terrain?.ville || "");
  };

  const onSaveEdit = async () => {
    setLocalError(null);
    try {
      await onUpdate(row.slug, {
        cerfa_data: {
          demandeur,
          numero_cu: numeroCu,
          adresse_terrain: {
            numero: adrNumero,
            voie: adrVoie,
            code_postal: adrCp,
            ville: adrVille,
          },
        },
      });
      setIsEditing(false);
    } catch (e: any) {
      setLocalError(e?.message || "Erreur de sauvegarde");
    }
  };

  const onDeleteClick = async () => {
    const ok = window.confirm("Supprimer ce projet de l'historique ?");
    if (!ok) return;
    setLocalError(null);
    try {
      await onDelete(row.slug);
    } catch (e: any) {
      setLocalError(e?.message || "Erreur de suppression");
    }
  };

  return (
    <div
      className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
        isSelected ? "bg-[#d5e1e3]/50 border border-[#d5e1e3]" : "hover:bg-[#d5e1e3]/20 border border-transparent"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start gap-2">
          <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? "text-[#0b131f]" : "text-[#0b131f]/40"}`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-black truncate">
              {row.cerfa_data?.demandeur || "Demandeur inconnu"}
            </div>
            <div className="text-xs text-[#0b131f]/60 mt-0.5 truncate">
              Dossier : {row.cerfa_data?.numero_cu || "Certificat d'urbanisme"}
            </div>
            <div className="text-xs text-[#0b131f]/40 mt-0.5">
              Genere le : {formattedDate}
            </div>
            <div className="text-xs text-[#0b131f]/40 truncate">
              {row.cerfa_data?.adresse_terrain
                ? [
                    row.cerfa_data.adresse_terrain.numero,
                    row.cerfa_data.adresse_terrain.voie,
                    row.cerfa_data.adresse_terrain.code_postal,
                    row.cerfa_data.adresse_terrain.ville,
                  ]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || "Adresse : -"
                : "Adresse : -"}
            </div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${pill.className}`}>
            {pill.label}
          </span>
        </div>
      </button>

      {isSelected && (
        <div className="mt-2 pt-2 border-t border-[#d5e1e3]">
          {!isEditing ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={onOpenProject}
                className="w-full inline-flex items-center justify-center gap-1 text-xs px-2 py-2 rounded bg-teal-600 hover:bg-teal-700 text-white transition-colors"
              >
                Consulter le projet
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border border-[#d5e1e3] hover:bg-white"
                >
                  <Pencil className="w-3 h-3" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={onDeleteClick}
                  disabled={isDeleting}
                  className="inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="w-3 h-3" />
                  {isDeleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={demandeur}
                onChange={(e) => setDemandeur(e.target.value)}
                placeholder="Demandeur"
                className="w-full px-2 py-1 text-xs border border-[#d5e1e3] rounded"
              />
              <input
                value={numeroCu}
                onChange={(e) => setNumeroCu(e.target.value)}
                placeholder="Numero de dossier"
                className="w-full px-2 py-1 text-xs border border-[#d5e1e3] rounded"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={adrNumero}
                  onChange={(e) => setAdrNumero(e.target.value)}
                  placeholder="N°"
                  className="px-2 py-1 text-xs border border-[#d5e1e3] rounded"
                />
                <input
                  value={adrVoie}
                  onChange={(e) => setAdrVoie(e.target.value)}
                  placeholder="Voie"
                  className="px-2 py-1 text-xs border border-[#d5e1e3] rounded"
                />
                <input
                  value={adrCp}
                  onChange={(e) => setAdrCp(e.target.value)}
                  placeholder="Code postal"
                  className="px-2 py-1 text-xs border border-[#d5e1e3] rounded"
                />
                <input
                  value={adrVille}
                  onChange={(e) => setAdrVille(e.target.value)}
                  placeholder="Ville"
                  className="px-2 py-1 text-xs border border-[#d5e1e3] rounded"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSaveEdit}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#0b131f] text-white disabled:opacity-60"
                >
                  <Save className="w-3 h-3" />
                  {isUpdating ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#d5e1e3]"
                >
                  <X className="w-3 h-3" />
                  Annuler
                </button>
              </div>
            </div>
          )}

          {localError && <div className="mt-2 text-[11px] text-red-600">{localError}</div>}

          {!isEditing && !localError && (
            <div className="mt-3">
              <HistoryPipelineCard
                pipeline={row}
                onClose={() => {}}
                embedded={true}
                hideActions
                hideClose
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


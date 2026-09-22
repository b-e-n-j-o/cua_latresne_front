import type { MouseEvent } from "react";
import { ChevronDown, ChevronRight, FileText, Trash2 } from "lucide-react";
import { type HistoryPipeline } from "../tools/HistoryPipelineCard";
import { getCerfaParcelleRefs } from "../history/cerfaParcelleRefs";
import {
  formatValidityEndLabel,
  getExpirationProgress,
  resolveHistoryCarteUrl,
  resolveHistoryCuaViewerPath,
} from "../history/historyPipelineLinks";
import SuiviInstructionCard from "../tools/SuiviInstructionCard";

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
  onSuiviChange?: (slug: string, suivi: number) => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
};

export default function ProjectHistoryCard({
  row,
  isSelected,
  formattedDate,
  onSelect,
  onDelete,
  onSuiviChange,
  isDeleting,
}: Props) {
  const parcelleRefs = getCerfaParcelleRefs(row.cerfa_data);
  const numeroCu = row.cerfa_data?.numero_cu?.trim();
  const demandeur = row.cerfa_data?.demandeur?.trim();
  const title = numeroCu || demandeur || "Certificat d'urbanisme";
  const metaParts = [
    numeroCu && demandeur ? demandeur : null,
    formattedDate !== "—" ? formattedDate : null,
  ].filter(Boolean);

  const expiration = getExpirationProgress(row.created_at);
  const validityLabel = formatValidityEndLabel(row.created_at);
  const cuaViewerPath = resolveHistoryCuaViewerPath(row);
  const carteUrl = resolveHistoryCarteUrl(row);

  const onDeleteClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = window.confirm("Supprimer ce projet de l'historique ?");
    if (!ok) return;
    try {
      await onDelete(row.slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de suppression";
      window.alert(msg);
    }
  };

  return (
    <div
      className={`cua-history-row-wrap${isSelected ? " cua-history-row-wrap--expanded" : ""}`}
    >
      <div className={`cua-history-row${isSelected ? " cua-history-row--selected" : ""}`}>
        <button
          type="button"
          onClick={onSelect}
          className="cua-history-row__main"
          aria-expanded={isSelected}
          title={isSelected ? "Replier le dossier" : "Afficher le dossier"}
        >
          <FileText className="cua-history-row__icon" size={15} aria-hidden />
          <span className="cua-history-row__text">
            <span className="cua-history-row__title">{title}</span>
            {metaParts.length > 0 ? (
              <span className="cua-history-row__meta">{metaParts.join(" · ")}</span>
            ) : null}
          </span>
          {isSelected ? (
            <ChevronDown className="cua-history-row__chevron" size={14} aria-hidden />
          ) : (
            <ChevronRight className="cua-history-row__chevron" size={14} aria-hidden />
          )}
        </button>
        <button
          type="button"
          className="cua-history-row__delete"
          title="Supprimer de l'historique"
          disabled={isDeleting}
          onClick={onDeleteClick}
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>

      {isSelected ? (
        <div className="cua-history-row__detail">
          <div className="cua-history-row__detail-field">
            <span className="cua-history-row__detail-label">Demandeur</span>
            <span className="cua-history-row__detail-value">{demandeur || "—"}</span>
          </div>

          {parcelleRefs.length > 0 ? (
            <div className="cua-history-row__parcelles">
              <span className="cua-history-row__detail-label">
                Parcelles ({parcelleRefs.length})
              </span>
              <div className="cua-history-row__parcelle-chips">
                {parcelleRefs.map((p, i) => {
                  const refLabel = `${String(p.section ?? "").trim().toUpperCase()} ${String(p.numero ?? "").trim()}`.trim();
                  return (
                    <span key={`${refLabel}-${i}`} className="cua-history-row__parcelle-chip">
                      {refLabel || "—"}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {expiration && validityLabel ? (
            <div className="cua-history-row__validity">
              <div className="cua-history-row__validity-head">
                <span>Validité 18 mois</span>
                <span
                  className={
                    expiration.isExpired
                      ? "cua-history-row__validity-badge cua-history-row__validity-badge--expired"
                      : "cua-history-row__validity-badge"
                  }
                >
                  {validityLabel}
                </span>
              </div>
              <div className="cua-history-row__validity-track">
                <div
                  className={`cua-history-row__validity-fill${
                    expiration.isExpired
                      ? " cua-history-row__validity-fill--expired"
                      : expiration.progress > 80
                        ? " cua-history-row__validity-fill--warning"
                        : ""
                  }`}
                  style={{ width: `${Math.min(100, expiration.progress)}%` }}
                />
              </div>
            </div>
          ) : null}

          {onSuiviChange ? (
            <SuiviInstructionCard
              embedded
              pipeline={row}
              onSuiviChange={(suivi) => {
                void onSuiviChange(row.slug, suivi);
              }}
            />
          ) : null}

          <div className="cua-history-row__actions">
            {cuaViewerPath ? (
              <a
                href={cuaViewerPath}
                target="_blank"
                rel="noopener noreferrer"
                className="cua-history-row__action cua-history-row__action--primary"
                onClick={(e) => e.stopPropagation()}
              >
                Voir CUA
              </a>
            ) : null}
            {carteUrl ? (
              <a
                href={carteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cua-history-row__action cua-history-row__action--secondary"
                onClick={(e) => e.stopPropagation()}
              >
                Carte
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

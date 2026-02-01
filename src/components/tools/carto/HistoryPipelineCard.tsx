import { MapPin, FileText, Calendar, User, ExternalLink } from "lucide-react";

export type CerfaData = {
  demandeur?: string;
  numero_cu?: string;
  parcelles?: Array<{ section: string; numero: string; surface_m2?: number | null }>;
  date_depot?: string;
  superficie?: number;
  commune_nom?: string;
  commune_insee?: string;
  adresse_terrain?: {
    voie?: string;
    ville?: string;
    numero?: string;
    lieu_dit?: string;
    code_postal?: string;
  };
};

export type HistoryPipeline = {
  slug: string;
  centroid?: { lon: number; lat: number };
  cerfa_data?: CerfaData | null;
  commune?: string;
  code_insee?: string;
  output_cua?: string;
  qr_url?: string;
  created_at?: string;
  /** Étape de suivi : 1=Dossier reçu, 2=Dossier traité, 3=Validé/corrigé, 4=CUA délivré */
  suivi?: number;
};

type Props = {
  pipeline: HistoryPipeline;
  onClose: () => void;
  embedded?: boolean;
  mapPopup?: boolean;
};

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatAdresse(adr: CerfaData["adresse_terrain"] | undefined): string {
  if (!adr) return "—";
  const parts = [
    adr.numero,
    adr.voie,
    adr.lieu_dit,
    adr.code_postal,
    adr.ville,
  ].filter(Boolean);
  return parts.join(", ") || "—";
}

/** Retourne { progress: 0-100, isExpired } pour une validité de 18 mois */
function getExpirationProgress(createdAt: string | undefined): { progress: number; isExpired: boolean } | null {
  if (!createdAt) return null;
  try {
    const created = new Date(createdAt);
    const expiry = new Date(created);
    expiry.setMonth(expiry.getMonth() + 18);
    const now = new Date();
    if (now <= created) return { progress: 0, isExpired: false };
    if (now >= expiry) return { progress: 100, isExpired: true };
    const total = expiry.getTime() - created.getTime();
    const elapsed = now.getTime() - created.getTime();
    return { progress: (elapsed / total) * 100, isExpired: false };
  } catch {
    return null;
  }
}

export default function HistoryPipelineCard({
  pipeline,
  onClose,
  embedded = false,
  mapPopup = false,
}: Props) {
  const cerfa = pipeline.cerfa_data;

  const containerClass = [
    "bg-white rounded-lg overflow-y-auto border border-teal-200",
    mapPopup ? "p-3 max-h-[50vh] w-80 shadow-xl ring-1 ring-black/5" : "p-4 max-h-[70vh] shadow-lg",
    embedded ? "w-full" : !mapPopup ? "w-80" : "",
  ].join(" ");

  const contentSpacing = mapPopup ? "space-y-2" : "space-y-3";
  const iconSize = mapPopup ? 13 : 14;
  const headerIconSize = mapPopup ? 14 : 16;
  const textSizeClass = mapPopup ? "text-[13px]" : "text-sm";
  const labelClass = mapPopup ? "text-xs" : "text-xs";

  const expiration = getExpirationProgress(pipeline.created_at);

  return (
    <div className={containerClass}>
      <div className={`flex justify-between items-start ${mapPopup ? "mb-2" : "mb-3"}`}>
        <h3 className={`font-semibold text-teal-800 flex items-center gap-1.5 ${mapPopup ? "text-sm" : "text-sm"}`}>
          <MapPin size={headerIconSize} className="text-teal-600 shrink-0" />
          Projet précédent
        </h3>
        <button
          onClick={onClose}
          className={`text-gray-500 hover:text-gray-700 leading-none ${mapPopup ? "text-base" : "text-lg"}`}
        >
          ×
        </button>
      </div>

      <div className={`${contentSpacing} ${textSizeClass}`}>
        {pipeline.created_at && (
          <div className="flex items-start gap-1.5">
            <Calendar size={iconSize} className="text-teal-600 mt-0.5 shrink-0" />
            <div>
              <span className={`${labelClass} font-medium text-gray-500`}>Date de génération</span>
              <div className="text-gray-800">{formatDate(pipeline.created_at)}</div>
              {expiration && (
                <div className="mt-1.5">
                  <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
                    <span>Validité 18 mois </span>
                    <span>{expiration.isExpired ? "Expiré" : `${Math.round(100 - expiration.progress)}%  restant`}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        expiration.isExpired ? "bg-red-500" : expiration.progress > 80 ? "bg-amber-500" : "bg-teal-500"
                      }`}
                      style={{ width: `${Math.min(100, expiration.progress)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {cerfa?.numero_cu && (
          <div className="flex items-start gap-1.5">
            <FileText size={iconSize} className="text-teal-600 mt-0.5 shrink-0" />
            <div>
              <span className={`${labelClass} font-medium text-gray-500`}>N° CU</span>
              <div className={`font-mono text-gray-800 ${textSizeClass}`}>
                {cerfa.numero_cu}
              </div>
            </div>
          </div>
        )}

        {cerfa?.demandeur && (
          <div className="flex items-start gap-1.5">
            <User size={iconSize} className="text-teal-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className={`${labelClass} font-medium text-gray-500`}>Demandeur</span>
              <div className="text-gray-800">{cerfa.demandeur}</div>
            </div>
          </div>
        )}

        {cerfa?.date_depot && (
          <div className="flex items-start gap-1.5">
            <Calendar size={iconSize} className="text-teal-600 mt-0.5 shrink-0" />
            <div>
              <span className={`${labelClass} font-medium text-gray-500`}>
                Date de dépôt
              </span>
              <div className="text-gray-800">
                {formatDate(cerfa.date_depot)}
              </div>
            </div>
          </div>
        )}

        {cerfa?.commune_nom && (
          <div>
            <span className={`${labelClass} font-medium text-gray-500`}>Commune</span>
            <div className="text-gray-800">{cerfa.commune_nom}</div>
          </div>
        )}

        {cerfa?.adresse_terrain &&
          (cerfa.adresse_terrain.voie ||
            cerfa.adresse_terrain.numero ||
            cerfa.adresse_terrain.ville) && (
            <div>
              <span className={`${labelClass} font-medium text-gray-500`}>
                Adresse du terrain
              </span>
              <div className="text-gray-800">
                {formatAdresse(cerfa.adresse_terrain)}
              </div>
            </div>
          )}

        {cerfa?.parcelles && cerfa.parcelles.length > 0 && (
          <div className={`bg-teal-50 border border-teal-200 rounded ${mapPopup ? "p-1.5" : "p-2"}`}>
            <span className={`${labelClass} font-medium text-teal-800`}>
              Parcelles ({cerfa.parcelles.length})
            </span>
            <div className={`text-teal-700 flex flex-wrap gap-1 mt-1 ${textSizeClass}`}>
              {cerfa.parcelles.map((p, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center rounded bg-teal-100 px-1.5 py-0.5 ${textSizeClass}`}
                >
                  {p.section} {p.numero}
                </span>
              ))}
            </div>
          </div>
        )}

        {typeof cerfa?.superficie === "number" && (
          <div>
            <span className={`${labelClass} font-medium text-gray-500`}>
              Superficie
            </span>
            <div className="text-gray-800">
              {cerfa.superficie.toLocaleString("fr-FR")} m²
            </div>
          </div>
        )}
      </div>

      <div className={`border-t border-gray-200 flex flex-col ${mapPopup ? "mt-2 pt-2 gap-1" : "mt-4 pt-3 gap-2"}`}>
        {pipeline.qr_url && (
          <a
            href={pipeline.qr_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors ${mapPopup ? "py-2 px-3 text-[13px]" : "py-2 px-3 text-sm"}`}
          >
            <ExternalLink size={mapPopup ? 13 : 14} />
            <span>Voir le projet (cartes + CUA)</span>
          </a>
        )}
        {pipeline.output_cua && !pipeline.qr_url && (
          <a
            href={pipeline.output_cua}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors ${mapPopup ? "py-2 px-3 text-[13px]" : "py-2 px-3 text-sm"}`}
          >
            <ExternalLink size={mapPopup ? 13 : 14} />
            <span>Télécharger le CUA</span>
          </a>
        )}
      </div>
    </div>
  );
}

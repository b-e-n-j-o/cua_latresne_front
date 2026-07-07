import type { ParcelleResumeRef } from "../../../../../types/sigResume";
import ParcelleCuaGenerateAction from "./ParcelleCuaGenerateAction";
import ParcelleTerrainActions from "./ParcelleTerrainActions";

type Props = {
  communeSlug: string;
  parcelles: ParcelleResumeRef[];
  unionGeometry?: GeoJSON.Geometry | null;
  userId?: string | null;
  userEmail?: string | null;
  onPipelineCreated?: (slug: string) => void;
  showParcelleHeader?: boolean;
};

export default function ParcelleQuickActions({
  communeSlug,
  parcelles,
  unionGeometry,
  userId,
  userEmail,
  onPipelineCreated,
  showParcelleHeader = true,
}: Props) {
  if (!parcelles.length) {
    return (
      <p className="text-xs text-gray-500">Sélectionnez une parcelle sur la carte.</p>
    );
  }

  const label =
    parcelles.length > 1
      ? parcelles.map((p) => `${p.section} ${p.numero}`).join(" · ")
      : `Section ${parcelles[0].section} — Parcelle ${parcelles[0].numero}`;

  const insee = parcelles[0].insee?.trim() || (communeSlug === "argeles" ? "66008" : "33234");

  return (
    <div className="space-y-3 text-sm">
      {showParcelleHeader ? (
        <p className="text-xs font-medium text-slate-700">{label}</p>
      ) : null}

      <ParcelleCuaGenerateAction
        communeSlug={communeSlug}
        parcelles={parcelles}
        insee={insee}
        communeNom={parcelles[0].commune}
        unionGeometry={unionGeometry ?? undefined}
        userId={userId}
        userEmail={userEmail}
        onPipelineCreated={onPipelineCreated}
      />

      <ParcelleTerrainActions
        parcelles={parcelles.map((p) => ({
          section: p.section,
          numero: p.numero,
          insee: p.insee?.trim() || insee,
        }))}
        unionGeometry={unionGeometry}
      />
    </div>
  );
}

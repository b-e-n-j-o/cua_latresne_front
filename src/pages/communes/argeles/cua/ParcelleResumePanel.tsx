import { Loader2, Map as MapIcon, X } from "lucide-react";
import * as turf from "@turf/turf";
import type { FullIntersectionsReport } from "../../../../types/fullIntersections";
import type { ParcelleResumeRef } from "../../../../types/sigResume";
import FullIntersectionsPanel from "./FullIntersectionsPanel";
import ParcelleCuaGenerateAction from "../../communs/carto/tools/ParcelleCuaGenerateAction";
import ParcelleTerrainActions from "../../communs/carto/tools/ParcelleTerrainActions";
import DraftUfParcelleList from "../../communs/carto/tools/DraftUfParcelleList";

type Props = {
  communeSlug?: string;
  parcelles: ParcelleResumeRef[];
  cadastre: GeoJSON.FeatureCollection | null;
  /** true = UF en cours de construction sur la carte */
  isDraftUf?: boolean;
  studyZoneActive?: boolean;
  studyZoneLoading?: boolean;
  studyZoneLabel?: string;
  onEnterStudyZone?: () => void;
  onExitStudyZone?: () => void;
  intersectionsReport?: FullIntersectionsReport | null;
  intersectionsLoading?: boolean;
  intersectionsError?: string | null;
  onRecalculateIntersections?: () => void;
  userId?: string | null;
  userEmail?: string | null;
  onPipelineCreated?: (slug: string) => void;
  /** UF en construction sur la carte : retirer une parcelle de la sélection. */
  onRemoveDraftUfParcelle?: (section: string, numero: string) => void;
};

function formatM2(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} m²`;
}

function StudyZoneActionButton({
  loading,
  active,
  onEnter,
}: {
  loading?: boolean;
  active?: boolean;
  onEnter?: () => void;
}) {
  if (!onEnter) return null;

  return (
    <button
      type="button"
      disabled={loading || active}
      onClick={onEnter}
      className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg text-sm shadow-md ${
        active
          ? "kerelia-btn-accent kerelia-btn-accent--active"
          : "kerelia-btn-accent"
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          Zone d&apos;étude et analyse SIG…
        </>
      ) : active ? (
        <>
          <MapIcon className="w-5 h-5 shrink-0" />
          Zonage affiché sur la carte
        </>
      ) : (
        <>
          <MapIcon className="w-5 h-5 shrink-0" strokeWidth={2.25} />
          Afficher le zonage de la zone sélectionnée
        </>
      )}
    </button>
  );
}

function StudyZoneModeBanner({
  label,
  onExit,
}: {
  label?: string;
  onExit?: () => void;
}) {
  if (!onExit) return null;

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-300 bg-blue-600 px-2.5 py-2 text-white shadow-sm">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide opacity-90">
          Mode zone d&apos;étude
        </div>
        {label ? (
          <div className="text-xs font-medium mt-0.5 truncate" title={label}>
            {label}
          </div>
        ) : null}
        <p className="text-[10px] opacity-80 mt-1 leading-snug">
          Sélection cadastre verrouillée — utilisez ✕ pour revenir à la vue communale.
        </p>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="shrink-0 p-1 rounded-md hover:bg-white/20 transition-colors"
        title="Quitter la zone d'étude"
        aria-label="Quitter la zone d'étude"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function resolveUnionGeometry(
  parcelles: ParcelleResumeRef[],
  cadastre: GeoJSON.FeatureCollection | null
): GeoJSON.Geometry | null {
  if (!cadastre?.features?.length || !parcelles.length) return null;

  const feats: GeoJSON.Feature[] = [];
  for (const p of parcelles) {
    const match = cadastre.features.find((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>;
      const section = String(props.section ?? "").trim().toUpperCase();
      const numero = String(props.numero ?? "").trim().padStart(4, "0");
      return section === p.section.trim().toUpperCase() && numero === p.numero.trim().padStart(4, "0");
    });
    if (match?.geometry) {
      feats.push({ type: "Feature", geometry: match.geometry, properties: {} });
    }
  }

  if (!feats.length) return null;
  if (feats.length === 1) return feats[0].geometry ?? null;

  try {
    const union = turf.union({ type: "FeatureCollection", features: feats });
    return union?.geometry ?? feats[0].geometry ?? null;
  } catch {
    return feats[0].geometry ?? null;
  }
}

export default function ParcelleResumePanel({
  communeSlug = "argeles",
  parcelles,
  cadastre,
  isDraftUf = false,
  studyZoneActive,
  studyZoneLoading,
  studyZoneLabel,
  onEnterStudyZone,
  onExitStudyZone,
  intersectionsReport = null,
  intersectionsLoading = false,
  intersectionsError = null,
  onRecalculateIntersections,
  userId,
  userEmail,
  onPipelineCreated,
  onRemoveDraftUfParcelle,
}: Props) {
  if (!parcelles.length) {
    return (
      <p className="text-xs text-gray-500">Sélectionnez une ou plusieurs parcelles sur la carte.</p>
    );
  }

  const isUf = parcelles.length > 1;
  const ufSurface = parcelles.reduce((sum, p) => sum + (p.surface_m2 ?? 0), 0);
  const unionGeometry = resolveUnionGeometry(parcelles, cadastre);

  return (
    <div className="space-y-3 text-sm">
      <StudyZoneActionButton
        loading={studyZoneLoading}
        active={studyZoneActive}
        onEnter={onEnterStudyZone}
      />

      <ParcelleCuaGenerateAction
        communeSlug={communeSlug}
        parcelles={parcelles}
        userId={userId}
        userEmail={userEmail}
        onPipelineCreated={onPipelineCreated}
      />

      <ParcelleTerrainActions
        parcelles={parcelles.map((p) => ({
          section: p.section,
          numero: p.numero,
          insee: p.insee?.trim() || (communeSlug === "argeles" ? "66008" : "33234"),
        }))}
        unionGeometry={unionGeometry}
      />

      {studyZoneActive ? (
        <StudyZoneModeBanner label={studyZoneLabel} onExit={onExitStudyZone} />
      ) : null}

      {isDraftUf ? (
        <DraftUfParcelleList
          parcelles={parcelles.map((p) => ({
            section: p.section,
            numero: p.numero,
          }))}
          ufSurface={ufSurface > 0 ? ufSurface : null}
          onRemove={onRemoveDraftUfParcelle}
        />
      ) : (
        <div
          className={`rounded-md px-2.5 py-2 text-xs ${
            isUf
              ? "bg-amber-50 border border-amber-200 text-amber-900"
              : "bg-slate-50 border border-slate-200 text-slate-800"
          }`}
        >
          <div className="font-semibold">
            {isUf
              ? `Unité foncière (${parcelles.length} parcelles)`
              : "Parcelle sélectionnée"}
          </div>
          {isUf ? (
            <div className="mt-1 text-[11px] opacity-90">
              {parcelles.map((p) => `${p.section} ${p.numero}`).join(" · ")}
              {ufSurface > 0 ? ` — ${formatM2(ufSurface)}` : ""}
            </div>
          ) : (
            <div className="mt-1 font-medium">
              {parcelles[0].section} {parcelles[0].numero}
              {parcelles[0].surface_m2 != null ? (
                <span className="block text-[10px] font-normal text-gray-600 mt-0.5">
                  {formatM2(parcelles[0].surface_m2)}
                </span>
              ) : null}
            </div>
          )}
        </div>
      )}

      <FullIntersectionsPanel
        communeSlug={communeSlug}
        report={intersectionsReport}
        loading={intersectionsLoading}
        error={intersectionsError}
        onRecalculate={onRecalculateIntersections}
        scrollIntoViewOnReport
      />
    </div>
  );
}

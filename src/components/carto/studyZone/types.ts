/** Contrat API zone d'étude — partagé CUA / futur chat PLU. */

export type StudyZoneParcelleRef = {
  section: string;
  numero: string;
};

export type StudyZoneFeatureProps = Record<string, unknown> & {
  intersects_parcel?: boolean;
  pct_sig?: number;
  surface_inter_m2?: number;
  longueur_inter_m?: number;
  _fid?: string;
};

export type StudyZoneLayerPayload = {
  layer_id: string;
  title: string;
  family: string;
  family_title: string;
  geom_type: "surfacique" | "lineaire" | "ponctuel";
  tip?: string;
  group?: string;
  legend?: string;
  status?: string;
  error?: string;
  features: GeoJSON.FeatureCollection;
};

export type StudyZoneCartoContext = {
  commune_slug?: string;
  parcelle: GeoJSON.Feature;
  parcelles: StudyZoneParcelleRef[];
  surface_m2?: number;
  context_buffer_m: number;
  context_buffer_max_m: number;
  display_clip_m?: number;
  n_layers?: number;
  n_layers_with_features?: number;
  computed_at?: string;
  layers: Record<string, StudyZoneLayerPayload>;
};

export type StudyZoneModeState = {
  active: true;
  parcellesKey: string;
  context: StudyZoneCartoContext;
  bufferM: number;
  visibleLayerIds: Set<string>;
  visibleGroups: Record<string, Set<string>>;
  highlightFid: string | null;
};

export const STUDY_ZONE_BUFFER_MAX_DEFAULT = 200;
export const STUDY_ZONE_DISPLAY_CLIP_M = 200;

export function studyZoneParcellesKey(
  parcelles: StudyZoneParcelleRef[]
): string {
  return parcelles
    .map((p) => `${p.section}:${p.numero}`)
    .sort()
    .join("|");
}

export function studyZoneLabel(context: StudyZoneCartoContext): string {
  const refs = context.parcelles ?? [];
  if (refs.length === 1) return `${refs[0].section} ${refs[0].numero}`;
  if (refs.length > 1) return `UF · ${refs.length} parcelles`;
  return "Zone d'étude";
}

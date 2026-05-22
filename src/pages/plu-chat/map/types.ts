/** Types GeoJSON carte PLU (alignés backend /map). */

export type ZoneFeature = {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: {
    code_zone: string;
    libelle: string | null;
    libelong: string | null;
    typezone: string | null;
    pct_parcelle_couverte: number | null;
    color: string;
  };
};

export type ParcelleProperties = {
  section?: string | null;
  numero?: string | null;
  idu?: string | null;
  contenance?: number | null;
  label?: string | null;
  nb_parcelles?: number;
  contenance_totale?: number | null;
  superficie_m2?: number | null;
  parcelles?: unknown[];
};

export type ParcelleFeature = GeoJSON.Feature<GeoJSON.Geometry, ParcelleProperties>;

export type PrescriptionProperties = {
  gml_id?: string | null;
  libelle?: string | null;
  typepsc?: string | null;
  stypepsc?: string | null;
  kind?: string | null;
  color?: string;
  label?: string | null;
  groupKey?: string;
};

export type PrescriptionsMap = {
  surfaciques?: GeoJSON.FeatureCollection<GeoJSON.Geometry, PrescriptionProperties>;
  lineaires?: GeoJSON.FeatureCollection<GeoJSON.Geometry, PrescriptionProperties>;
  ponctuelles?: GeoJSON.FeatureCollection<GeoJSON.Geometry, PrescriptionProperties>;
};

export type InformationProperties = {
  gml_id?: string | null;
  libelle?: string | null;
  typeinf?: string | null;
  stypeinf?: string | null;
  kind?: string | null;
  color?: string;
  label?: string | null;
  groupKey?: string;
};

export type InformationsMap = {
  surfaciques?: GeoJSON.FeatureCollection<GeoJSON.Geometry, InformationProperties>;
  lineaires?: GeoJSON.FeatureCollection<GeoJSON.Geometry, InformationProperties>;
  ponctuelles?: GeoJSON.FeatureCollection<GeoJSON.Geometry, InformationProperties>;
};

export type ServitudeProperties = {
  gid?: number | null;
  idass?: string | null;
  nomass?: string | null;
  nom_servitude?: string | null;
  suptype?: string | null;
  typeass?: string | null;
  nomsuplitt?: string | null;
  nomreg?: string | null;
  color?: string;
  label?: string | null;
  groupKey?: string;
};

/** Couches hors socle GPU — une FeatureCollection par id catalogue (latresne.json, …). */
export type ExtraLayersMap = Record<
  string,
  GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>
>;

export type MapData = {
  parcelle: ParcelleFeature | GeoJSON.FeatureCollection<GeoJSON.Geometry, ParcelleProperties>;
  parcelle_union?: ParcelleFeature | null;
  zones: { type: "FeatureCollection"; features: ZoneFeature[] };
  prescriptions?: PrescriptionsMap;
  servitudes?: GeoJSON.FeatureCollection<GeoJSON.Geometry, ServitudeProperties>;
  informations?: InformationsMap;
  /** Couches custom : clé = id du catalogue commune, pas de liste fixe côté frontend. */
  extra?: ExtraLayersMap;
};

export type LegendGroup = {
  key: string;
  label: string;
  color: string;
  count: number;
};

export type IsoDate = string; // 'YYYY-MM-DD', jamais de Date (décalages de fuseau)

export interface Millesime {
  millesime: IsoDate;
  date_effective_min: IsoDate;
  n_parcelles: number;
}

export interface VersionInfo {
  version_id: number;
  idu: string;
  section: string;
  numero: string;
  valid_from: IsoDate;
  valid_to: IsoDate | null;
  aire_m2: number;
  geojson: GeoJSON.MultiPolygon;
}

export type FlagKey =
  | "flag_geom" | "flag_chevauchement" | "flag_perte_emprise" | "flag_gain_emprise"
  | "flag_micro_parcelle" | "flag_ephemere" | "flag_created_ancien" | "flag_created_heterogene"
  | "flag_composante_geante" | "maj_contenance";

export type Flags = Partial<Record<FlagKey, true>>;

export type TypeEvenement =
  | "division" | "division_conservation_numero" | "reunion" | "reunion_conservation_numero"
  | "recomposition" | "recomposition_conservation_numero" | "renumerotation"
  | "renumerotation_administrative" | "reduction_emprise" | "extension_emprise"
  | "modif_limite_ou_recalage" | "recalage_plan" | "integration_domaine_public"
  | "integration_domaine_public_voirie" | "sortie_domaine_public" | "sortie_domaine_public_voirie"
  | "suppression_sans_enfant" | "suppression_parcelle_chevauchante" | "absorption_non_resolue"
  | "creation_sans_parent" | "creation_parent_non_resolu" | "artefact_micro_parcelle"
  | "absence_temporaire_artefact" | "reapparition_artefact";

/** Une ligne de ascendance_resumee : une étape peut compter plusieurs parents. */
export interface EtapeFrise {
  etape: number;
  idu_parent: string;
  version_parent: number;
  type: TypeEvenement;
  millesime_enfant: IsoDate;
  date_evenement: IsoDate | null;
  part_enfant: number;
  flags: Flags | null;
}

export interface PeriodeSpatiale {
  idu: string;
  version_id: number;
  observe_depuis: IsoDate;
  observe_jusqu_au: IsoDate;
  part_emprise: number;
  censure_gauche: boolean;
  geojson: GeoJSON.MultiPolygon;
}

export interface GeomVersion {
  version_id: number;
  idu: string;
  geojson: GeoJSON.MultiPolygon;
}

export type Vue = "frise" | "spatial" | "graphe" | "evenements";

/** Ligne de evenements_parcelle (tous les événements, y compris sans lien). */
export interface EvenementParcelle {
  evt_id: string;
  type: TypeEvenement;
  role: "parent" | "enfant";
  version_id: number;
  millesime_enfant: IsoDate;
  date_evenement: IsoDate | null;
  flags: Flags | null;
}

export interface GrapheNode {
  id: number;
  idu: string;
  section: string;
  numero: string;
  valid_from: IsoDate;
  valid_to: IsoDate | null;
  aire_m2: number;
  racine: boolean;
}

export interface GrapheEdge {
  source: number;
  target: number;
  evt_id: string;
  type: TypeEvenement;
  millesime: IsoDate;
  date_evenement: IsoDate | null;
  part_enfant: number;
  part_parent: number;
  meme_id: boolean;
  flags: Flags | null;
}

export interface Graphe {
  racine: number;
  nodes: GrapheNode[];
  edges: GrapheEdge[];
}
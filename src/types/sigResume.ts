/** Couches pré-calculées (catalogue_parcelle_resume_argeles.json). */
export const SIG_RESUME_LAYER_ORDER = [
  "zonage_plu",
  "hauteurs",
  "sup_assiette_s",
  "ppr",
  "pprif",
] as const;

export type SigResumeLayerKey = (typeof SIG_RESUME_LAYER_ORDER)[number];

export type SigResumeObjet = Record<string, unknown> & {
  surface_inter_m2?: number;
  pct_sig?: number;
};

export type SigResumeLayer = {
  nom?: string;
  type?: string;
  geom_type?: string;
  pct_sig?: number;
  objets?: SigResumeObjet[];
};

export type SigResume = {
  section?: string;
  numero?: string;
  idu?: string | null;
  surface_sig_m2?: number;
  contenance_m2?: number | null;
  computed_at?: string;
  layers?: Partial<Record<SigResumeLayerKey, SigResumeLayer>>;
};

export type ParcelleResumeRef = {
  section: string;
  numero: string;
  commune?: string;
  insee?: string;
  surface_m2?: number;
};

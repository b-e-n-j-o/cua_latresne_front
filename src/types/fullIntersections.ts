export type CartoCatalogueFamily = {
  id: string;
  title: string;
};

export type CartoCatalogueLayer = {
  title: string;
  family?: string;
  geom?: "surf" | "lin" | "pct";
  tip?: string;
  src?: string;
  legend?: string;
};

export type CartoCatalogue = {
  schema?: string;
  families: CartoCatalogueFamily[];
  layers: Record<string, CartoCatalogueLayer>;
};

export type IntersectionObject = Record<string, unknown> & {
  pct_sig?: number;
  surface_inter_m2?: number;
  longueur_inter_m?: number;
};

export type IntersectionLayerResult = {
  nom?: string;
  type?: string;
  geom_type?: "surfacique" | "lineaire" | "ponctuel";
  pct_sig?: number;
  objets?: IntersectionObject[];
};

export type FullIntersectionsReport = {
  parcelle?: string;
  parcelles?: Array<{ section: string; numero: string }>;
  surface_m2?: number;
  surface_indicative?: number;
  computed_at?: string;
  n_couches?: number;
  n_couches_concernees?: number;
  intersections: Record<string, IntersectionLayerResult>;
};

export type FamilyIntersectionGroup = {
  familyId: string;
  familyTitle: string;
  layers: Array<{
    layerId: string;
    title: string;
    tip?: string;
    geom?: string;
    result: IntersectionLayerResult;
    significantObjets: IntersectionObject[];
  }>;
};

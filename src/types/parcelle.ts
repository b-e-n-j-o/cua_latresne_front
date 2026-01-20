export type ZonageInfo = {
  section: string;
  numero: string;
  typezone?: string;
  etiquette?: string;
  libelle?: string;
  libelong?: string;
};

export type ParcelleInfo = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
  zonage?: string;   // Étiquette du zonage PLU/PLUi (pour compatibilité)
  typezone?: string; // Code de zone (ex: "UA", "N", etc.) (pour compatibilité)
  zonages?: ZonageInfo[]; // Liste des zonages (pour unités foncières)
  patrimoine?: any;
  isUF?: boolean;
  ufParcelles?: Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
  }>;
  ufUnionGeometry?: GeoJSON.Geometry;
  surface?: number; // Surface en m² (contenance)
};


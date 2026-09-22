/** Référence parcelle pour génération CUA, zone d'étude et sélection carte. */
export type ParcelleResumeRef = {
  section: string;
  numero: string;
  commune?: string;
  insee?: string;
  surface_m2?: number;
};

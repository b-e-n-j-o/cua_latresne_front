import { apiFetch } from "../../../../../api/apiFetch";

export type AutProps = {
  id: string;
  categorie: string;
  type_dau: string | null;
  etat: string;
  annee: number | null;
  date: string | null;
  geoloc_statut: string | null;
  nb_logements: number | null;
  surface_creee: number | null;
  sort_key: number | null;
};

export type AutParcelleLien = {
  id: string;
  categorie: string;
  type_dau: string | null;
  etat: string | null;
  date_depot: string | null;
  date_autorisation: string | null;
  nature_projet: string | null;
  nb_logements: number | null;
  surface_creee: number | null;
  geoloc_statut: string | null;
  methode: string;
  idu_origine: string | null;
  millesime_origine: string | null;
};

export type AutFiche = {
  id: string;
  categorie: string;
  type_dau: string | null;
  etat: string | null;
  date_depot: string | null;
  date_autorisation: string | null;
  date_doc: string | null;
  date_daact: string | null;
  nature_projet: string | null;
  nb_logements: number | null;
  surface_creee: number | null;
  superficie_terrain: number | null;
  adresse: string | null;
  demandeur?: string | null;
  siren?: string | null;
  geoloc_statut: string | null;
  details?: Record<string, unknown>;
  parcelles?: Array<{
    idu: string;
    methode: string;
    idu_origine: string | null;
    millesime_origine: string | null;
  }>;
};

export type AutNonLoc = {
  id: string;
  categorie: string;
  type_dau: string | null;
  etat: string;
  date: string | null;
  adresse: string | null;
  geoloc_statut: string;
  nature_projet: string | null;
  parcelles_declarees: string | null;
};

const base = (schema: string) => `/api/communes/${encodeURIComponent(schema)}`;

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Erreur ${res.status} sur ${path}`);
  return (await res.json()) as T;
}

export const autorisationsApi = {
  geojson: (schema: string) =>
    getJson<{ points: GeoJSON.FeatureCollection; emprises: GeoJSON.FeatureCollection }>(
      `${base(schema)}/autorisations?v=2`,
    ),
  fiche: (schema: string, id: string) =>
    getJson<AutFiche>(`${base(schema)}/autorisations/${encodeURIComponent(id)}`),
  nonLocalisees: (schema: string) =>
    getJson<AutNonLoc[]>(`${base(schema)}/autorisations/non-localisees?v=2`),
  parParcelle: (schema: string, idu: string) =>
    getJson<AutParcelleLien[]>(
      `${base(schema)}/parcelles/${encodeURIComponent(idu)}/autorisations`,
    ),
};

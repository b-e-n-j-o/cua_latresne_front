import type maplibregl from "maplibre-gl";

export type Geom = "surf" | "lin" | "pct";
export type Style = "zonage" | "defaut" | "sup" | "cadastre" | "limites" | "etiquettes";

export interface Couche {
  source: string;
  source_layer: string;
  geom: Geom;
  minzoom: number;
  filter?: maplibregl.FilterSpecification;
}

export interface Item {
  id: string;
  label: string;
  couleur: string;
  visible: boolean;
  style: Style;
  nb?: number;
  champ_etiquette?: string;
  couleur_par?: { champ: string; valeurs: Record<string, string>; defaut: string };
  couches: Couche[];
}

export interface Groupe {
  code: string;
  label: string;
  items: Item[];
}

export interface LegendeCarto {
  titre: string;
  bounds: [number, number, number, number];
  sources: Record<string, string>;
  groupes: Groupe[];
}

/** Parcelle retenue dans l'unité foncière (clic ou recherche). */
export interface ParcelleSel {
  cle: string;
  section: string;
  numero: string;
  codeInsee: string;
  commune: string;
  contenanceM2: number | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface ObjetCroise {
  libelle: string;
  surfaceM2: number;
  longueurM: number;
  nbPoints: number;
  pct: number | null;
}

export interface FamilleCroisee {
  itemId: string;
  label: string;
  couleur: string;
  surfaceM2: number;
  longueurM: number;
  nbPoints: number;
  pct: number | null;
  objets: ObjetCroise[];
}

export interface GroupeCroisement {
  code: string;
  label: string;
  familles: FamilleCroisee[];
  sans: string[];
}

export interface RapportCroisement {
  surfaceGraphiqueM2: number;
  contenanceM2: number | null;
  contenanceIncomplete: boolean;
  groupes: GroupeCroisement[];
  nFamilles: number;
  nTouchees: number;
  avertissement: string | null;
  calculeLe: string;
}

export function formatM2(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} m²`;
}

export function formatM(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} m`;
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

import * as turf from "@turf/turf";
import type maplibregl from "maplibre-gl";
import type { ParcelleSel } from "./cartoTypes";
import { nomCommune } from "./communesLarochelle";

export const MAX_PARCELLES = 30;

const API_CADASTRE = "https://apicarto.ign.fr/api/cadastre/parcelle";

export function normSection(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function normNumero(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  return /^\d+$/.test(s) ? s.padStart(4, "0") : s;
}

export function cleParcelle(codeInsee: string, section: string, numero: string): string {
  return `${codeInsee}|${section}|${numero}`;
}

export function estPolygone(
  g: GeoJSON.Geometry | null | undefined,
): g is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  return !!g && (g.type === "Polygon" || g.type === "MultiPolygon");
}

export function empriseGeometrie(geometry: GeoJSON.Geometry): [number, number, number, number] {
  const b = turf.bbox(geometry);
  return [b[0], b[1], b[2], b[3]];
}

export function fusionnerPolygones(
  geoms: GeoJSON.Geometry[],
): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  const polys = geoms.filter(estPolygone);
  if (!polys.length) return null;
  if (polys.length === 1) return polys[0];

  const features: GeoJSON.Feature[] = polys.map((geometry) => ({
    type: "Feature",
    properties: {},
    geometry,
  }));

  try {
    let acc = features[0];
    for (let i = 1; i < features.length; i++) {
      const next = turf.union(acc, features[i]);
      if (next?.geometry) acc = next;
    }
    if (estPolygone(acc.geometry)) return acc.geometry;
  } catch {
    /* repli MultiPolygon */
  }

  const coordinates: GeoJSON.Position[][][] = [];
  for (const g of polys) {
    if (g.type === "Polygon") coordinates.push(g.coordinates);
    else coordinates.push(...g.coordinates);
  }
  return { type: "MultiPolygon", coordinates };
}

function contenanceDe(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parcelleDe(opts: {
  codeInsee: string;
  section: string;
  numero: string;
  commune?: string;
  contenanceM2: number | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}): ParcelleSel {
  const section = normSection(opts.section);
  const numero = normNumero(opts.numero);
  const codeInsee = opts.codeInsee.trim();
  return {
    cle: cleParcelle(codeInsee, section, numero),
    section,
    numero,
    codeInsee,
    commune: opts.commune?.trim() || nomCommune(codeInsee),
    contenanceM2: opts.contenanceM2,
    geometry: opts.geometry,
  };
}

/** Reconstitue la parcelle cliquée, en recollant les morceaux de tuiles déjà chargés. */
export function lireParcelleCliquee(
  map: maplibregl.Map,
  feature: maplibregl.MapGeoJSONFeature,
): ParcelleSel | null {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const section = normSection(props.section);
  const numero = normNumero(props.numero);
  const codeInsee = String(props.code_insee ?? "").trim();
  if (!section || !numero) return null;

  const idu = String(props.idu ?? "").trim();
  let geoms: GeoJSON.Geometry[] = feature.geometry ? [feature.geometry] : [];
  let contenance = contenanceDe(props.contenance);

  try {
    if (map.getSource("cadastre")) {
      const filter: maplibregl.FilterSpecification = idu
        ? ["==", ["get", "idu"], idu]
        : [
            "all",
            ["==", ["get", "section"], props.section as string],
            ["==", ["get", "numero"], props.numero as string],
          ];
      const feats = map.querySourceFeatures("cadastre", { sourceLayer: "parcelles", filter });
      if (feats.length) {
        geoms = feats.map((f) => f.geometry).filter((g): g is GeoJSON.Geometry => !!g);
        if (contenance == null) {
          for (const f of feats) {
            contenance = contenanceDe((f.properties as Record<string, unknown> | null)?.contenance);
            if (contenance != null) break;
          }
        }
      }
    }
  } catch {
    /* tuiles pas encore là */
  }

  const geometry = fusionnerPolygones(geoms);
  if (!geometry) return null;
  return parcelleDe({ codeInsee, section, numero, contenanceM2: contenance, geometry });
}

type ReponseCadastre = {
  features?: GeoJSON.Feature[];
  code?: number;
  message?: unknown;
};

/** Recherche section + numéro via le cadastre IGN (géométrie complète, pas seulement la tuile visible). */
export async function chercherParcelle(
  codeInsee: string,
  sectionSaisie: string,
  numeroSaisi: string,
): Promise<ParcelleSel> {
  const section = normSection(sectionSaisie);
  const numero = normNumero(numeroSaisi);
  if (!codeInsee) throw new Error("Choisissez une commune.");
  if (!section || !numero) throw new Error("Renseignez la section et le numéro.");
  if (!/^\d{4}$/.test(numero) && numero.length > 8) {
    throw new Error("Numéro de parcelle illisible.");
  }

  const url = `${API_CADASTRE}?code_insee=${encodeURIComponent(codeInsee)}&section=${encodeURIComponent(section)}&numero=${encodeURIComponent(numero)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("Service cadastral injoignable. Zoomez et cliquez la parcelle sur la carte.");
  }

  const data = (await res.json()) as ReponseCadastre;
  if (!res.ok) {
    throw new Error("Recherche cadastrale refusée. Vérifiez la section et le numéro (4 chiffres).");
  }

  const feat = data.features?.[0];
  if (!feat?.geometry || !estPolygone(feat.geometry)) {
    throw new Error(`Aucune parcelle ${section} ${numero} à ${nomCommune(codeInsee)}.`);
  }

  const props = (feat.properties ?? {}) as Record<string, unknown>;
  return parcelleDe({
    codeInsee: String(props.code_insee ?? codeInsee),
    section: String(props.section ?? section),
    numero: String(props.numero ?? numero),
    commune: props.nom_com ? String(props.nom_com) : nomCommune(codeInsee),
    contenanceM2: contenanceDe(props.contenance),
    geometry: feat.geometry,
  });
}

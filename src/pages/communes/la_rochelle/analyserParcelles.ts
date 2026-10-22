import * as turf from "@turf/turf";
import type maplibregl from "maplibre-gl";
import type {
  Couche,
  FamilleCroisee,
  GroupeCroisement,
  Item,
  LegendeCarto,
  ObjetCroise,
  ParcelleSel,
  RapportCroisement,
} from "./cartoTypes";
import { empriseGeometrie, estPolygone, fusionnerPolygones } from "./parcellesLr";

const ZOOM_ANALYSE = 15.2;
const SEUIL_SURFACE_M2 = 1;
const SEUIL_LONGUEUR_M = 0.5;
const PLAFOND_FEATURES = 2500;

const LABEL_KEYS = [
  "libelle",
  "libelong",
  "nom",
  "classe",
  "typezone",
  "suptype",
  "typeass",
  "typepsc",
  "stypepsc",
  "typeinf",
  "lettre",
];

type AccObjet = { surfaceM2: number; longueurM: number; nbPoints: number };
type AccFamille = AccObjet & { objets: Map<string, AccObjet> };

function estEtiquette(item: Item, couche: Couche): boolean {
  return item.style === "etiquettes" || couche.source_layer.endsWith("_labels");
}

function sondeId(couche: Couche): string {
  return `lr-probe::${couche.source}::${couche.source_layer}`;
}

function couchesAnalysables(legende: LegendeCarto): { item: Item; groupeCode: string; groupeLabel: string; couche: Couche }[] {
  const out: { item: Item; groupeCode: string; groupeLabel: string; couche: Couche }[] = [];
  for (const g of legende.groupes) {
    for (const item of g.items) {
      if (item.id === "parcelles") continue;
      for (const couche of item.couches) {
        if (estEtiquette(item, couche)) continue;
        out.push({ item, groupeCode: g.code, groupeLabel: g.label, couche });
      }
    }
  }
  return out;
}

/** Couches invisibles (opacité nulle) pour forcer le chargement des tuiles au moment de l'analyse. */
export function assurerSondes(map: maplibregl.Map, legende: LegendeCarto): string[] {
  const ids: string[] = [];
  const vues = new Map<string, Couche>();
  for (const { couche } of couchesAnalysables(legende)) {
    const id = sondeId(couche);
    const prev = vues.get(id);
    if (!prev || couche.minzoom < prev.minzoom) vues.set(id, couche);
  }
  for (const [id, couche] of vues) {
    ids.push(id);
    if (map.getLayer(id) || !map.getSource(couche.source)) continue;
    const layout = { visibility: "none" as const };
    if (couche.geom === "lin") {
      map.addLayer({
        id,
        type: "line",
        source: couche.source,
        "source-layer": couche.source_layer,
        minzoom: couche.minzoom,
        layout,
        paint: { "line-opacity": 0, "line-width": 1 },
      });
    } else if (couche.geom === "pct") {
      map.addLayer({
        id,
        type: "circle",
        source: couche.source,
        "source-layer": couche.source_layer,
        minzoom: couche.minzoom,
        layout,
        paint: { "circle-opacity": 0, "circle-radius": 2 },
      });
    } else {
      map.addLayer({
        id,
        type: "fill",
        source: couche.source,
        "source-layer": couche.source_layer,
        minzoom: couche.minzoom,
        layout,
        paint: { "fill-color": "#000000", "fill-opacity": 0 },
      });
    }
  }
  return ids;
}

function reglerSondes(map: maplibregl.Map, ids: string[], visibility: "visible" | "none") {
  if (!map.getStyle()) return;
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
  }
}

async function attendreCarte(map: maplibregl.Map): Promise<void> {
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  if (!map.getStyle() || (map.loaded() && !map.isMoving())) return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 12000);
    map.once("idle", () => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

function centresDansLaVue(map: maplibregl.Map, parcelles: ParcelleSel[]): boolean {
  if (map.getZoom() < ZOOM_ANALYSE) return false;
  const bounds = map.getBounds();
  return parcelles.every((p) => {
    const [w, s, e, n] = empriseGeometrie(p.geometry);
    return bounds.contains([(w + e) / 2, (s + n) / 2]);
  });
}

function libelleDe(props: Record<string, unknown>, fallback: string): string {
  for (const key of LABEL_KEYS) {
    const v = props[key];
    if (v == null || String(v).trim() === "") continue;
    let label = String(v).trim();
    const page = props.page_reglement;
    if (page != null && String(page).trim() !== "") label += ` — règlement p. ${page}`;
    return label;
  }
  return fallback;
}

function cleGeometrie(feature: maplibregl.MapGeoJSONFeature): string {
  return `${feature.sourceLayer ?? ""}:${feature.id ?? ""}:${JSON.stringify(feature.geometry)}`;
}

function surfaceIntersection(
  parcelle: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  autre: GeoJSON.Geometry,
): number {
  if (!estPolygone(autre)) return 0;
  const feat = turf.feature(autre);
  try {
    if (!turf.booleanIntersects(parcelle, feat)) return 0;
  } catch {
    return 0;
  }
  try {
    const inter = turf.intersect(parcelle, feat);
    if (!inter?.geometry) return 0;
    const aire = turf.area(inter);
    return Number.isFinite(aire) ? aire : 0;
  } catch {
    return 0;
  }
}

function longueurDansPolygone(
  geom: GeoJSON.Geometry,
  poly: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): number {
  const lignes =
    geom.type === "LineString"
      ? [geom.coordinates]
      : geom.type === "MultiLineString"
        ? geom.coordinates
        : [];
  let total = 0;
  for (const coords of lignes) {
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1];
      const b = coords[i];
      if (!a || !b || a.length < 2 || b.length < 2) continue;
      const seg = turf.lineString([
        [a[0], a[1]],
        [b[0], b[1]],
      ]);
      const len = turf.length(seg, { units: "meters" });
      if (!Number.isFinite(len) || len <= 0) continue;
      try {
        const aIn = turf.booleanPointInPolygon(turf.point([a[0], a[1]]), poly);
        const bIn = turf.booleanPointInPolygon(turf.point([b[0], b[1]]), poly);
        const coupe = !aIn && !bIn ? turf.booleanIntersects(seg, poly) : false;
        if (aIn && bIn) total += len;
        else if (aIn || bIn || coupe) total += len * 0.5;
      } catch {
        /* segment illisible */
      }
    }
  }
  return total;
}

function pointsDans(
  geom: GeoJSON.Geometry,
  poly: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): number {
  const coords =
    geom.type === "Point" ? [geom.coordinates] : geom.type === "MultiPoint" ? geom.coordinates : [];
  let n = 0;
  for (const c of coords) {
    if (!c || c.length < 2) continue;
    try {
      if (turf.booleanPointInPolygon(turf.point([c[0], c[1]]), poly)) n += 1;
    } catch {
      /* point hors géométrie */
    }
  }
  return n;
}

function ajouterObjet(acc: AccFamille, libelle: string, part: AccObjet) {
  acc.surfaceM2 += part.surfaceM2;
  acc.longueurM += part.longueurM;
  acc.nbPoints += part.nbPoints;
  const prev = acc.objets.get(libelle) ?? { surfaceM2: 0, longueurM: 0, nbPoints: 0 };
  prev.surfaceM2 += part.surfaceM2;
  prev.longueurM += part.longueurM;
  prev.nbPoints += part.nbPoints;
  acc.objets.set(libelle, prev);
}

function interrogerCouche(
  map: maplibregl.Map,
  couche: Couche,
  item: Item,
  poly: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  acc: AccFamille,
): boolean {
  if (!map.getSource(couche.source)) return false;
  let feats: maplibregl.MapGeoJSONFeature[] = [];
  try {
    feats = map.querySourceFeatures(couche.source, {
      sourceLayer: couche.source_layer,
      filter: couche.filter,
    });
  } catch {
    return false;
  }

  const vus = new Set<string>();
  let tronque = false;
  let traités = 0;
  for (const feature of feats) {
    if (!feature.geometry) continue;
    const cle = cleGeometrie(feature);
    if (vus.has(cle)) continue;
    vus.add(cle);
    traités += 1;
    if (traités > PLAFOND_FEATURES) {
      tronque = true;
      break;
    }
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const libelle = libelleDe(props, item.label);
    if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
      const surface = surfaceIntersection(poly, feature.geometry);
      if (surface >= SEUIL_SURFACE_M2) ajouterObjet(acc, libelle, { surfaceM2: surface, longueurM: 0, nbPoints: 0 });
    } else if (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString") {
      const longueur = longueurDansPolygone(feature.geometry, poly);
      if (longueur >= SEUIL_LONGUEUR_M) ajouterObjet(acc, libelle, { surfaceM2: 0, longueurM: longueur, nbPoints: 0 });
    } else if (feature.geometry.type === "Point" || feature.geometry.type === "MultiPoint") {
      const nb = pointsDans(feature.geometry, poly);
      if (nb > 0) ajouterObjet(acc, libelle, { surfaceM2: 0, longueurM: 0, nbPoints: nb });
    }
  }
  return tronque;
}

function pctDe(surface: number, denom: number): number | null {
  if (surface <= 0 || denom <= 0) return null;
  return Math.min(100, (surface / denom) * 100);
}

function versObjets(objets: Map<string, AccObjet>, denom: number): ObjetCroise[] {
  return [...objets.entries()]
    .map(([libelle, v]) => ({
      libelle,
      surfaceM2: v.surfaceM2,
      longueurM: v.longueurM,
      nbPoints: v.nbPoints,
      pct: pctDe(v.surfaceM2, denom),
    }))
    .sort((a, b) => b.surfaceM2 - a.surfaceM2 || b.longueurM - a.longueurM || b.nbPoints - a.nbPoints || a.libelle.localeCompare(b.libelle, "fr"));
}

function familleVide(): AccFamille {
  return { surfaceM2: 0, longueurM: 0, nbPoints: 0, objets: new Map() };
}

function aUnCroisement(acc: AccFamille): boolean {
  return acc.surfaceM2 >= SEUIL_SURFACE_M2 || acc.longueurM >= SEUIL_LONGUEUR_M || acc.nbPoints > 0;
}

/** Incrémenté à chaque analyse : seule la dernière referme les sondes et déplace la carte. */
let jetonAnalyse = 0;

/**
 * Croise l'unité foncière avec les familles de la légende.
 * Les parcelles éloignées sont analysées une par une pour que les tuiles fines soient chargées.
 */
export async function analyserSelection(
  map: maplibregl.Map,
  legende: LegendeCarto,
  parcelles: ParcelleSel[],
  encoreValide: () => boolean,
): Promise<RapportCroisement | null> {
  if (!parcelles.length || !map.getStyle()) return null;

  const jeton = ++jetonAnalyse;
  const valide = () => encoreValide() && jeton === jetonAnalyse;
  const sondes = assurerSondes(map, legende);
  const emprise = fusionnerPolygones(parcelles.map((p) => p.geometry));
  const bounds = emprise ? empriseGeometrie(emprise) : empriseGeometrie(parcelles[0].geometry);
  let zoomInsuffisant = false;

  try {
    if (!centresDansLaVue(map, parcelles)) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 16.5, duration: 450 });
      await attendreCarte(map);
      if (!valide()) return null;
      if (map.getZoom() < ZOOM_ANALYSE) zoomInsuffisant = true;
    }

    reglerSondes(map, sondes, "visible");
    await attendreCarte(map);
    if (!valide()) return null;

    const surfaceGraphiqueM2 = parcelles.reduce((sum, p) => sum + turf.area(p.geometry), 0);
    const contenances = parcelles
      .map((p) => p.contenanceM2)
      .filter((n): n is number => n != null && n > 0);
    const accFamilles = new Map<string, AccFamille>();
    let tronque = false;

    if (zoomInsuffisant) {
      for (const parcelle of parcelles) {
        if (!valide()) return null;
        map.fitBounds(empriseGeometrie(parcelle.geometry), { padding: 72, maxZoom: 16.5, duration: 0 });
        await attendreCarte(map);
        if (!valide()) return null;
        tronque = relever(map, legende, turf.feature(parcelle.geometry), accFamilles) || tronque;
      }
      map.fitBounds(bounds, { padding: 56, maxZoom: 16.5, duration: 400 });
    } else {
      const uni = turf.feature(emprise ?? parcelles[0].geometry);
      tronque = relever(map, legende, uni, accFamilles);
    }

    if (!valide()) return null;

    const groupes: GroupeCroisement[] = [];
    let nFamilles = 0;
    let nTouchees = 0;
    for (const g of legende.groupes) {
      const familles: FamilleCroisee[] = [];
      const sans: string[] = [];
      const items = g.items.filter((it) => it.id !== "parcelles" && it.style !== "etiquettes");
      for (const item of items) {
        if (item.couches.every((c) => estEtiquette(item, c))) continue;
        nFamilles += 1;
        const acc = accFamilles.get(item.id);
        if (!acc || !aUnCroisement(acc)) {
          sans.push(item.label);
          continue;
        }
        nTouchees += 1;
        familles.push({
          itemId: item.id,
          label: item.label,
          couleur: item.couleur,
          surfaceM2: acc.surfaceM2,
          longueurM: acc.longueurM,
          nbPoints: acc.nbPoints,
          pct: pctDe(acc.surfaceM2, surfaceGraphiqueM2),
          objets: versObjets(acc.objets, surfaceGraphiqueM2),
        });
      }
      if (familles.length || sans.length) groupes.push({ code: g.code, label: g.label, familles, sans });
    }

    const avertissements: string[] = [];
    if (tronque) {
      avertissements.push("Certaines couches très denses ont été limitées aux premiers objets de la vue.");
    }
    if (zoomInsuffisant) {
      avertissements.push("Les parcelles sont éloignées : chaque parcelle a été analysée séparément, puis la carte a été recadrée sur l'ensemble.");
    }

    return {
      surfaceGraphiqueM2,
      contenanceM2: contenances.length ? contenances.reduce((a, b) => a + b, 0) : null,
      contenanceIncomplete: contenances.length !== parcelles.length,
      groupes,
      nFamilles,
      nTouchees,
      avertissement: avertissements.length ? avertissements.join(" ") : null,
      calculeLe: new Date().toLocaleString("fr-FR"),
    };
  } finally {
    if (jeton === jetonAnalyse) {
      try { reglerSondes(map, sondes, "none"); } catch { /* carte démontée */ }
    }
  }
}

function relever(
  map: maplibregl.Map,
  legende: LegendeCarto,
  poly: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  accFamilles: Map<string, AccFamille>,
): boolean {
  let tronque = false;
  for (const { item, couche } of couchesAnalysables(legende)) {
    const acc = accFamilles.get(item.id) ?? familleVide();
    tronque = interrogerCouche(map, couche, item, poly, acc) || tronque;
    accFamilles.set(item.id, acc);
  }
  return tronque;
}

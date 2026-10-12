import type maplibregl from "maplibre-gl";
import type { AutProps } from "./autorisationsApi";

export const AUT_COULEUR: maplibregl.ExpressionSpecification = [
  "match",
  ["get", "categorie"],
  "logements",
  "#e07a5f",
  "locaux",
  "#3d5a80",
  "mixte",
  "#9c6644",
  "amenagement",
  "#81b29a",
  "demolition",
  "#6c757d",
  "#999999",
];

export const AUT_CATEGORIES = [
  { key: "logements", label: "Logements", color: "#e07a5f" },
  { key: "locaux", label: "Locaux d'activité", color: "#3d5a80" },
  { key: "mixte", label: "Mixte", color: "#9c6644" },
  { key: "amenagement", label: "Aménagement (PA)", color: "#81b29a" },
  { key: "demolition", label: "Démolition (PD)", color: "#6c757d" },
] as const;

export const AUT_ETATS = [
  { key: "autorisé", label: "Autorisé" },
  { key: "commencé", label: "Commencé" },
  { key: "terminé", label: "Terminé" },
  { key: "annulé", label: "Annulé" },
  { key: "inconnu", label: "Inconnu" },
] as const;

export const AUT_COLOR_LEGEND = [
  ...AUT_CATEGORIES.map((c) => ({ label: c.label, color: c.color })),
  { label: "Contour plein : emprise actuelle", color: "#222222" },
  { label: "Contour pointillé : emprise reconstituée", color: "#888888" },
];

export const AUT_LAYER_IDS = [
  "aut-clusters",
  "aut-clusters-count",
  "aut-points",
  "aut-emprises-fill",
  "aut-emprises-line",
  "aut-emprises-line-reconst",
  "aut-emprises-highlight",
] as const;

export const AUT_CLICK_LAYERS = [
  "aut-clusters",
  "aut-points",
  "aut-emprises-fill",
  "aut-emprises-line",
  "aut-emprises-line-reconst",
];

export type AutFilterState = {
  categories: Set<string>;
  etats: Set<string>;
  anneeMin: number;
  anneeMax: number;
  dateInconnue: boolean;
};

export function defaultFilterState(yearNow: number): AutFilterState {
  return {
    categories: new Set(AUT_CATEGORIES.map((c) => c.key)),
    etats: new Set(AUT_ETATS.map((e) => e.key)),
    anneeMin: 2013,
    anneeMax: yearNow,
    dateInconnue: true,
  };
}

export function filtrer(
  features: GeoJSON.Feature[],
  state: AutFilterState,
): GeoJSON.Feature[] {
  return features.filter((f) => {
    const p = (f.properties ?? {}) as AutProps;
    if (!state.categories.has(p.categorie)) return false;
    const etat = p.etat || "inconnu";
    if (!state.etats.has(etat)) return false;
    if (p.annee == null) return state.dateInconnue;
    return p.annee >= state.anneeMin && p.annee <= state.anneeMax;
  });
}

export function emptyFc(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export function ensureAutLayers(map: maplibregl.Map): void {
  if (map.getSource("aut-points")) {
    for (const id of ["aut-clusters", "aut-clusters-count", "aut-points"] as const) {
      if (map.getLayer(id)) map.setLayerZoomRange(id, 0, 24);
    }
    return;
  }

  map.addSource("aut-points", {
    type: "geojson",
    data: emptyFc(),
    cluster: true,
    clusterMaxZoom: 18,
    clusterRadius: 40,
  });
  map.addSource("aut-emprises", {
    type: "geojson",
    data: emptyFc(),
    promoteId: "id",
  });
  map.addSource("aut-idu-highlight", {
    type: "geojson",
    data: emptyFc(),
  });

  map.addLayer({
    id: "aut-emprises-fill",
    type: "fill",
    source: "aut-emprises",
    minzoom: 15,
    paint: {
      "fill-color": AUT_COULEUR,
      "fill-opacity": [
        "case",
        ["==", ["get", "etat"], "annulé"],
        0.15,
        0.45,
      ],
      "fill-sort-key": ["coalesce", ["get", "sort_key"], 0],
    },
  });
  map.addLayer({
    id: "aut-emprises-line",
    type: "line",
    source: "aut-emprises",
    minzoom: 15,
    filter: ["!=", ["get", "geoloc_statut"], "complet_reconstitue"],
    paint: { "line-color": AUT_COULEUR, "line-width": 1.4 },
  });
  map.addLayer({
    id: "aut-emprises-line-reconst",
    type: "line",
    source: "aut-emprises",
    minzoom: 15,
    filter: ["==", ["get", "geoloc_statut"], "complet_reconstitue"],
    paint: {
      "line-color": AUT_COULEUR,
      "line-width": 1.4,
      "line-dasharray": [2, 2],
    },
  });
  map.addLayer({
    id: "aut-emprises-highlight",
    type: "line",
    source: "aut-emprises",
    minzoom: 15,
    paint: {
      "line-color": "#111111",
      "line-width": [
        "case",
        [
          "any",
          ["boolean", ["feature-state", "selected"], false],
          ["boolean", ["feature-state", "hover"], false],
        ],
        3.5,
        0,
      ],
    },
  });
  map.addLayer({
    id: "aut-idu-highlight",
    type: "line",
    source: "aut-idu-highlight",
    paint: { "line-color": "#E53E3E", "line-width": 3 },
  });
  map.addLayer({
    id: "aut-clusters",
    type: "circle",
    source: "aut-points",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#3d5a80",
      "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 26],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
  map.addLayer({
    id: "aut-clusters-count",
    type: "symbol",
    source: "aut-points",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 11,
      "text-font": ["Noto Sans Regular"],
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "aut-points",
    type: "circle",
    source: "aut-points",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": AUT_COULEUR,
      "circle-radius": 6,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#ffffff",
    },
  });
}

export function setAutVisibility(map: maplibregl.Map, on: boolean): void {
  const v = on ? "visible" : "none";
  for (const id of AUT_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
  }
  if (map.getLayer("aut-idu-highlight")) {
    map.setLayoutProperty("aut-idu-highlight", "visibility", v);
  }
}

export function applyAutData(
  map: maplibregl.Map,
  points: GeoJSON.FeatureCollection,
  emprises: GeoJSON.FeatureCollection,
): void {
  const pts = map.getSource("aut-points") as maplibregl.GeoJSONSource | undefined;
  const emp = map.getSource("aut-emprises") as maplibregl.GeoJSONSource | undefined;
  pts?.setData(points);
  emp?.setData(emprises);
}

export function fitToFeature(map: maplibregl.Map, geom: GeoJSON.Geometry | null | undefined): void {
  if (!geom) return;
  const coords: number[][] = [];
  const walk = (g: GeoJSON.Geometry) => {
    if (g.type === "Point") coords.push(g.coordinates as number[]);
    else if (g.type === "MultiPoint" || g.type === "LineString") {
      for (const c of g.coordinates as number[][]) coords.push(c);
    } else if (g.type === "Polygon" || g.type === "MultiLineString") {
      for (const ring of g.coordinates as number[][][]) for (const c of ring) coords.push(c);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as number[][][][])
        for (const ring of poly) for (const c of ring) coords.push(c);
    } else if (g.type === "GeometryCollection") {
      for (const child of g.geometries) walk(child);
    }
  };
  walk(geom);
  if (!coords.length) return;
  let minX = coords[0][0], minY = coords[0][1], maxX = coords[0][0], maxY = coords[0][1];
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (minX === maxX && minY === maxY) {
    map.easeTo({ center: [minX, minY], zoom: Math.max(map.getZoom(), 16) });
    return;
  }
  map.fitBounds(
    [
      [minX, minY],
      [maxX, maxY],
    ],
    { padding: 48, maxZoom: 18 },
  );
}

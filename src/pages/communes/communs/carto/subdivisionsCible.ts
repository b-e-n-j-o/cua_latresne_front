import type maplibregl from "maplibre-gl";
import { apiFetch } from "../../../../api/apiFetch";

const SOURCE = "subdivisions-cible";
const FILL = "subdivisions-cible-fill";
const LINE = "subdivisions-cible-line";
const LABEL = "subdivisions-cible-label";

const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

let enCours: AbortController | null = null;

/** Subdivisions qui recouvrent la parcelle (seuil côté serveur). */
export async function fetchSubdivisionsCible(
  commune: string,
  geometry: GeoJSON.Geometry,
): Promise<GeoJSON.FeatureCollection> {
  enCours?.abort();
  const ctrl = new AbortController();
  enCours = ctrl;
  const res = await apiFetch(`/communes/${encodeURIComponent(commune)}/subdivisions/intersection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geometry }),
    signal: ctrl.signal,
  });
  if (!res.ok) throw new Error(`subdivisions ${res.status}`);
  return (await res.json()) as GeoJSON.FeatureCollection;
}

export function showSubdivisionsCible(map: maplibregl.Map, data: GeoJSON.FeatureCollection): void {
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, { type: "geojson", data });
    map.addLayer({
      id: FILL,
      type: "fill",
      source: SOURCE,
      paint: { "fill-color": "#7c3aed", "fill-opacity": 0.35 },
    });
    map.addLayer({
      id: LINE,
      type: "line",
      source: SOURCE,
      paint: { "line-color": "#5b21b6", "line-width": 1.6 },
    });
    map.addLayer({
      id: LABEL,
      type: "symbol",
      source: SOURCE,
      layout: {
        "text-field": ["concat", ["get", "parcelle"], " ", ["coalesce", ["get", "lettre"], ""]],
        "text-size": 12,
        "text-font": ["Noto Sans Regular"],
      },
      paint: {
        "text-color": "#4c1d95",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
      },
    });
  } else {
    (map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(data);
  }
  for (const id of [FILL, LINE, LABEL]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
}

export function clearSubdivisionsCible(map: maplibregl.Map): void {
  const src = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
  src?.setData(empty);
}

export function chargerSubdivisionsCible(
  map: maplibregl.Map,
  commune: string,
  geometry: GeoJSON.Geometry,
): void {
  fetchSubdivisionsCible(commune, geometry).then(
    (fc) => showSubdivisionsCible(map, fc),
    (err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      clearSubdivisionsCible(map);
    },
  );
}

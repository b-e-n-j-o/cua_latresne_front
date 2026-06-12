import * as turf from "@turf/turf";
import type maplibregl from "maplibre-gl";
import { CARTO_LAYERS } from "../../../pages/communes/argeles/cua/cartoLayers";
import { enrichStudyZoneFeatures, applyStudyZoneGroupFilter } from "./studyZoneLegend";
import type { StudyZoneCartoContext, StudyZoneLayerPayload } from "./types";

const PREFIX = "study-zone";
const PARCEL_SOURCE = `${PREFIX}-parcelle`;
const BUFFER_SOURCE = `${PREFIX}-buffer`;

export const FAMILY_COLORS: Record<string, string> = {
  zonages_plu: "#2563eb",
  prescriptions: "#f97316",
  informations: "#7c3aed",
  servitudes: "#f43f5e",
  risques: "#dc2626",
  environnement: "#059669",
  reseaux: "#475569",
  cadastre: "#6b7280",
  _other: "#9ca3af",
};

export type StudyZoneFilterOptions = {
  bufferM: number;
  visibleLayerIds: Set<string>;
  visibleGroups: Record<string, Set<string>>;
};

const FEATURE_COLOR: maplibregl.ExpressionSpecification = [
  "coalesce",
  ["get", "_studyColor"],
  "#888888",
];

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function layerSourceId(layerId: string): string {
  return `${PREFIX}-layer-${sanitizeId(layerId)}`;
}

export function buildBufferPolygon(
  parcelle: GeoJSON.Feature,
  bufferM: number
): GeoJSON.Feature | null {
  if (!parcelle.geometry) return null;
  if (bufferM <= 0) {
    return turf.feature(parcelle.geometry);
  }
  try {
    return turf.buffer(parcelle, bufferM / 1000, { units: "kilometers", steps: 32 });
  } catch {
    return turf.feature(parcelle.geometry);
  }
}

function featureVisibleInBuffer(
  feature: GeoJSON.Feature,
  bufferPoly: GeoJSON.Feature | GeoJSON.Polygon | GeoJSON.MultiPolygon | null,
  bufferM: number
): boolean {
  const props = feature.properties as { intersects_parcel?: boolean } | null;
  if (props?.intersects_parcel) return true;
  if (bufferM <= 0 || !bufferPoly) return false;
  try {
    return turf.booleanIntersects(feature, bufferPoly);
  } catch {
    return false;
  }
}

export function filterLayerFeatures(
  layer: StudyZoneLayerPayload,
  bufferPoly: GeoJSON.Feature | null,
  opts: StudyZoneFilterOptions
): GeoJSON.Feature[] {
  if (!opts.visibleLayerIds.has(layer.layer_id)) return [];

  const raw = layer.features?.features ?? [];
  return raw.filter((f) => featureVisibleInBuffer(f, bufferPoly, opts.bufferM));
}

export function filterStudyZoneContext(
  context: StudyZoneCartoContext,
  opts: StudyZoneFilterOptions
): Record<string, GeoJSON.Feature[]> {
  const bufferPoly = buildBufferPolygon(context.parcelle, opts.bufferM);
  const out: Record<string, GeoJSON.Feature[]> = {};
  for (const layer of Object.values(context.layers)) {
    out[layer.layer_id] = filterLayerFeatures(layer, bufferPoly, opts);
  }
  return out;
}

/** Enrichit les features (couleur / label) + filtre par groupe discriminant. */
export function enrichFilteredForDisplay(
  context: StudyZoneCartoContext,
  filtered: Record<string, GeoJSON.Feature[]>,
  visibleGroups: Record<string, Set<string>> = {}
): Record<string, GeoJSON.Feature[]> {
  const enriched: Record<string, GeoJSON.Feature[]> = {};
  for (const [layerId, features] of Object.entries(filtered)) {
    const meta = context.layers[layerId];
    enriched[layerId] = meta ? enrichStudyZoneFeatures(meta, features) : features;
  }
  return applyStudyZoneGroupFilter(context, enriched, visibleGroups);
}

export function hideCommunePmtiles(map: maplibregl.Map): void {
  for (const def of CARTO_LAYERS) {
    for (const sub of def.layers) {
      if (map.getLayer(sub.id)) {
        map.setLayoutProperty(sub.id, "visibility", "none");
      }
    }
  }
}

function removeStudyLayers(map: maplibregl.Map): void {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of [...style.layers]) {
    if (layer.id.startsWith(PREFIX) && map.getLayer(layer.id)) {
      map.removeLayer(layer.id);
    }
  }
  if (style?.sources) {
    for (const sourceId of Object.keys(style.sources)) {
      if (sourceId.startsWith(PREFIX) && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }
}

function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

const PARCEL_YELLOW = "#FACC15";
const PARCEL_YELLOW_OUTLINE = "#EAB308";
const PARCEL_FILL_LAYER = `${PREFIX}-parcelle-fill`;
const PARCEL_OUTLINE_LAYER = `${PREFIX}-parcelle-outline`;

function bringStudyZoneUfToFront(map: maplibregl.Map): void {
  try {
    if (map.getLayer(PARCEL_FILL_LAYER)) map.moveLayer(PARCEL_FILL_LAYER);
    if (map.getLayer(PARCEL_OUTLINE_LAYER)) map.moveLayer(PARCEL_OUTLINE_LAYER);
  } catch {
    /* style en cours de chargement */
  }
}

function addParcelleLayers(map: maplibregl.Map): void {
  if (map.getSource(PARCEL_SOURCE)) return;

  map.addSource(PARCEL_SOURCE, {
    type: "geojson",
    data: fc([]),
  });
  map.addLayer({
    id: PARCEL_FILL_LAYER,
    type: "fill",
    source: PARCEL_SOURCE,
    paint: {
      "fill-color": PARCEL_YELLOW,
      "fill-opacity": 0,
    },
  });
  map.addLayer({
    id: PARCEL_OUTLINE_LAYER,
    type: "line",
    source: PARCEL_SOURCE,
    paint: {
      "line-color": PARCEL_YELLOW_OUTLINE,
      "line-width": 3,
    },
  });
}

function addBufferLayers(map: maplibregl.Map): void {
  map.addSource(BUFFER_SOURCE, {
    type: "geojson",
    data: fc([]),
  });
  map.addLayer({
    id: `${PREFIX}-buffer-fill`,
    type: "fill",
    source: BUFFER_SOURCE,
    paint: {
      "fill-color": "#3B82F6",
      "fill-opacity": 0.06,
    },
  });
  map.addLayer({
    id: `${PREFIX}-buffer-outline`,
    type: "line",
    source: BUFFER_SOURCE,
    paint: {
      "line-color": "#2563EB",
      "line-width": 1.5,
      "line-dasharray": [4, 3],
      "line-opacity": 0.7,
    },
  });
}

function ensureLayerStack(
  map: maplibregl.Map,
  layer: StudyZoneLayerPayload
): void {
  const sourceId = layerSourceId(layer.layer_id);
  if (map.getSource(sourceId)) return;

  map.addSource(sourceId, { type: "geojson", data: fc([]) });

  if (layer.geom_type === "lineaire") {
    map.addLayer({
      id: `${PREFIX}-lin-${sanitizeId(layer.layer_id)}`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": FEATURE_COLOR,
        "line-width": 2.5,
        "line-opacity": 0.9,
      },
    });
    return;
  }

  if (layer.geom_type === "ponctuel") {
    map.addLayer({
      id: `${PREFIX}-pct-${sanitizeId(layer.layer_id)}`,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-color": FEATURE_COLOR,
        "circle-radius": 6,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1.5,
      },
    });
    return;
  }

  map.addLayer({
    id: `${PREFIX}-fill-${sanitizeId(layer.layer_id)}`,
    type: "fill",
    source: sourceId,
    paint: {
      "fill-color": FEATURE_COLOR,
      "fill-opacity": 0.42,
      "fill-antialias": true,
    },
  });
  map.addLayer({
    id: `${PREFIX}-outline-${sanitizeId(layer.layer_id)}`,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": FEATURE_COLOR,
      "line-width": 1.2,
      "line-opacity": 0.85,
    },
  });
}

export function clearStudyZoneFromMap(map: maplibregl.Map): void {
  removeStudyLayers(map);
}

export function applyStudyZoneToMap(
  map: maplibregl.Map,
  context: StudyZoneCartoContext,
  filtered: Record<string, GeoJSON.Feature[]>,
  bufferPoly: GeoJSON.Feature | null,
  visibleGroups: Record<string, Set<string>> = {}
): void {
  const display = enrichFilteredForDisplay(context, filtered, visibleGroups);
  hideCommunePmtiles(map);
  removeStudyLayers(map);

  addBufferLayers(map);

  for (const layer of Object.values(context.layers)) {
    ensureLayerStack(map, layer);
  }

  addParcelleLayers(map);

  const parcelSrc = map.getSource(PARCEL_SOURCE) as maplibregl.GeoJSONSource;
  parcelSrc?.setData(fc([context.parcelle]));

  const bufferSrc = map.getSource(BUFFER_SOURCE) as maplibregl.GeoJSONSource;
  bufferSrc?.setData(fc(bufferPoly ? [bufferPoly] : []));

  for (const [layerId, features] of Object.entries(display)) {
    const src = map.getSource(layerSourceId(layerId)) as maplibregl.GeoJSONSource;
    src?.setData(fc(features));
  }

  bringStudyZoneUfToFront(map);
}

export function updateStudyZoneOnMap(
  map: maplibregl.Map,
  context: StudyZoneCartoContext,
  filtered: Record<string, GeoJSON.Feature[]>,
  bufferPoly: GeoJSON.Feature | null,
  visibleGroups: Record<string, Set<string>> = {}
): void {
  const display = enrichFilteredForDisplay(context, filtered, visibleGroups);
  const bufferSrc = map.getSource(BUFFER_SOURCE) as maplibregl.GeoJSONSource;
  bufferSrc?.setData(fc(bufferPoly ? [bufferPoly] : []));

  for (const layer of Object.values(context.layers)) {
    if (!map.getSource(layerSourceId(layer.layer_id))) {
      ensureLayerStack(map, layer);
    }
    const src = map.getSource(layerSourceId(layer.layer_id)) as maplibregl.GeoJSONSource;
    src?.setData(fc(display[layer.layer_id] ?? []));
  }

  if (!map.getSource(PARCEL_SOURCE)) {
    addParcelleLayers(map);
  }
  const parcelSrc = map.getSource(PARCEL_SOURCE) as maplibregl.GeoJSONSource;
  parcelSrc?.setData(fc([context.parcelle]));

  bringStudyZoneUfToFront(map);
}

export function fitStudyZoneBounds(
  map: maplibregl.Map,
  parcelle: GeoJSON.Feature,
  filtered: Record<string, GeoJSON.Feature[]>
): void {
  const coords: number[][] = [];
  const collect = (geojson: unknown) => {
    if (!geojson) return;
    if (Array.isArray(geojson) && typeof geojson[0] === "number") {
      coords.push(geojson as number[]);
      return;
    }
    if (Array.isArray(geojson)) {
      geojson.forEach(collect);
      return;
    }
    if (typeof geojson === "object" && geojson !== null) {
      const g = geojson as GeoJSON.Geometry | GeoJSON.Feature;
      if ("type" in g && g.type === "Feature") {
        collect((g as GeoJSON.Feature).geometry);
        return;
      }
      if ("coordinates" in g) collect((g as GeoJSON.Geometry).coordinates);
      if ("geometries" in g) {
        (g as GeoJSON.GeometryCollection).geometries.forEach(collect);
      }
    }
  };

  collect(parcelle.geometry);
  for (const features of Object.values(filtered)) {
    for (const f of features) collect(f.geometry);
  }

  if (coords.length === 0) return;

  let minX = coords[0][0];
  let minY = coords[0][1];
  let maxX = coords[0][0];
  let maxY = coords[0][1];
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  map.fitBounds(
    [
      [minX, minY],
      [maxX, maxY],
    ],
    { padding: 56, duration: 600, maxZoom: 18 }
  );
}

export function defaultVisibleLayerIds(context: StudyZoneCartoContext): Set<string> {
  const ids = new Set<string>();
  for (const layer of Object.values(context.layers)) {
    const hasParcelHit = (layer.features?.features ?? []).some(
      (f) => (f.properties as { intersects_parcel?: boolean })?.intersects_parcel
    );
    const hasAny = (layer.features?.features ?? []).length > 0;
    if (hasParcelHit || hasAny) ids.add(layer.layer_id);
  }
  return ids;
}

export function studyZoneLayerSummary(context: StudyZoneCartoContext): Array<{
  layerId: string;
  title: string;
  family: string;
  familyTitle: string;
  total: number;
  parcelHits: number;
}> {
  return Object.values(context.layers)
    .filter((l) => (l.features?.features ?? []).length > 0)
    .map((l) => ({
      layerId: l.layer_id,
      title: l.title,
      family: l.family,
      familyTitle: l.family_title,
      total: l.features.features.length,
      parcelHits: l.features.features.filter(
        (f) => (f.properties as { intersects_parcel?: boolean })?.intersects_parcel
      ).length,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
}

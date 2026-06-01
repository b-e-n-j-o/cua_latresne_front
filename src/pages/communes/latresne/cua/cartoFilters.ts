import type maplibregl from "maplibre-gl";
import type { CartoLayerDef } from "./cartoLayers";
import { CARTO_LAYERS } from "./cartoLayers";

export const EMPTY_GROUP_KEY = "(NON RENSEIGNÉ)";

/** Clé de regroupement (majuscules), alignée sur categoricalFillColor (longueur → palette). */
export function groupKeyFromRaw(raw: unknown): string {
  const s = raw != null ? String(raw).trim() : "";
  return s ? s.toUpperCase() : EMPTY_GROUP_KEY;
}

export function colorForGroupKey(
  key: string,
  palette: readonly string[],
  fallback: string
): string {
  if (key === EMPTY_GROUP_KEY) return fallback;
  return palette[key.length % palette.length] ?? fallback;
}

/** Filtre MapLibre : n'affiche que les valeurs cochées du groupe. */
export function buildGroupFilter(
  field: string,
  activeKeys: readonly string[]
): maplibregl.FilterSpecification {
  if (activeKeys.length === 0) {
    return ["==", ["literal", 1], ["literal", 0]];
  }

  const values: string[] = [];
  for (const key of activeKeys) {
    if (key === EMPTY_GROUP_KEY) values.push("");
    else values.push(key);
  }

  return [
    "in",
    ["upcase", ["to-string", ["coalesce", ["get", field], ""]]],
    ["literal", values],
  ];
}

export type CartoGroupItem = {
  key: string;
  count: number;
  color: string;
  label?: string;
};

/** Valeurs distinctes chargées dans les tuiles visibles. */
export function discoverGroupValues(
  map: maplibregl.Map,
  def: CartoLayerDef
): CartoGroupItem[] {
  if (!def.groupField || !map.getSource(def.id)) return [];

  let features: maplibregl.MapGeoJSONFeature[] = [];
  try {
    features = map.querySourceFeatures(def.id, {
      sourceLayer: def.sourceLayer,
    });
  } catch {
    return [];
  }

  const palette = def.filterPalette ?? [];
  const fallback = def.filterFallback ?? "#888888";
  const counts = new Map<string, number>();

  for (const f of features) {
    const key = groupKeyFromRaw((f.properties as Record<string, unknown>)?.[def.groupField]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([key, count]) => ({
      key,
      count,
      color: def.groupColorMap?.[key] ?? colorForGroupKey(key, palette, fallback),
    }));
}

/** Fusionne légende statique (config) et comptages issus des tuiles chargées. */
export function mergeStaticGroupLegend(
  def: CartoLayerDef,
  discovered: CartoGroupItem[]
): CartoGroupItem[] {
  if (!def.staticGroupLegend?.length) return discovered;
  const countByKey = new Map(discovered.map((d) => [d.key, d.count]));
  return def.staticGroupLegend.map((item) => ({
    key: item.key,
    label: item.label,
    count: countByKey.get(item.key) ?? 0,
    color: item.color,
  }));
}

export function syncCartoOnMap(
  map: maplibregl.Map,
  layerVisible: Record<string, boolean>,
  visibleGroups: Record<string, Set<string>>
): void {
  if (!map.isStyleLoaded()) return;

  for (const def of CARTO_LAYERS) {
    const on = !!layerVisible[def.id];
    const layoutVis: "visible" | "none" = on ? "visible" : "none";

    let filter: maplibregl.FilterSpecification | null = null;
    if (on && def.groupField) {
      const active = visibleGroups[def.id];
      // undefined = tuiles pas encore parcourues → tout afficher
      if (active !== undefined) {
        filter = buildGroupFilter(def.groupField, [...active]);
      }
    }

    for (const sub of def.layers) {
      if (!map.getLayer(sub.id)) continue;
      map.setLayoutProperty(sub.id, "visibility", layoutVis);
      if (def.groupField) {
        map.setFilter(sub.id, on ? filter : null);
      }
    }
  }
}

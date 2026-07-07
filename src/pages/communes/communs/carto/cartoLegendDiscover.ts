import type maplibregl from "maplibre-gl";
import { EMPTY_GROUP_KEY, resolveClassColor } from "./cartoClassColors";

export type LegendCatalogItem = {
  key: string;
  count: number;
  color: string;
  label?: string;
};

export type LegendCatalogLayerDef = {
  id: string;
  groupField?: string;
  sourceLayer?: string;
  pmtilesUrl?: string;
  groupColorMap?: Record<string, string>;
  filterFallback?: string;
  staticGroupLegend?: readonly { key: string; label: string; color: string }[];
};

const catalogByLayer = new Map<string, Map<string, LegendCatalogItem>>();
const harvestedLayers = new Set<string>();

export function groupKeyFromRaw(raw: unknown): string {
  const s = raw != null ? String(raw).trim() : "";
  return s ? s.toUpperCase() : EMPTY_GROUP_KEY;
}

function waitMapIdle(map: maplibregl.Map): Promise<void> {
  return new Promise((resolve) => {
    if (map.loaded() && !map.isMoving()) {
      resolve();
      return;
    }
    map.once("idle", () => resolve());
  });
}

function seedStaticEntries(def: LegendCatalogLayerDef, store: Map<string, LegendCatalogItem>): void {
  for (const item of def.staticGroupLegend ?? []) {
    if (!store.has(item.key)) {
      store.set(item.key, {
        key: item.key,
        label: item.label,
        color: item.color,
        count: 0,
      });
    }
  }
}

function mergeIntoCatalog(
  def: LegendCatalogLayerDef,
  items: readonly LegendCatalogItem[],
): LegendCatalogItem[] {
  const store = catalogByLayer.get(def.id) ?? new Map<string, LegendCatalogItem>();
  for (const item of items) {
    const prev = store.get(item.key);
    store.set(item.key, {
      key: item.key,
      label: item.label ?? prev?.label ?? item.key,
      color: item.color,
      count: Math.max(prev?.count ?? 0, item.count),
    });
  }
  seedStaticEntries(def, store);
  catalogByLayer.set(def.id, store);
  return [...store.values()].sort((a, b) => a.key.localeCompare(b.key, "fr"));
}

/** Valeurs distinctes dans les tuiles actuellement chargées (souvent = fenêtre visible). */
export function queryViewportGroupValues(
  map: maplibregl.Map,
  def: LegendCatalogLayerDef,
): LegendCatalogItem[] {
  if (!def.groupField || !map.getSource(def.id)) return [];

  let features: maplibregl.MapGeoJSONFeature[] = [];
  try {
    features = map.querySourceFeatures(def.id, {
      sourceLayer: def.sourceLayer,
    }) as maplibregl.MapGeoJSONFeature[];
  } catch {
    return [];
  }

  const counts = new Map<string, number>();
  for (const feature of features) {
    const props = feature.properties as Record<string, unknown>;
    const key = groupKeyFromRaw(props?.[def.groupField]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([key, count]) => ({
      key,
      count,
      color: resolveClassColor(key, def),
    }));
}

/** Fusionne la vue courante dans le catalogue persistant (clés jamais retirées). */
export function mergeLegendCatalog(
  def: LegendCatalogLayerDef,
  discovered: readonly LegendCatalogItem[],
): LegendCatalogItem[] {
  return mergeIntoCatalog(def, discovered);
}

/**
 * Parcourt toute la commune une fois (tuiles à l'échelle communale) pour lister
 * toutes les entités distinctes, indépendamment du zoom courant.
 */
export async function harvestLegendAtCommuneExtent(
  map: maplibregl.Map,
  def: LegendCatalogLayerDef,
  bounds: [number, number, number, number],
): Promise<void> {
  if (harvestedLayers.has(def.id)) return;
  if (!def.groupField || !def.pmtilesUrl || !map.getSource(def.id)) return;

  harvestedLayers.add(def.id);

  const prev = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };

  map.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    { maxZoom: 12, animate: false, padding: 8 },
  );
  await waitMapIdle(map);

  mergeIntoCatalog(def, queryViewportGroupValues(map, def));

  map.jumpTo(
    {
      center: prev.center,
      zoom: prev.zoom,
      bearing: prev.bearing,
      pitch: prev.pitch,
    },
    { animate: false },
  );
}

export function isLegendLayerHarvested(layerId: string): boolean {
  return harvestedLayers.has(layerId);
}

export function resetLegendCatalogForTests(): void {
  catalogByLayer.clear();
  harvestedLayers.clear();
}

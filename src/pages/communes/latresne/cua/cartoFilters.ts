import type maplibregl from "maplibre-gl";
import {
  EMPTY_GROUP_KEY,
  applyLayerClassColors,
} from "../../communs/carto/cartoClassColors";
import {
  groupKeyFromRaw,
  mergeLegendCatalog,
  queryViewportGroupValues,
} from "../../communs/carto/cartoLegendDiscover";
import type { CartoLayerDef } from "./cartoLayers";
import { CARTO_LAYERS, findOverlayBeforeId } from "./cartoLayers";

export { EMPTY_GROUP_KEY, groupKeyFromRaw };

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

/** Catalogue cumulatif : fusionne la vue courante + récolte communale. */
export function discoverGroupValues(
  map: maplibregl.Map,
  def: CartoLayerDef
): CartoGroupItem[] {
  const viewport = queryViewportGroupValues(map, def);
  return mergeLegendCatalog(def, viewport);
}

/** Alias conservé pour l’API légende partagée. */
export function mergeStaticGroupLegend(
  def: CartoLayerDef,
  discovered: CartoGroupItem[]
): CartoGroupItem[] {
  return mergeLegendCatalog(def, discovered);
}

/** Ajoute source + sous-couches PMTiles si besoin (visibilité « none » jusqu’à sync). */
export function ensureCartoLayerMounted(
  map: maplibregl.Map,
  def: CartoLayerDef,
  beforeId?: string
): void {
  if (!def.pmtilesUrl || !def.layers.length) return;

  const insertBefore = beforeId ?? findOverlayBeforeId(map);

  if (!map.getSource(def.id)) {
    map.addSource(def.id, {
      type: "vector",
      url: `pmtiles://${def.pmtilesUrl}`,
    });
  }

  for (const sub of def.layers) {
    if (map.getLayer(sub.id)) continue;
    map.addLayer(
      {
        ...sub,
        source: def.id,
        "source-layer": def.sourceLayer,
        layout: {
          ...(sub.layout ?? {}),
          visibility: "none",
        },
      } as maplibregl.LayerSpecification,
      insertBefore
    );
  }
}

export function syncCartoOnMap(
  map: maplibregl.Map,
  layerVisible: Record<string, boolean>,
  visibleGroups: Record<string, Set<string>>,
  classColors: Record<string, Record<string, string>> = {},
  onAfterSync?: (map: maplibregl.Map) => void,
): void {
  if (!map.isStyleLoaded()) return;

  const beforeId = findOverlayBeforeId(map);

  for (const def of CARTO_LAYERS) {
    const on = !!layerVisible[def.id];

    if (on) {
      ensureCartoLayerMounted(map, def, beforeId);
    }

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

    if (on && def.groupField) {
      const layerColors = classColors[def.id];
      if (layerColors && Object.keys(layerColors).length > 0) {
        applyLayerClassColors(map, def, layerColors);
      }
    }
  }

  onAfterSync?.(map);
}

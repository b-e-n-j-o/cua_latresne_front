import type maplibregl from "maplibre-gl";
import type { RefObject } from "react";

export type CartoTooltipLayerDef = {
  id: string;
  title: string;
  tooltipField?: string;
  layers: readonly { id: string; type: string }[];
};

const INTERACTIVE_TYPES = new Set(["fill", "line", "circle"]);

export function formatCartoTooltipText(
  def: CartoTooltipLayerDef,
  props: Record<string, unknown>
): string {
  if (def.id === "zonage") {
    const code = props.zonage_reglement ?? props.typezone ?? "Zone";
    const lib = props.libelle ? ` — ${props.libelle}` : "";
    return `${String(code).trim()}${lib}`.toUpperCase();
  }

  if (def.id === "zonage-plu") {
    const raw = props.libelle ?? props.typezone;
    if (raw != null && String(raw).trim()) {
      return String(raw).trim().toUpperCase();
    }
    return def.title.toUpperCase();
  }

  if (def.tooltipField) {
    const raw = props[def.tooltipField];
    if (raw != null && String(raw).trim()) {
      return String(raw).trim().toUpperCase();
    }
  }

  return def.title.toUpperCase();
}

function interactiveLayerIds(def: CartoTooltipLayerDef): string[] {
  return def.layers
    .filter((l) => INTERACTIVE_TYPES.has(l.type))
    .map((l) => l.id);
}

function buildLayerIndex(
  defs: readonly CartoTooltipLayerDef[]
): Map<string, CartoTooltipLayerDef> {
  const index = new Map<string, CartoTooltipLayerDef>();
  for (const def of defs) {
    for (const layer of def.layers) {
      if (INTERACTIVE_TYPES.has(layer.type)) {
        index.set(layer.id, def);
      }
    }
  }
  return index;
}

function visibleInteractiveLayerIds(
  map: maplibregl.Map,
  defs: readonly CartoTooltipLayerDef[],
  layerVisible: Record<string, boolean>
): string[] {
  const ids: string[] = [];
  for (const def of defs) {
    if (def.id === "parcelles" || !layerVisible[def.id]) continue;
    for (const id of interactiveLayerIds(def)) {
      if (!map.getLayer(id)) continue;
      if (map.getLayoutProperty(id, "visibility") === "none") continue;
      ids.push(id);
    }
  }
  return ids;
}

export function cartoTooltipLinesAtPoint(
  map: maplibregl.Map,
  point: maplibregl.PointLike,
  defs: readonly CartoTooltipLayerDef[],
  layerVisible: Record<string, boolean>,
): string[] {
  const queryIds = visibleInteractiveLayerIds(map, defs, layerVisible);
  if (!queryIds.length) return [];

  const layerIndex = buildLayerIndex(defs);
  const defOrder = new Map(defs.map((def, index) => [def.id, index]));

  let features: maplibregl.MapGeoJSONFeature[];
  try {
    features = map.queryRenderedFeatures(point, { layers: queryIds });
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const lines: { order: number; text: string }[] = [];

  for (const feature of features) {
    if (!feature?.layer?.id) continue;
    const def = layerIndex.get(feature.layer.id);
    if (!def || seen.has(def.id)) continue;
    seen.add(def.id);
    lines.push({
      order: defOrder.get(def.id) ?? 999,
      text: formatCartoTooltipText(def, (feature.properties ?? {}) as Record<string, unknown>),
    });
  }

  return lines.sort((a, b) => a.order - b.order).map((line) => line.text);
}

export function cartoTooltipAtPoint(
  map: maplibregl.Map,
  point: maplibregl.PointLike,
  defs: readonly CartoTooltipLayerDef[],
  layerVisible: Record<string, boolean>,
): string | null {
  const lines = cartoTooltipLinesAtPoint(map, point, defs, layerVisible);
  return lines.length ? lines.join("\n") : null;
}

export function appendCartoTooltipLine(
  map: maplibregl.Map,
  point: maplibregl.PointLike,
  defs: readonly CartoTooltipLayerDef[],
  layerVisible: Record<string, boolean>,
  baseContent: string,
): string {
  const lines = cartoTooltipLinesAtPoint(map, point, defs, layerVisible);
  if (!lines.length) return baseContent;
  return [baseContent, ...lines].join("\n");
}

export type CartoHoverOptions = {
  defs: readonly CartoTooltipLayerDef[];
  layerVisibleRef: RefObject<Record<string, boolean>>;
  /** Couche fill cadastre (si présente) : le survol parcelle garde la priorité. */
  parcelleHitLayerId?: string;
  canShow: () => boolean;
  setTooltip: (tooltip: { x: number; y: number; content: string } | null) => void;
};

/** Survol des couches PMTiles via queryRenderedFeatures (fonctionne sous le cadastre). */
export function attachCartoHoverHandlers(
  map: maplibregl.Map,
  opts: CartoHoverOptions
): () => void {
  const { defs, layerVisibleRef, parcelleHitLayerId, canShow, setTooltip } = opts;

  const onMove = (e: maplibregl.MapMouseEvent) => {
    if (!canShow()) return;

    if (
      parcelleHitLayerId &&
      map.getLayer(parcelleHitLayerId) &&
      map.queryRenderedFeatures(e.point, { layers: [parcelleHitLayerId] }).length > 0
    ) {
      return;
    }

    const text = cartoTooltipAtPoint(map, e.point, defs, layerVisibleRef.current);
    if (text) {
      map.getCanvas().style.cursor = "pointer";
      setTooltip({ x: e.point.x, y: e.point.y, content: text });
      return;
    }

    map.getCanvas().style.cursor = "";
    setTooltip(null);
  };

  const onLeave = () => {
    if (!canShow()) return;
    map.getCanvas().style.cursor = "";
    setTooltip(null);
  };

  map.on("mousemove", onMove);
  map.on("mouseleave", onLeave);

  return () => {
    map.off("mousemove", onMove);
    map.off("mouseleave", onLeave);
  };
}

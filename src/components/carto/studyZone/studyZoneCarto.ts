import {
  CARTO_LAYERS,
  ZONAGE_LEGEND,
  type CartoLayerDef,
} from "../../../pages/communes/argeles/cua/cartoLayers";
import {
  colorForGroupKey,
  EMPTY_GROUP_KEY,
  groupKeyFromRaw,
  type CartoGroupItem,
} from "../../../pages/communes/argeles/cua/cartoFilters";
import type { StudyZoneLayerPayload } from "./types";

const ZONAGE_GROUP_KEYS = ["U", "AU", "A", "N"] as const;
const ZONAGE_COLOR_BY_KEY: Record<string, string> = {
  U: ZONAGE_LEGEND[0].color,
  AU: ZONAGE_LEGEND[1].color,
  A: ZONAGE_LEGEND[2].color,
  N: ZONAGE_LEGEND[3].color,
};

/** Couche PMTiles communale correspondant à un layer_id API (ex. zonage_plu). */
export function cartoDefForStudyLayer(layerId: string): CartoLayerDef | undefined {
  return CARTO_LAYERS.find((d) => d.sourceLayer === layerId);
}

/** Champ discriminant aligné sur CartoLegendPanel (groupField PMTiles > catalogue group > tip). */
export function studyDiscriminantField(layer: StudyZoneLayerPayload): string | null {
  const def = cartoDefForStudyLayer(layer.layer_id);
  return def?.groupField ?? layer.group ?? layer.tip ?? null;
}

export function isZonageStudyLayer(layer: StudyZoneLayerPayload): boolean {
  return layer.legend === "zonage" || layer.layer_id === "zonage_plu";
}

export function zonageGroupKeyFromProps(props: Record<string, unknown>): string {
  const code = String(props.libelle ?? props.zonage_reglement ?? props.typezone ?? "")
    .trim()
    .toUpperCase();
  if (!code) return EMPTY_GROUP_KEY;
  if (code.startsWith("AU") || code.startsWith("1AU") || code.startsWith("2AU")) return "AU";
  if (code.startsWith("N")) return "N";
  if (code.startsWith("A")) return "A";
  return "U";
}

export function studyGroupKey(
  layer: StudyZoneLayerPayload,
  props: Record<string, unknown>
): string {
  if (isZonageStudyLayer(layer)) return zonageGroupKeyFromProps(props);
  const field = studyDiscriminantField(layer);
  if (!field) return "_all";
  return groupKeyFromRaw(props[field]);
}

export function studyGroupColor(
  layer: StudyZoneLayerPayload,
  key: string,
  props?: Record<string, unknown>
): string {
  const def = cartoDefForStudyLayer(layer.layer_id);

  if (isZonageStudyLayer(layer)) {
    if (props) return ZONAGE_COLOR_BY_KEY[zonageGroupKeyFromProps(props)] ?? "#bdbdbd";
    return ZONAGE_COLOR_BY_KEY[key] ?? "#bdbdbd";
  }

  if (def?.groupColorMap?.[key]) return def.groupColorMap[key];
  const staticItem = def?.staticGroupLegend?.find((i) => i.key === key);
  if (staticItem) return staticItem.color;

  const palette = def?.filterPalette ?? [];
  const fallback = def?.filterFallback ?? "#888888";
  return colorForGroupKey(key, palette, fallback);
}

export function studyLayerFilterable(layer: StudyZoneLayerPayload): boolean {
  const def = cartoDefForStudyLayer(layer.layer_id);
  if (def?.colorLegend?.length && !def.groupField && !isZonageStudyLayer(layer)) {
    return false;
  }
  return !!studyDiscriminantField(layer) || isZonageStudyLayer(layer);
}

export function mergeStudyLegendItems(
  layer: StudyZoneLayerPayload,
  discovered: CartoGroupItem[]
): CartoGroupItem[] {
  const def = cartoDefForStudyLayer(layer.layer_id);
  if (def?.staticGroupLegend?.length) {
    const countByKey = new Map(discovered.map((d) => [d.key, d.count]));
    return def.staticGroupLegend.map((item) => ({
      key: item.key,
      label: item.label,
      count: countByKey.get(item.key) ?? 0,
      color: item.color,
    }));
  }
  if (isZonageStudyLayer(layer)) {
    const countByKey = new Map(discovered.map((d) => [d.key, d.count]));
    return ZONAGE_GROUP_KEYS.map((zonageKey, i) => ({
      key: zonageKey,
      label: ZONAGE_LEGEND[i]?.label ?? zonageKey,
      color: ZONAGE_LEGEND[i]?.color ?? "#bdbdbd",
      count: countByKey.get(zonageKey) ?? 0,
    }));
  }
  return discovered;
}

export function buildInitialVisibleGroups(
  context: { layers: Record<string, StudyZoneLayerPayload> },
  legends: Array<{ layerId: string; filterable: boolean; items: { key: string }[] }>
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const legend of legends) {
    if (!legend.filterable || legend.items.length === 0) continue;
    out[legend.layerId] = new Set(legend.items.map((i) => i.key));
  }
  return out;
}

export function mergeVisibleGroupKeys(
  prev: Record<string, Set<string>>,
  legends: Array<{ layerId: string; filterable: boolean; items: { key: string }[] }>
): Record<string, Set<string>> {
  const next: Record<string, Set<string>> = { ...prev };
  for (const legend of legends) {
    if (!legend.filterable) continue;
    const keys = legend.items.map((i) => i.key);
    if (!next[legend.layerId]) {
      next[legend.layerId] = new Set(keys);
      continue;
    }
    const set = new Set(next[legend.layerId]);
    for (const k of keys) set.add(k);
    next[legend.layerId] = set;
  }
  return next;
}

/** Types, arbre de légende et garde-fou top-K (affichage classes). */

export type LegendGroupItem = {
  key: string;
  count: number;
  color: string;
  label?: string;
};

export type LegendFamilyDef = {
  id: string;
  title: string;
};

/** Sous-ensemble de CartoLayerDef utilisé par la légende. */
export type LegendLayerCatalogDef = {
  id: string;
  title: string;
  family?: string;
  groupField?: string;
  colorLegend?: readonly { label: string; color: string }[];
  staticGroupLegend?: readonly { key: string; label: string; color: string }[];
};

export type LegendCategoryNode = {
  id: string;
  title: string;
  layerIds: string[];
};

export type LegendClassDisplayItem = {
  key: string;
  label: string;
  color: string;
  count?: number;
  isOther?: boolean;
};

export type PreparedClassList = {
  displayItems: LegendClassDisplayItem[];
  /** Clés regroupées sous « Autres » (filtre carte). */
  autresKeys: string[];
  truncated: boolean;
  totalDistinct: number;
};

export const LEGEND_CLASS_TOP_K = 999;
export const LEGEND_CLASS_ROWS_VISIBLE = 6;
export const LEGEND_AUTRES_KEY = "__AUTRES__";
export const LEGEND_AUTRES_COLOR = "#9aa3af";

export function buildLegendTree(
  families: readonly LegendFamilyDef[],
  layers: readonly LegendLayerCatalogDef[],
): { categories: LegendCategoryNode[]; standaloneLayerIds: string[] } {
  const byFamily = new Map<string, string[]>();
  const standaloneLayerIds: string[] = [];

  for (const layer of layers) {
    if (layer.family) {
      const list = byFamily.get(layer.family) ?? [];
      list.push(layer.id);
      byFamily.set(layer.family, list);
    } else {
      standaloneLayerIds.push(layer.id);
    }
  }

  const categories = families
    .map((family) => ({
      id: family.id,
      title: family.title,
      layerIds: byFamily.get(family.id) ?? [],
    }))
    .filter((category) => category.layerIds.length > 0);

  return { categories, standaloneLayerIds };
}

export function layerHasClassList(def: LegendLayerCatalogDef): boolean {
  return !!(def.groupField || def.colorLegend?.length);
}

export function layerColorLegendOnly(def: LegendLayerCatalogDef): boolean {
  return !!(def.colorLegend?.length) && !def.groupField;
}

/** Top-K côté client : trie les classes par effectif dans la vue courante. */
export function prepareClassListForDisplay(
  items: LegendGroupItem[],
  topK = LEGEND_CLASS_TOP_K,
): PreparedClassList {
  const mapped: LegendClassDisplayItem[] = items.map((item) => ({
    key: item.key,
    label: item.label ?? item.key,
    color: item.color,
    count: item.count,
  }));

  if (mapped.length <= topK) {
    return {
      displayItems: mapped,
      autresKeys: [],
      truncated: false,
      totalDistinct: mapped.length,
    };
  }

  const sorted = [...mapped].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  const top = sorted.slice(0, topK);
  const rest = sorted.slice(topK);
  const autresCount = rest.reduce((sum, item) => sum + (item.count ?? 0), 0);

  return {
    displayItems: [
      ...top,
      {
        key: LEGEND_AUTRES_KEY,
        label: "Autres",
        color: LEGEND_AUTRES_COLOR,
        count: autresCount,
        isOther: true,
      },
    ],
    autresKeys: rest.map((item) => item.key),
    truncated: true,
    totalDistinct: mapped.length,
  };
}

export function isClassVisible(
  layerId: string,
  classKey: string,
  activeKeys: Set<string> | undefined,
  autresKeysByLayer: Record<string, string[]>,
): boolean {
  if (!activeKeys) return true;
  if (classKey === LEGEND_AUTRES_KEY) {
    const autresKeys = autresKeysByLayer[layerId] ?? [];
    if (!autresKeys.length) return true;
    return autresKeys.some((key) => activeKeys.has(key));
  }
  return activeKeys.has(classKey);
}

export function toggleClassVisibility(
  prev: Set<string> | undefined,
  classKey: string,
  autresKeys: string[],
): Set<string> {
  const set = new Set(prev ?? []);
  if (classKey === LEGEND_AUTRES_KEY) {
    const allOn = autresKeys.some((key) => set.has(key));
    if (allOn) autresKeys.forEach((key) => set.delete(key));
    else autresKeys.forEach((key) => set.add(key));
    return set;
  }
  if (set.has(classKey)) set.delete(classKey);
  else set.add(classKey);
  return set;
}

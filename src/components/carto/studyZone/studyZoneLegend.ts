import { objectLabelFromTip } from "../../../utils/argeles/fullIntersections";
import { EMPTY_GROUP_KEY, type CartoGroupItem } from "../../../pages/communes/argeles/cua/cartoFilters";
import {
  cartoDefForStudyLayer,
  isZonageStudyLayer,
  mergeStudyLegendItems,
  studyDiscriminantField,
  studyGroupColor,
  studyGroupKey,
  studyLayerFilterable,
} from "./studyZoneCarto";
import { FAMILY_COLORS } from "./studyZoneMap";
import type { StudyZoneLayerPayload } from "./types";

export type StudyZoneLegendItem = {
  key: string;
  label: string;
  color: string;
  count: number;
};

export type StudyZoneLayerLegend = {
  layerId: string;
  title: string;
  field: string | null;
  fieldLabel: string;
  filterable: boolean;
  colorLegendOnly: boolean;
  items: StudyZoneLegendItem[];
};

const SKIP_TOOLTIP_KEYS = new Set([
  "_fid",
  "_studyKey",
  "_studyColor",
  "_studyLabel",
  "_layerId",
  "intersects_parcel",
]);

function fieldLabelForLayer(layer: StudyZoneLayerPayload): string {
  const def = cartoDefForStudyLayer(layer.layer_id);
  const field = studyDiscriminantField(layer);
  if (isZonageStudyLayer(layer)) return "Type de zone (U / AU / A / N)";
  if (def?.groupField) return def.groupField;
  return field ?? "—";
}

function labelForGroupItem(
  layer: StudyZoneLayerPayload,
  field: string | null,
  key: string,
  props: Record<string, unknown>
): string {
  if (key === EMPTY_GROUP_KEY) return "Non renseigné";
  if (isZonageStudyLayer(layer)) {
    const def = cartoDefForStudyLayer(layer.layer_id);
    const staticLabel = mergeStudyLegendItems(layer, []).find((i) => i.key === key)?.label;
    if (staticLabel) return staticLabel;
  }
  const def = cartoDefForStudyLayer(layer.layer_id);
  const staticLabel = def?.staticGroupLegend?.find((i) => i.key === key)?.label;
  if (staticLabel) return staticLabel;
  if (field) return objectLabelFromTip(field, props, key);
  return objectLabelFromTip(layer.tip, props, key);
}

function discoverLegendItems(
  layer: StudyZoneLayerPayload,
  features: GeoJSON.Feature[]
): CartoGroupItem[] {
  const field = studyDiscriminantField(layer);
  const counts = new Map<string, number>();

  for (const f of features) {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const key = studyGroupKey(layer, props);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const discovered: CartoGroupItem[] = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([key, count]) => {
      const sample = features.find(
        (f) => studyGroupKey(layer, (f.properties ?? {}) as Record<string, unknown>) === key
      );
      const props = (sample?.properties ?? {}) as Record<string, unknown>;
      return {
        key,
        label: labelForGroupItem(layer, field, key, props),
        color: studyGroupColor(layer, key, props),
        count,
      };
    });

  return mergeStudyLegendItems(layer, discovered);
}

export function buildLayerLegend(
  layer: StudyZoneLayerPayload,
  features: GeoJSON.Feature[]
): StudyZoneLayerLegend {
  const field = studyDiscriminantField(layer);
  const def = cartoDefForStudyLayer(layer.layer_id);
  const filterable = studyLayerFilterable(layer);
  const colorLegendOnly = !!(def?.colorLegend?.length) && !def?.groupField && !isZonageStudyLayer(layer);

  if (!field && !isZonageStudyLayer(layer) && features.length === 0) {
    return {
      layerId: layer.layer_id,
      title: layer.title,
      field,
      fieldLabel: fieldLabelForLayer(layer),
      filterable: false,
      colorLegendOnly: false,
      items: [],
    };
  }

  if ((!field && !isZonageStudyLayer(layer)) || features.length === 0) {
    const color = FAMILY_COLORS[layer.family] ?? FAMILY_COLORS._other;
    return {
      layerId: layer.layer_id,
      title: layer.title,
      field,
      fieldLabel: fieldLabelForLayer(layer),
      filterable: false,
      colorLegendOnly,
      items: features.length
        ? [{ key: "_all", label: layer.title, color, count: features.length }]
        : colorLegendOnly
          ? (def?.colorLegend?.map((l) => ({
              key: l.label,
              label: l.label,
              color: l.color,
              count: 0,
            })) ?? [])
          : [],
    };
  }

  const items: StudyZoneLegendItem[] = discoverLegendItems(layer, features).map((item) => ({
    key: item.key,
    label: item.label ?? item.key,
    color: item.color,
    count: item.count,
  }));

  return {
    layerId: layer.layer_id,
    title: layer.title,
    field,
    fieldLabel: fieldLabelForLayer(layer),
    filterable,
    colorLegendOnly,
    items,
  };
}

export function enrichStudyZoneFeatures(
  layer: StudyZoneLayerPayload,
  features: GeoJSON.Feature[]
): GeoJSON.Feature[] {
  const legend = buildLayerLegend(layer, features);
  const colorByKey = new Map(legend.items.map((i) => [i.key, i.color]));
  const labelByKey = new Map(legend.items.map((i) => [i.key, i.label]));
  const field = studyDiscriminantField(layer);
  const familyColor = FAMILY_COLORS[layer.family] ?? FAMILY_COLORS._other;

  return features.map((f) => {
    const props = { ...(f.properties as Record<string, unknown>) };
    const key = studyGroupKey(layer, props);
    let color = colorByKey.get(key) ?? studyGroupColor(layer, key, props);
    if (!field && !isZonageStudyLayer(layer)) {
      color = familyColor;
    }

    props._studyKey = key;
    props._studyColor = color;
    props._studyLabel =
      labelByKey.get(key) ??
      labelForGroupItem(layer, field, key, props);
    props._layerId = layer.layer_id;

    return { ...f, properties: props };
  });
}

export function applyStudyZoneGroupFilter(
  context: { layers: Record<string, StudyZoneLayerPayload> },
  filtered: Record<string, GeoJSON.Feature[]>,
  visibleGroups: Record<string, Set<string>>
): Record<string, GeoJSON.Feature[]> {
  const out: Record<string, GeoJSON.Feature[]> = {};
  for (const [layerId, features] of Object.entries(filtered)) {
    const layer = context.layers[layerId];
    if (!layer || !studyLayerFilterable(layer)) {
      out[layerId] = features;
      continue;
    }
    const active = visibleGroups[layerId];
    if (active === undefined) {
      out[layerId] = features;
      continue;
    }
    if (active.size === 0) {
      out[layerId] = [];
      continue;
    }
    out[layerId] = features.filter((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>;
      const key = String(props._studyKey ?? studyGroupKey(layer, props));
      return active.has(key);
    });
  }
  return out;
}

export function buildStudyZoneLegends(
  context: { layers: Record<string, StudyZoneLayerPayload> },
  filtered: Record<string, GeoJSON.Feature[]>
): StudyZoneLayerLegend[] {
  return Object.values(context.layers)
    .filter((l) => (filtered[l.layer_id]?.length ?? 0) > 0)
    .map((l) => buildLayerLegend(l, filtered[l.layer_id] ?? []))
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
}

export function formatStudyZoneTooltipHtml(
  layer: StudyZoneLayerPayload,
  props: Record<string, unknown>
): string {
  const title = objectLabelFromTip(layer.tip, props, layer.title);
  const rows: string[] = [];

  for (const [k, v] of Object.entries(props)) {
    if (SKIP_TOOLTIP_KEYS.has(k) || v == null || String(v).trim() === "") continue;
    if (k === layer.tip) continue;
    rows.push(
      `<div class="text-[10px] leading-snug"><span class="text-gray-500">${k}</span> : ${String(v)}</div>`
    );
  }

  const metrics: string[] = [];
  if (typeof props.pct_sig === "number") metrics.push(`${props.pct_sig} % parcelle`);
  if (typeof props.surface_inter_m2 === "number") metrics.push(`${props.surface_inter_m2} m²`);
  if (typeof props.longueur_inter_m === "number") metrics.push(`${props.longueur_inter_m} m lin.`);
  if (props.intersects_parcel === false) metrics.push("contexte (hors parcelle)");

  return `
    <div class="space-y-1 max-w-[240px]">
      <div class="text-xs font-semibold text-gray-900">${title}</div>
      <div class="text-[10px] text-gray-500">${layer.title}</div>
      ${metrics.length ? `<div class="text-[10px] text-blue-800">${metrics.join(" · ")}</div>` : ""}
      ${rows.length ? `<div class="pt-1 border-t border-gray-100 space-y-0.5">${rows.join("")}</div>` : ""}
    </div>
  `;
}

// Réexport pour compatibilité
export { studyDiscriminantField as discriminantField, studyGroupKey, studyGroupColor };

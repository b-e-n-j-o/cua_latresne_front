import type maplibregl from "maplibre-gl";
import {
  CARTO_OUTLINE_OPACITY,
  CARTO_OUTLINE_WIDTH,
} from "./cartoLayerStyle";

export const EMPTY_GROUP_KEY = "(NON RENSEIGNÉ)";

/** Saturation / luminosité pour les aplats carte (souvent fill-opacity ~0.4). */
const CLASS_COLOR_SATURATION = 68;
const CLASS_COLOR_LIGHTNESS = 62;

/** Nuancier rapide dans le sélecteur (teintes réparties sur le cercle chromatique). */
export const DISTINCT_CLASS_PALETTE = Array.from({ length: 24 }, (_, index) => {
  const hue = Math.round((index * 360) / 24);
  return hslClassColor(hue);
});

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function hslClassColor(hue: number): string {
  const normalized = ((hue % 360) + 360) % 360;
  return `hsl(${normalized}, ${CLASS_COLOR_SATURATION}%, ${CLASS_COLOR_LIGHTNESS}%)`;
}

/**
 * Teinte depuis un clic sur la roue chromatique (conic-gradient : 0° en haut).
 * atan2 place 0° à droite → correction +90°.
 */
export function hueFromWheelClick(
  clientX: number,
  clientY: number,
  wheelRect: DOMRect,
  innerHoleRatio = 0.22,
): number | null {
  const cx = wheelRect.left + wheelRect.width / 2;
  const cy = wheelRect.top + wheelRect.height / 2;
  const radius = wheelRect.width / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < radius * innerHoleRatio || dist > radius) return null;

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Math.round((angleDeg + 90 + 360) % 360);
}

/** Couleur stable, claire et bien séparée des autres classes d'une même couche. */
export function colorForClassKey(
  key: string,
  fallback: string,
): string {
  if (!key || key === EMPTY_GROUP_KEY) return fallback;
  return hslClassColor(hashString(key));
}

type ClassColorLayerDef = {
  groupColorMap?: Record<string, string>;
  filterFallback?: string;
  staticGroupLegend?: readonly { key: string; color: string }[];
};

export function resolveClassColor(key: string, def: ClassColorLayerDef): string {
  const fallback = def.filterFallback ?? "#888888";
  if (def.groupColorMap?.[key]) return def.groupColorMap[key];
  const staticItem = def.staticGroupLegend?.find((item) => item.key === key);
  if (staticItem) return staticItem.color;
  return colorForClassKey(key, fallback);
}

export function buildEffectiveClassColorMap(
  def: ClassColorLayerDef,
  keys: readonly string[],
  overrides?: Record<string, string>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key of keys) {
    map[key] = overrides?.[key] ?? resolveClassColor(key, def);
  }
  return map;
}

export function buildGroupFieldColorExpression(
  field: string,
  colorByKey: Record<string, string>,
  fallback: string,
): maplibregl.ExpressionSpecification {
  const code = [
    "upcase",
    ["to-string", ["coalesce", ["get", field], ""]],
  ] as maplibregl.ExpressionSpecification;

  const matchExpr: maplibregl.ExpressionSpecification = ["match", code];
  for (const [key, color] of Object.entries(colorByKey)) {
    (matchExpr as maplibregl.ExpressionSpecification[]).push(
      key === EMPTY_GROUP_KEY ? "" : key,
      color,
    );
  }
  (matchExpr as maplibregl.ExpressionSpecification[]).push(fallback);

  return [
    "case",
    ["==", code, ""],
    colorByKey[EMPTY_GROUP_KEY] ?? fallback,
    matchExpr,
  ] as unknown as maplibregl.ExpressionSpecification;
}

const COLOR_PAINT_KEYS = [
  "fill-color",
  "line-color",
  "circle-color",
  "circle-stroke-color",
] as const;

type SubLayerPaint = {
  id?: string;
  paint?: Record<string, unknown>;
};

/** Applique les couleurs par classe sur les sous-couches MapLibre. */
export function applyLayerClassColors(
  map: maplibregl.Map,
  def: { groupField?: string; filterFallback?: string; layers: readonly SubLayerPaint[] },
  colorByKey: Record<string, string>,
): void {
  if (!def.groupField || Object.keys(colorByKey).length === 0) return;

  const fallback = def.filterFallback ?? "#888888";
  const expr = buildGroupFieldColorExpression(def.groupField, colorByKey, fallback);

  for (const sub of def.layers) {
    if (!sub.id || !sub.paint || !map.getLayer(sub.id)) continue;
    const hasLineColor = "line-color" in sub.paint;
    for (const prop of COLOR_PAINT_KEYS) {
      if (prop in sub.paint) {
        map.setPaintProperty(sub.id, prop, expr);
      }
    }
    if (hasLineColor) {
      if ("line-opacity" in sub.paint) {
        map.setPaintProperty(sub.id, "line-opacity", CARTO_OUTLINE_OPACITY);
      }
      if ("line-width" in sub.paint) {
        const width = sub.paint["line-width"];
        if (typeof width === "number" && width < CARTO_OUTLINE_WIDTH) {
          map.setPaintProperty(sub.id, "line-width", CARTO_OUTLINE_WIDTH);
        }
      }
    }
  }
}

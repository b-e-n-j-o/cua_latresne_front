import type { MutableRefObject } from "react";
import maplibregl from "maplibre-gl";
import { INFO_LINE_COLOR, INFO_POINT_COLOR, INFO_SURF_COLOR, INFO_SURF_OPACITY } from "./colors";

export type ExtraLayerMeta = {
  id: string;
  title: string;
  count: number;
  color: string;
  kind: "surfacique" | "lineaire" | "ponctuelle";
};

export type ExtraFeatureProperties = Record<string, unknown> & {
  layer_id?: string;
  group?: string;
  kind?: string;
  color?: string;
  label?: string;
  couche?: string;
  groupKey?: string;
};

const EXTRA_PREFIX = "extra-";
const FILL_OPACITY = 0.38;

function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

export function sanitizeExtraId(layerId: string): string {
  return layerId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function inferExtraKind(features: GeoJSON.Feature[]): ExtraLayerMeta["kind"] {
  const props = features[0]?.properties as ExtraFeatureProperties | undefined;
  const k = String(props?.kind ?? "").toLowerCase();
  if (k === "lineaire") return "lineaire";
  if (k === "ponctuelle" || k === "ponctuel") return "ponctuelle";
  const t = features[0]?.geometry?.type;
  if (t === "LineString" || t === "MultiLineString") return "lineaire";
  if (t === "Point" || t === "MultiPoint") return "ponctuelle";
  return "surfacique";
}

export function buildExtraLayerMeta(
  extra: Record<string, GeoJSON.FeatureCollection> | undefined,
): ExtraLayerMeta[] {
  if (!extra) return [];
  return Object.entries(extra)
    .map(([id, collection]) => {
      const features = collection?.features ?? [];
      if (features.length === 0) return null;
      const props = features[0]?.properties as ExtraFeatureProperties | undefined;
      return {
        id,
        title: String(props?.couche ?? props?.label ?? id),
        count: features.length,
        color: String(props?.color ?? INFO_SURF_COLOR),
        kind: inferExtraKind(features),
      };
    })
    .filter((x): x is ExtraLayerMeta => x != null)
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
}

export function clearExtraMapLayers(map: maplibregl.Map): void {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of [...style.layers]) {
    if (layer.id.startsWith(EXTRA_PREFIX) && map.getLayer(layer.id)) {
      map.removeLayer(layer.id);
    }
  }
  if (style?.sources) {
    for (const sourceId of Object.keys(style.sources)) {
      if (sourceId.startsWith(EXTRA_PREFIX) && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }
}

function popupHtml(title: string, props: ExtraFeatureProperties): string {
  const skip = new Set([
    "layer_id",
    "group",
    "kind",
    "color",
    "label",
    "groupKey",
    "couche",
  ]);
  const rows = Object.entries(props)
    .filter(([k, v]) => !skip.has(k) && v != null && String(v).trim() !== "")
    .map(
      ([k, v]) =>
        `<div class="plu-map-popup__type">${k} : ${String(v).slice(0, 200)}</div>`,
    )
    .join("");
  return `
    <div class="plu-map-popup">
      <div class="plu-map-popup__title">${title}</div>
      ${rows}
    </div>
  `;
}

export type ExtraLayerHandlers = {
  onClick: (e: maplibregl.MapLayerMouseEvent) => void;
  onEnter: () => void;
  onLeave: () => void;
  clickLayers: string[];
};

export function applyExtraMapLayers(params: {
  map: maplibregl.Map;
  extra: Record<string, GeoJSON.FeatureCollection> | undefined;
  visibleExtra: Set<string>;
  popupRef: MutableRefObject<maplibregl.Popup | null>;
  prev?: ExtraLayerHandlers | null;
}): ExtraLayerHandlers | null {
  const { map, extra, visibleExtra, popupRef, prev } = params;

  if (prev) {
    for (const lid of prev.clickLayers) {
      map.off("click", lid, prev.onClick);
      map.off("mouseenter", lid, prev.onEnter);
      map.off("mouseleave", lid, prev.onLeave);
    }
  }

  clearExtraMapLayers(map);
  if (!extra) return null;

  const clickLayers: string[] = [];

  for (const [layerId, collection] of Object.entries(extra)) {
    if (!visibleExtra.has(layerId)) continue;
    const features = collection?.features ?? [];
    if (features.length === 0) continue;

    const sid = `${EXTRA_PREFIX}${sanitizeExtraId(layerId)}`;
    const kind = inferExtraKind(features);
    const meta = buildExtraLayerMeta({ [layerId]: collection })[0];
    const defaultColor = meta?.color ?? INFO_SURF_COLOR;
    const enriched = features.map((f) => ({
      ...f,
      properties: {
        ...(f.properties as object),
        color: (f.properties as ExtraFeatureProperties)?.color ?? defaultColor,
      },
    }));

    map.addSource(sid, { type: "geojson", data: fc(enriched) });

    if (kind === "surfacique") {
      const fillId = `${sid}-fill`;
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sid,
        paint: {
          "fill-color": ["coalesce", ["get", "color"], defaultColor],
          "fill-opacity": FILL_OPACITY,
        },
      });
      map.addLayer({
        id: `${sid}-outline`,
        type: "line",
        source: sid,
        paint: {
          "line-color": ["coalesce", ["get", "color"], defaultColor],
          "line-width": 2,
        },
      });
      clickLayers.push(fillId);
    } else if (kind === "lineaire") {
      const lineId = `${sid}-line`;
      map.addLayer({
        id: lineId,
        type: "line",
        source: sid,
        paint: {
          "line-color": ["coalesce", ["get", "color"], INFO_LINE_COLOR],
          "line-width": 3,
        },
      });
      clickLayers.push(lineId);
    } else {
      const pointId = `${sid}-point`;
      map.addLayer({
        id: pointId,
        type: "circle",
        source: sid,
        paint: {
          "circle-color": ["coalesce", ["get", "color"], INFO_POINT_COLOR],
          "circle-radius": 7,
          "circle-stroke-color": "#1a1a1a",
          "circle-stroke-width": 1,
        },
      });
      clickLayers.push(pointId);
    }
  }

  if (clickLayers.length === 0) return null;

  const onClick = (e: maplibregl.MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f?.properties) return;
    const p = f.properties as ExtraFeatureProperties;
    const title = String(p.couche ?? p.label ?? p.layer_id ?? "Couche");
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
      .setLngLat(e.lngLat)
      .setHTML(popupHtml(title, p))
      .addTo(map);
  };
  const onEnter = () => {
    map.getCanvas().style.cursor = "pointer";
  };
  const onLeave = () => {
    map.getCanvas().style.cursor = "";
  };

  for (const lid of clickLayers) {
    map.on("click", lid, onClick);
    map.on("mouseenter", lid, onEnter);
    map.on("mouseleave", lid, onLeave);
  }

  return { onClick, onEnter, onLeave, clickLayers };
}

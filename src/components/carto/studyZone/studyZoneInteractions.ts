import type { MutableRefObject } from "react";
import maplibregl from "maplibre-gl";
import { formatStudyZoneTooltipHtml } from "./studyZoneLegend";
import type { StudyZoneCartoContext } from "./types";

const PREFIX = "study-zone";

function interactiveLayerIds(map: maplibregl.Map): string[] {
  const style = map.getStyle();
  if (!style?.layers) return [];
  return style.layers
    .map((l) => l.id)
    .filter(
      (id) =>
        id.startsWith(`${PREFIX}-fill-`) ||
        id.startsWith(`${PREFIX}-lin-`) ||
        id.startsWith(`${PREFIX}-pct-`)
    );
}

export function attachStudyZoneInteractions(
  map: maplibregl.Map,
  context: StudyZoneCartoContext,
  popupRef: MutableRefObject<maplibregl.Popup | null>
): () => void {
  const layerIds = interactiveLayerIds(map);
  if (!layerIds.length) return () => undefined;

  const hoverPopup =
    popupRef.current ??
    new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "280px",
      offset: 12,
      className: "study-zone-popup",
    });
  popupRef.current = hoverPopup;

  const onEnter = () => {
    map.getCanvas().style.cursor = "pointer";
  };

  const onMove = (e: maplibregl.MapLayerMouseEvent) => {
    const f = e.features?.[0];
    const props = f?.properties as Record<string, unknown> | undefined;
    const layerId = props?._layerId as string | undefined;
    const meta = layerId ? context.layers[layerId] : undefined;
    if (!meta || !props) {
      hoverPopup.remove();
      return;
    }
    hoverPopup
      .setLngLat(e.lngLat)
      .setHTML(formatStudyZoneTooltipHtml(meta, props))
      .addTo(map);
  };

  const onLeave = () => {
    map.getCanvas().style.cursor = "";
    hoverPopup.remove();
  };

  for (const id of layerIds) {
    map.on("mouseenter", id, onEnter);
    map.on("mousemove", id, onMove);
    map.on("mouseleave", id, onLeave);
  }

  return () => {
    for (const id of layerIds) {
      map.off("mouseenter", id, onEnter);
      map.off("mousemove", id, onMove);
      map.off("mouseleave", id, onLeave);
    }
    hoverPopup.remove();
  };
}

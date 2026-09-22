import type maplibregl from "maplibre-gl";

/** Cible de hit-test large (au-dessus du halo visible). */
export const CUA_HISTORY_HIT_LAYER_ID = "pipelines-history-hit";

export const CUA_HISTORY_PICK_LAYER_IDS = [
  CUA_HISTORY_HIT_LAYER_ID,
  "pipelines-history-point",
  "pipelines-history-halo",
] as const;

/** Zone de clic / survol élargie, indépendante du halo visuel. */
/** Rayon queryRenderedFeatures quand le curseur entre sur un ping. */
export const CUA_PING_PICK_RADIUS_ENTER = 14;
/** Rayon élargi tant qu’un ping est déjà actif (tooltip affiché). */
export const CUA_PING_PICK_RADIUS_STICKY = 36;

/** Contours / labels cadastre PMTiles (Latresne…) — à garder sous les pings. */
export const PMTILES_CADASTRE_LAYER_IDS = [
  "parcelles-outline",
  "parcelles-labels",
] as const;

export function addCuaHistoryHitLayer(map: maplibregl.Map): void {
  if (map.getLayer(CUA_HISTORY_HIT_LAYER_ID)) return;
  map.addLayer({
    id: CUA_HISTORY_HIT_LAYER_ID,
    type: "circle",
    source: "pipelines-history",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        16,
        14,
        20,
        18,
        26,
        22,
        32,
      ],
      "circle-color": "#22c55e",
      "circle-opacity": 0.001,
    },
  });
}

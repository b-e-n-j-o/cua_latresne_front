import maplibregl from "maplibre-gl";

export default function registerParcellesLayer(map: maplibregl.Map, apiBase: string) {
  const MBTILES_BASE = `${apiBase}/latresne/mbtiles`;
  const LAYER_ID = "latresne_parcelles-fill";
  const SOURCE_LAYER = "parcelles";

  if (!map.getSource("latresne_parcelles")) {
    map.addSource("latresne_parcelles", {
      type: "vector",
      tiles: [`${MBTILES_BASE}/latresne_parcelles/{z}/{x}/{y}.mvt`],
      minzoom: 14,
      maxzoom: 19,
      promoteId: "id"
    });
  }

  // Couche de remplissage (pour le clic et l'interaction)
  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "fill",
      source: "latresne_parcelles",
      "source-layer": SOURCE_LAYER,
      minzoom: 14,
      paint: {
        "fill-color": "transparent",
        "fill-outline-color": "transparent" // Pas de contour sur le fill, on utilise la couche line séparée
      }
    });
  }

  // Couche de contours pour rendre les parcelles visibles
  if (!map.getLayer("latresne_parcelles-outline")) {
    map.addLayer({
      id: "latresne_parcelles-outline",
      type: "line",
      source: "latresne_parcelles",
      "source-layer": SOURCE_LAYER,
      minzoom: 14,
      paint: {
        "line-color": "#666666",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0.8,
          16, 1.2,
          18, 1.8
        ],
        "line-opacity": 0.8
      }
    });
  }
}
import maplibregl from "maplibre-gl";

export default function registerParcellesLayer(map: maplibregl.Map, apiBase: string) {
  const LAYER_ID = "latresne_parcelles-fill";
  const SOURCE_LAYER = "parcelles";

  if (!map.getSource("latresne_parcelles")) {
    map.addSource("latresne_parcelles", {
      type: "vector",
      tiles: [`${apiBase.replace(/\/$/, "")}/latresne/mbtiles/latresne_parcelles/{z}/{x}/{y}.mvt`],
      minzoom: 13,
      maxzoom: 22
    });
  }

  // Couche de remplissage (pour le clic et l'interaction)
  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "fill",
      source: "latresne_parcelles",
      "source-layer": SOURCE_LAYER,
      minzoom: 13,
      paint: {
        "fill-color": "rgba(0, 0, 0, 0.01)", // Légèrement opaque pour la détection hover/click (transparent = pas d'événements)
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
      minzoom: 13,
      paint: {
        "line-color": "#666666",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13, 0.8,
          16, 1.2,
          18, 1.8
        ],
        "line-opacity": 0.8
      }
    });
  }
}
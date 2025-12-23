import maplibregl from "maplibre-gl";

export default function registerAC4Layer(map: maplibregl.Map, apiBase: string) {
  if (!map.getSource("ac4")) {
    map.addSource("ac4", {
      type: "vector",
      tiles: [`${apiBase}/tiles/ac4/{z}/{x}/{y}.mvt`],
      maxzoom: 18,
      volatile: false
    });
  }

  if (!map.getLayer("ac4-fill")) {
    map.addLayer({
      id: "ac4-fill",
      type: "fill",
      source: "ac4",
      "source-layer": "ac4",
      minzoom: 14,
      paint: {
        "fill-color": "#FFD700",
        "fill-opacity": 0.25
      }
    });
  }

  // Bordures plus opaques pour bien délimiter les surfaces AC4
  if (!map.getLayer("ac4-outline")) {
    map.addLayer({
      id: "ac4-outline",
      type: "line",
      source: "ac4",
      "source-layer": "ac4",
      minzoom: 14,
      paint: {
        "line-color": "#D69E2E",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0.6,
          18, 1.3
        ],
        "line-opacity": 0.9
      }
    });
  }
}

import maplibregl from "maplibre-gl";

export default function registerAC2Layer(map: maplibregl.Map, apiBase: string) {
  if (!map.getSource("ac2")) {
    map.addSource("ac2", {
      type: "vector",
      tiles: [`${apiBase}/tiles/ac2/{z}/{x}/{y}.mvt`],
      maxzoom: 18,
      volatile: false
    });
  }

  if (!map.getLayer("ac2-fill")) {
    map.addLayer({
      id: "ac2-fill",
      type: "fill",
      source: "ac2",
      "source-layer": "ac2",
      minzoom: 15,
      paint: {
        "fill-color": "#FFA500",
        "fill-opacity": 0.25
      }
    });
  }

  // Bordures plus opaques pour bien délimiter les surfaces AC2
  if (!map.getLayer("ac2-outline")) {
    map.addLayer({
      id: "ac2-outline",
      type: "line",
      source: "ac2",
      "source-layer": "ac2",
      minzoom: 15,
      paint: {
        "line-color": "#CC8400",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15, 0.6,
          18, 1.3
        ],
        "line-opacity": 0.9
      }
    });
  }
}

import maplibregl from "maplibre-gl";

export default function registerAC1Layer(map: maplibregl.Map, apiBase: string) {
  if (!map.getSource("ac1")) {
    map.addSource("ac1", {
      type: "vector",
      tiles: [`${apiBase}/tiles/ac1/{z}/{x}/{y}.mvt`],
      maxzoom: 18,
      volatile: false
    });
  }

  if (!map.getLayer("ac1-fill")) {
    map.addLayer({
      id: "ac1-fill",
      type: "fill",
      source: "ac1",
      "source-layer": "ac1",
      minzoom: 12,
      paint: {
        "fill-color": "#F6AD55",
        "fill-opacity": 0.35
      }
    });
  }

  // Bordures plus opaques pour bien délimiter les surfaces AC1
  if (!map.getLayer("ac1-outline")) {
    map.addLayer({
      id: "ac1-outline",
      type: "line",
      source: "ac1",
      "source-layer": "ac1",
      minzoom: 12,
      paint: {
        "line-color": "#DD6B20",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12, 0.6,
          16, 1.2
        ],
        "line-opacity": 0.9
      }
    });
  }
}

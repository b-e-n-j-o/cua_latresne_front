import maplibregl from "maplibre-gl";

export default function registerI1Layer(map: maplibregl.Map, apiBase: string) {
  if (!map.getSource("i1")) {
    map.addSource("i1", {
      type: "vector",
      tiles: [`${apiBase}/tiles/i1/{z}/{x}/{y}.mvt`],
      maxzoom: 18,
      volatile: false
    });
  }

  // Remplissage doux des emprises I1
  if (!map.getLayer("i1-fill")) {
    map.addLayer({
      id: "i1-fill",
      type: "fill",
      source: "i1",
      "source-layer": "i1",
      minzoom: 14,
      paint: {
        "fill-color": "#2C5282",
        "fill-opacity": 0.25
      }
    });
  }

  // Bordures plus marquées pour bien délimiter les surfaces
  if (!map.getLayer("i1-lines")) {
    map.addLayer({
      id: "i1-lines",
      type: "line",
      source: "i1",
      "source-layer": "i1",
      minzoom: 14,
      paint: {
        "line-color": "#2C5282",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0.6,
          18, 2.0
        ],
        "line-opacity": 0.9
      }
    });
  }
}

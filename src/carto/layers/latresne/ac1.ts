// carto/layers/latresne/ac1.ts
export default function registerAC1Layer(map: maplibregl.Map, apiBase: string) {
    map.addSource("ac1", {
      type: "vector",
      tiles: [`${apiBase}/latresne/tiles/ac1/{z}/{x}/{y}.mvt`],
      maxzoom: 22
    });
  
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
  
    map.addLayer({
      id: "ac1-outline",
      type: "line",
      source: "ac1",
      "source-layer": "ac1",
      minzoom: 12,
      paint: {
        "line-color": "#DD6B20",
        "line-width": 1.2
      }
    });
  }
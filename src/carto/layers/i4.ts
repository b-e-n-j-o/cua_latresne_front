import maplibregl from "maplibre-gl";

export function registerI4Layer(map: maplibregl.Map, apiBase: string) {
    if (!map.getSource("i4")) {
      map.addSource("i4", {
        type: "vector",
        tiles: [`${apiBase}/tiles/i4/{z}/{x}/{y}.mvt`],
        maxzoom: 18,
        volatile: false
      });
    }
  
    if (!map.getLayer("i4-fill")) {
      map.addLayer({
        id: "i4-fill",
        type: "fill",
        source: "i4",
        "source-layer": "i4",
        minzoom: 14,
        paint: {
          "fill-color": "#9F7AEA",
          "fill-opacity": 0.45,
        },
      });
    }
  }
  


export default registerI4Layer;
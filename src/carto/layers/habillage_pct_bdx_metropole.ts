import maplibregl from "maplibre-gl";

export default function registerPLUIHabillagePctLayer(
  map: maplibregl.Map,
  apiBase: string
) {
  // ============================================================
  // 🔌 Source vectorielle – habillage ponctuel
  // ============================================================
  if (!map.getSource("plui-habillage-pct")) {
    map.addSource("plui-habillage-pct", {
      type: "vector",
      tiles: [`${apiBase}/tiles/plui-habillage-pct/{z}/{x}/{y}.mvt`],
      maxzoom: 20
    });
  }

  // ============================================================
  // 🗺️ Points (zoom 18 → 20)
  // ============================================================
  if (!map.getLayer("plui-habillage-pct")) {
    map.addLayer({
      id: "plui-habillage-pct",
      type: "circle",
      source: "plui-habillage-pct",
      "source-layer": "plui-habillage-pct",
      minzoom: 18,
      maxzoom: 20,
      paint: {
        "circle-color": "#888888",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          18, 3,
          19, 4,
          20, 5
        ],
        "circle-opacity": 0.6,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#666666",
        "circle-stroke-opacity": 0.8
      }
    });
  }
}




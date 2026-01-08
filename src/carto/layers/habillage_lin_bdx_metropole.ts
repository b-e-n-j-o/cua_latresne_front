import maplibregl from "maplibre-gl";

export default function registerPLUIHabillageLinLayer(
  map: maplibregl.Map,
  apiBase: string
) {
  // ============================================================
  // 🔌 Source vectorielle – habillage linéaire
  // ============================================================
  if (!map.getSource("plui-habillage-lin")) {
    map.addSource("plui-habillage-lin", {
      type: "vector",
      tiles: [`${apiBase}/tiles/plui-habillage-lin/{z}/{x}/{y}.mvt`],
      maxzoom: 20
    });
  }

  // ============================================================
  // 🗺️ Lignes (zoom 18 → 20)
  // ============================================================
  if (!map.getLayer("plui-habillage-lin")) {
    map.addLayer({
      id: "plui-habillage-lin",
      type: "line",
      source: "plui-habillage-lin",
      "source-layer": "plui-habillage-lin",
      minzoom: 18,
      maxzoom: 20,
      paint: {
        "line-color": "#888888",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          18, 1.5,
          19, 2,
          20, 2.5
        ],
        "line-opacity": 0.6,
        "line-dasharray": [2, 2]
      }
    });
  }
}


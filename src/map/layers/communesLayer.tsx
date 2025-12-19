import maplibregl from "maplibre-gl";

export async function addCommunesLayer(map: maplibregl.Map) {
  const res = await fetch("http://localhost:8000/communes");
  const geojson = await res.json();

  map.addSource("communes", {
    type: "geojson",
    data: geojson,
  });

  map.addLayer({
    id: "communes-outline",
    type: "line",
    source: "communes",
    minzoom: 8,   // ← visible tôt
    maxzoom: 17,  // ← disparaît quand le PLUi arrive
    paint: {
      "line-color": "#111",
      "line-width": 1.2,
      "line-opacity": 0.6,
    },
  });
}

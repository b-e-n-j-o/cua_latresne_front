// src/map/layers/skeletonLayer.ts
import maplibregl from "maplibre-gl";

export async function addSkeletonLayer(map: maplibregl.Map) {
  // 1. Chargement des données en parallèle
  const [resDeps, resComs] = await Promise.all([
    fetch("http://localhost:8000/departements"),
    fetch("http://localhost:8000/communes")
  ]);
  
  const depsGeojson = await resDeps.json();
  const comsGeojson = await resComs.json();

  // 2. Ajout des Sources
  map.addSource("departements", { type: "geojson", data: depsGeojson });
  map.addSource("communes", { type: "geojson", data: comsGeojson });

  // 3. Layer DEPARTEMENTS (Visible de zoom 0 à 9)
  map.addLayer({
    id: "departements-outline",
    type: "line",
    source: "departements",
    maxzoom: 9, // Disparaît quand les communes prennent le relais
    paint: {
      "line-color": "#4A5568",
      "line-width": 1.5,
      "line-opacity": 0.8,
    },
  });

  map.addLayer({
    id: "departements-fill",
    type: "fill",
    source: "departements",
    maxzoom: 9,
    paint: {
      "fill-color": "#CBD5E0",
      "fill-opacity": 0.2,
    },
  });

  // 4. Layer COMMUNES (Prend le relais à partir du zoom 8)
  // On fait un léger chevauchement (8-9) pour une transition douce
  map.addLayer({
    id: "communes-outline",
    type: "line",
    source: "communes",
    minzoom: 8, 
    maxzoom: 14,
    paint: {
      "line-color": "#2D3748",
      "line-width": 0.8,
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 9, 0.6],
    },
  });
}
import maplibregl from "maplibre-gl";

export default function registerPLUILayer(
  map: maplibregl.Map,
  apiBase: string
) {
  if (map.getSource("plui")) return;

  // ============================================================
  // Palette de couleurs
  // ============================================================
  const PALETTE = [
    "#4C51BF", "#6B46C1", "#805AD5", "#9F7AEA", "#B794F4",
    "#2B6CB0", "#3182CE", "#4299E1", "#63B3ED", "#90CDF4",
    "#2F855A", "#38A169", "#48BB78", "#68D391", "#9AE6B4",
    "#975A16", "#B7791F", "#D69E2E", "#ECC94B", "#FAF089",
    "#822727", "#9B2C2C", "#C53030", "#E53E3E", "#FC8181",
    "#285E61", "#319795", "#4FD1C5", "#81E6D9", "#B2F5EA"
  ];

  const colorMap = new Map<string, string>();

  function getColor(etiquette: string) {
    if (!colorMap.has(etiquette)) {
      colorMap.set(etiquette, PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    }
    return colorMap.get(etiquette)!;
  }

  function buildMatchExpression() {
    const expr: any[] = ["match", ["get", "etiquette"]];
    for (const [etiq, color] of colorMap.entries()) {
      expr.push(etiq, color);
    }
    expr.push("#cccccc"); // fallback
    return expr;
  }

  // ============================================================
  // Source vectorielle
  // ============================================================
  map.addSource("plui", {
    type: "vector",
    tiles: [`${apiBase}/tiles/plui_bordeaux/{z}/{x}/{y}.mvt`],
    minzoom: 15,
    maxzoom: 18
  });

  // ============================================================
  // Layers
  // ============================================================
  
  // Remplissage
  map.addLayer({
    id: "plui-fill",
    type: "fill",
    source: "plui",
    "source-layer": "plui-bordeaux", // ✅ Confirmé par l'audit
    minzoom: 15,
    paint: {
      "fill-color": "#cccccc",
      "fill-opacity": 0.3
    },
    layout: {
      visibility: "none"
    }
  });

  // Contours
  map.addLayer({
    id: "plui-outline",
    type: "line",
    source: "plui",
    "source-layer": "plui-bordeaux",
    minzoom: 15,
    paint: {
      "line-color": "#2D3748",
      "line-width": [
        "interpolate", ["linear"], ["zoom"],
        15, 0.5,
        17, 1.2,
        18, 1.8
      ],
      "line-opacity": 0.8
    },
    layout: {
      visibility: "none"
    }
  });

  // Labels (étiquettes)
  map.addLayer({
    id: "plui-labels",
    type: "symbol",
    source: "plui",
    "source-layer": "plui-bordeaux",
    minzoom: 16,
    layout: {
      "text-field": ["get", "etiquette"], // ✅ Attribut confirmé
      "text-size": ["interpolate", ["linear"], ["zoom"], 16, 11, 18, 16],
      "text-anchor": "center",
      "text-allow-overlap": false,
      visibility: "none"
    },
    paint: {
      "text-color": "#1a1a1a",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
      "text-halo-blur": 1
    }
  });

  // ============================================================
  // Mise à jour dynamique des couleurs
  // ============================================================
  function updateColors() {
    try {
      const features = map.querySourceFeatures("plui", {
        sourceLayer: "plui-bordeaux"
      });

      let hasNew = false;
      for (const f of features) {
        const etiquette = f.properties?.etiquette;
        if (etiquette && !colorMap.has(etiquette)) {
          getColor(etiquette);
          hasNew = true;
        }
      }

      if (hasNew) {
        map.setPaintProperty("plui-fill", "fill-color", buildMatchExpression());
      }
    } catch (err) {
      console.error("Erreur updateColors PLUI:", err);
    }
  }

  // Première passe
  map.once("idle", updateColors);

  // Mise à jour au chargement des tuiles
  map.on("sourcedata", (e) => {
    if (e.sourceId === "plui" && e.isSourceLoaded) {
      updateColors();
    }
  });
}
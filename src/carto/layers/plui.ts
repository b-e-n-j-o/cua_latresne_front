import maplibregl from "maplibre-gl";

export default function registerPLUILayer(
  map: maplibregl.Map,
  apiBase: string
) {
  // ============================================================
  // 🎨 Palette fixe de 30 couleurs (urbanisme-safe)
  // ============================================================
  const PALETTE = [
    "#4C51BF", "#6B46C1", "#805AD5", "#9F7AEA", "#B794F4",
    "#2B6CB0", "#3182CE", "#4299E1", "#63B3ED", "#90CDF4",
    "#2F855A", "#38A169", "#48BB78", "#68D391", "#9AE6B4",
    "#975A16", "#B7791F", "#D69E2E", "#ECC94B", "#FAF089",
    "#822727", "#9B2C2C", "#C53030", "#E53E3E", "#FC8181",
    "#285E61", "#319795", "#4FD1C5", "#81E6D9", "#B2F5EA"
  ];

  // ============================================================
  // 🗂️ Dictionnaire libellé → couleur (persistant pendant la session)
  // ============================================================
  const libelleColorMap = new Map<string, string>();

  function getColorForLibelle(libelle: string) {
    if (!libelleColorMap.has(libelle)) {
      const color =
        PALETTE[Math.floor(Math.random() * PALETTE.length)];
      libelleColorMap.set(libelle, color);
    }
    return libelleColorMap.get(libelle)!;
  }

  function buildMatchExpression() {
    const expr: any[] = ["match", ["get", "libelle"]];
    for (const [libelle, color] of libelleColorMap.entries()) {
      expr.push(libelle, color);
    }
    expr.push("#cccccc"); // fallback
    return expr;
  }

  // ============================================================
  // 🔌 Source vectorielle PLUI
  // ============================================================
  if (!map.getSource("plui")) {
    map.addSource("plui", {
      type: "vector",
      tiles: [`${apiBase}/tiles/plui/{z}/{x}/{y}.mvt`],
      maxzoom: 18,
      volatile: false
    });
  }

  // ============================================================
  // 🗺️ Remplissage des zonages PLUI
  // ============================================================
  if (!map.getLayer("plui-fill")) {
    map.addLayer({
      id: "plui-fill",
      type: "fill",
      source: "plui",
      "source-layer": "plui",
      minzoom: 11,
      paint: {
        "fill-color": "#cccccc",
        "fill-opacity": 0.25
      }
    });
  }

  // ============================================================
  // 🧭 Contours des zonages PLUI (limites entre zones)
  // ============================================================
  if (!map.getLayer("plui-outline")) {
    map.addLayer(
      {
        id: "plui-outline",
        type: "line",
        source: "plui",
        "source-layer": "plui",
        minzoom: 11,
        paint: {
          "line-color": "#2D3748", // gris foncé, lisible sur IGN
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11, 0.4,
            14, 0.8,
            17, 1.5
          ],
          "line-opacity": 0.8
        }
      },
      "plui-labels" // sous les labels, au-dessus du fill
    );
  }

  // ============================================================
  // 🏷️ Labels de zonage
  // ============================================================
  if (!map.getLayer("plui-labels")) {
    map.addLayer({
      id: "plui-labels",
      type: "symbol",
      source: "plui",
      "source-layer": "plui",
      minzoom: 15,
      layout: {
        "text-field": ["get", "libelle"],
        "text-font": ["Noto Sans Regular", "Noto Sans Italic"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15, 12,
          18, 18
        ],
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false
      },
      paint: {
        "text-color": "#1a1a1a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
        "text-halo-blur": 1
      }
    });
  }

  // ============================================================
  // 🔄 Mise à jour dynamique des couleurs au fil du chargement
  // ============================================================
  function updatePluiColors() {
    const features = map.querySourceFeatures("plui", {
      sourceLayer: "plui"
    });

    let hasNew = false;

    for (const f of features) {
      const libelle = f.properties?.libelle;
      if (!libelle) continue;

      if (!libelleColorMap.has(libelle)) {
        getColorForLibelle(libelle);
        hasNew = true;
      }
    }

    if (hasNew) {
      map.setPaintProperty(
        "plui-fill",
        "fill-color",
        buildMatchExpression()
      );
    }
  }

  // première passe
  map.once("idle", updatePluiColors);

  // puis à chaque nouvelle tuile chargée
  map.on("sourcedata", (e) => {
    if (e.sourceId === "plui" && e.isSourceLoaded) {
      updatePluiColors();
    }
  });
}

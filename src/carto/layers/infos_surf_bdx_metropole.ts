import maplibregl from "maplibre-gl";

export default function registerPLUIInfoSurfLayer(
  map: maplibregl.Map,
  apiBase: string
) {
  // ============================================================
  // 🎨 Palette fixe (urbanisme-safe)
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
  // 🗂️ Dictionnaire LIBELLE → couleur (session)
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
    const expr: any[] = ["match", ["get", "LIBELLE"]];
    for (const [lib, color] of libelleColorMap.entries()) {
      expr.push(lib, color);
    }
    expr.push("#cccccc"); // fallback
    return expr;
  }

  // ============================================================
  // 🔌 Source vectorielle – informations surfaciques
  // ============================================================
  if (!map.getSource("plui-info-surf")) {
    map.addSource("plui-info-surf", {
      type: "vector",
      tiles: [
        `${apiBase}/tiles/plui-info-surf/{z}/{x}/{y}.mvt`
      ],
      maxzoom: 20
    });
  }

  // ============================================================
  // 🗺️ Fill (zoom 17 → 20) — couleur par LIBELLE
  // ============================================================
  if (!map.getLayer("plui-info-surf-fill")) {
    map.addLayer({
      id: "plui-info-surf-fill",
      type: "fill",
      source: "plui-info-surf",
      "source-layer": "plui-info-surf",
      minzoom: 17,
      maxzoom: 20,
      paint: {
        "fill-color": "#cccccc",
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          17, 0.12,
          18, 0.18,
          19, 0.24,
          20, 0.30
        ]
      }
    });
  }

  // ============================================================
  // 🧭 Contours (zoom 17 → 20) — discrets mais lisibles
  // ============================================================
  if (!map.getLayer("plui-info-surf-outline")) {
    map.addLayer({
      id: "plui-info-surf-outline",
      type: "line",
      source: "plui-info-surf",
      "source-layer": "plui-info-surf",
      minzoom: 17,
      maxzoom: 20,
      paint: {
        "line-color": "#1a202c",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          17, 1.5,
          18, 2,
          19, 2.5,
          20, 3
        ],
        "line-opacity": 0.7
      }
    });
  }

  // ============================================================
  // 🏷️ Labels LIBELLE (zoom 17 → 20) — toujours visibles
  // ============================================================
  if (!map.getLayer("plui-info-surf-labels")) {
    map.addLayer({
      id: "plui-info-surf-labels",
      type: "symbol",
      source: "plui-info-surf",
      "source-layer": "plui-info-surf",
      minzoom: 17,
      maxzoom: 20,
      layout: {
        "text-field": [
          "case",
          [">=", ["length", ["get", "LIBELLE"]], 30],
          ["concat", ["slice", ["get", "LIBELLE"], 0, 27], "..."],
          ["get", "LIBELLE"]
        ],
        "text-font": ["Noto Sans Regular", "Noto Sans Italic"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          17, 9,
          18, 10,
          19, 11,
          20, 13
        ],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "symbol-placement": "point",
        "text-max-width": 15,
        "text-padding": 10
      },
      paint: {
        "text-color": "#1a1a1a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.2,
        "text-halo-blur": 0.8
      }
    });
  }

  // ============================================================
  // 🔄 Mise à jour dynamique des couleurs au fil du chargement
  // ============================================================
  function updateColors() {
    const features = map.querySourceFeatures("plui-info-surf", {
      sourceLayer: "plui-info-surf"
    });

    let hasNew = false;
    for (const f of features) {
      const libelle = (f.properties as any)?.LIBELLE;
      if (!libelle) continue;

      if (!libelleColorMap.has(libelle)) {
        getColorForLibelle(libelle);
        hasNew = true;
      }
    }

    if (hasNew) {
      map.setPaintProperty(
        "plui-info-surf-fill",
        "fill-color",
        buildMatchExpression()
      );
    }
  }

  // Mise à jour initiale dès que la carte est prête
  map.once("idle", updateColors);

  // Mise à jour à chaque chargement de nouvelles tuiles
  map.on("sourcedata", (e) => {
    if (e.sourceId === "plui-info-surf" && e.isSourceLoaded) {
      updateColors();
    }
  });
}

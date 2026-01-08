import maplibregl from "maplibre-gl";

export default function registerPLUIPrescriptionsSurfLayer(
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
  // 🗂️ Dictionnaire LIBELLE → couleur (persistant pendant la session)
  // ============================================================
  const libelleColorMap = new Map<string, string>();

  function getColorForLibelle(libelle: string) {
    if (!libelleColorMap.has(libelle)) {
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
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
  // 🔌 Source vectorielle – prescriptions surfaciques
  // ============================================================
  if (!map.getSource("plui-presc-surf")) {
    map.addSource("plui-presc-surf", {
      type: "vector",
      tiles: [`${apiBase}/tiles/plui-prescriptions-surf/{z}/{x}/{y}.mvt`],
      maxzoom: 20
    });
  }

  // ============================================================
  // 🗺️ Fill (zoom 18 → 20) — couleur par LIBELLE
  // ============================================================
  if (!map.getLayer("plui-presc-surf-fill")) {
    map.addLayer({
      id: "plui-presc-surf-fill",
      type: "fill",
      source: "plui-presc-surf",
      "source-layer": "plui-prescriptions-surf",
      minzoom: 18,
      maxzoom: 20,
      paint: {
        "fill-color": "#cccccc",
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          18, 0.12,
          19, 0.18,
          20, 0.26
        ]
      }
    });
  }

  // ============================================================
  // 🧭 Contours (zoom 18 → 20) — discrets mais lisibles
  // ============================================================
  if (!map.getLayer("plui-presc-surf-outline")) {
    map.addLayer({
      id: "plui-presc-surf-outline",
      type: "line",
      source: "plui-presc-surf",
      "source-layer": "plui-prescriptions-surf",
      minzoom: 18,
      maxzoom: 20,
      paint: {
        "line-color": "#1a202c",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          18, 1.5,
          19, 2,
          20, 3
        ],
        "line-opacity": 0.5
      }
    });
  }

  // ============================================================
  // 🏷️ Labels LIBELLE (zoom 18 → 20)
  // ============================================================
  if (!map.getLayer("plui-presc-surf-labels")) {
    map.addLayer({
      id: "plui-presc-surf-labels",
      type: "symbol",
      source: "plui-presc-surf",
      "source-layer": "plui-prescriptions-surf",
      minzoom: 18,
      maxzoom: 20,
      layout: {
        "text-field": ["coalesce", ["get", "LIBELLE"], ""],
        "text-font": ["Noto Sans Regular", "Noto Sans Italic"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          18, 10,
          20, 14
        ],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "symbol-placement": "point",
        "text-max-width": 12
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
    const features = map.querySourceFeatures("plui-presc-surf", {
      sourceLayer: "plui-prescriptions-surf"
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
        "plui-presc-surf-fill",
        "fill-color",
        buildMatchExpression()
      );
    }
  }

  map.once("idle", updateColors);

  map.on("sourcedata", (e) => {
    if (e.sourceId === "plui-presc-surf" && e.isSourceLoaded) {
      updateColors();
    }
  });
}

import maplibregl from "maplibre-gl";

export default function registerPLUIPrescriptionsLinLayer(
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
  // 🔌 Source vectorielle – prescriptions linéaires
  // ============================================================
  if (!map.getSource("plui-presc-lin")) {
    map.addSource("plui-presc-lin", {
      type: "vector",
      tiles: [`${apiBase}/tiles/plui-prescriptions-lin/{z}/{x}/{y}.mvt`],
      maxzoom: 20
    });
  }

  // ============================================================
  // 🗺️ Lignes (zoom 18 → 20) — couleur par LIBELLE
  // ============================================================
  if (!map.getLayer("plui-presc-lin")) {
    map.addLayer({
      id: "plui-presc-lin",
      type: "line",
      source: "plui-presc-lin",
      "source-layer": "plui-prescriptions-lin",
      minzoom: 18,
      maxzoom: 20,
      paint: {
        "line-color": "#cccccc",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          18, 2,
          19, 3,
          20, 4
        ],
        "line-opacity": 0.8
      }
    });
  }

  // ============================================================
  // 🔄 Mise à jour dynamique des couleurs au fil du chargement
  // ============================================================
  function updateColors() {
    const features = map.querySourceFeatures("plui-presc-lin", {
      sourceLayer: "plui-prescriptions-lin"
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
        "plui-presc-lin",
        "line-color",
        buildMatchExpression()
      );
    }
  }

  map.once("idle", updateColors);

  map.on("sourcedata", (e) => {
    if (e.sourceId === "plui-presc-lin" && e.isSourceLoaded) {
      updateColors();
    }
  });
}




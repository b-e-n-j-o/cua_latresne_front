import maplibregl from "maplibre-gl";

export default function registerPLUIPrescriptionsPctLayer(
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
  // 🔌 Source vectorielle – prescriptions ponctuelles
  // ============================================================
  if (!map.getSource("plui-presc-pct")) {
    map.addSource("plui-presc-pct", {
      type: "vector",
      tiles: [`${apiBase}/tiles/plui-prescriptions-pct/{z}/{x}/{y}.mvt`],
      maxzoom: 20
    });
  }

  // ============================================================
  // 🗺️ Points (zoom 18 → 20) — couleur par LIBELLE
  // ============================================================
  if (!map.getLayer("plui-presc-pct")) {
    map.addLayer({
      id: "plui-presc-pct",
      type: "circle",
      source: "plui-presc-pct",
      "source-layer": "plui-prescriptions-pct",
      minzoom: 18,
      maxzoom: 20,
      paint: {
        "circle-color": "#cccccc",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          18, 4,
          19, 5,
          20, 6
        ],
        "circle-opacity": 0.8,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#1a202c",
        "circle-stroke-opacity": 0.9
      }
    });
  }

  // ============================================================
  // 🔄 Mise à jour dynamique des couleurs au fil du chargement
  // ============================================================
  function updateColors() {
    const features = map.querySourceFeatures("plui-presc-pct", {
      sourceLayer: "plui-prescriptions-pct"
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
        "plui-presc-pct",
        "circle-color",
        buildMatchExpression()
      );
    }
  }

  map.once("idle", updateColors);

  map.on("sourcedata", (e) => {
    if (e.sourceId === "plui-presc-pct" && e.isSourceLoaded) {
      updateColors();
    }
  });
}




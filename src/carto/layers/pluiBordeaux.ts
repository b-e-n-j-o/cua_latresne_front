import maplibregl from "maplibre-gl";

export default function registerPluiBordeauxLayer(
  map: maplibregl.Map,
  apiBase: string
) {
  const PALETTE = [
    "#4C51BF", "#6B46C1", "#805AD5", "#9F7AEA", "#B794F4",
    "#2B6CB0", "#3182CE", "#4299E1", "#63B3ED", "#90CDF4",
    "#2F855A", "#38A169", "#48BB78", "#68D391", "#9AE6B4",
    "#975A16", "#B7791F", "#D69E2E", "#ECC94B", "#FAF089"
  ];

  const etiquetteColorMap = new Map<string, string>();

  function getColorForEtiquette(etiquette: string) {
    if (!etiquetteColorMap.has(etiquette)) {
      etiquetteColorMap.set(
        etiquette,
        PALETTE[Math.floor(Math.random() * PALETTE.length)]
      );
    }
    return etiquetteColorMap.get(etiquette)!;
  }

  function buildMatchExpression() {
    const expr: any[] = ["match", ["get", "etiquette"]];
    for (const [etiquette, color] of etiquetteColorMap) {
      expr.push(etiquette, color);
    }
    expr.push("#cccccc");
    return expr;
  }

  if (!map.getSource("plui-bordeaux")) {
    map.addSource("plui-bordeaux", {
      type: "vector",
      tiles: [`${apiBase}/tiles/plui-bordeaux/{z}/{x}/{y}.mvt`],
      minzoom: 15,
      maxzoom: 18
    });
  }

  if (!map.getLayer("plui-bordeaux-fill")) {
    map.addLayer({
      id: "plui-bordeaux-fill",
      type: "fill",
      source: "plui-bordeaux",
      "source-layer": "plui-bordeaux",
      minzoom: 15,
      paint: {
        "fill-color": "#cccccc",
        "fill-opacity": 0.3
      }
    });
  }

  if (!map.getLayer("plui-bordeaux-outline")) {
    map.addLayer({
      id: "plui-bordeaux-outline",
      type: "line",
      source: "plui-bordeaux",
      "source-layer": "plui-bordeaux",
      minzoom: 15,
      paint: {
        "line-color": "#2D3748",
        "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.5, 18, 1.5],
        "line-opacity": 0.8
      }
    });
  }

  if (!map.getLayer("plui-bordeaux-labels")) {
    map.addLayer({
      id: "plui-bordeaux-labels",
      type: "symbol",
      source: "plui-bordeaux",
      "source-layer": "plui-bordeaux",
      minzoom: 16,
      layout: {
        "text-field": ["get", "etiquette"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 16, 11, 18, 16]
      },
      paint: {
        "text-color": "#1a1a1a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5
      }
    });
  }

  function updateColors() {
    const features = map.querySourceFeatures("plui-bordeaux", {
      sourceLayer: "plui-bordeaux"
    });

    let hasNew = false;
    for (const f of features) {
      const etiquette = f.properties?.etiquette;
      if (etiquette && !etiquetteColorMap.has(etiquette)) {
        getColorForEtiquette(etiquette);
        hasNew = true;
      }
    }

    if (hasNew) {
      map.setPaintProperty("plui-bordeaux-fill", "fill-color", buildMatchExpression());
    }
  }

  map.once("idle", updateColors);
  map.on("sourcedata", (e) => {
    if (e.sourceId === "plui-bordeaux" && e.isSourceLoaded) updateColors();
  });
}
import maplibregl from "maplibre-gl";

export default function registerPLULatresneLayer(
  map: maplibregl.Map,
  apiBase: string
) {
  // ============================================================
  // 📦 Source MBTiles (PLU Latresne – statique)
  // ============================================================
  const MBTILES_BASE = `${apiBase}/latresne/mbtiles`;

  // ============================================================
  // 🎨 Dictionnaire fixe zonage_reglement → couleur / opacité
  // ============================================================
  const ZONAGE_COLORS: Record<string, { color: string; opacity: number }> = {
    UE:  { color: "#FC8181", opacity: 0.1 },
    UA:  { color: "#E53E3E", opacity: 0.3 },
    UB:  { color: "#C53030", opacity: 0.4 },
    UC:  { color: "#9B2C2C", opacity: 0.5 },
    UX:  { color: "#F56565", opacity: 0.2 },
    A:   { color: "#ECC94B", opacity: 0.3 },
    N:   { color: "#48BB78", opacity: 0.3 },
    "1AU": { color: "#F687B3", opacity: 0.3 }
  };

  function buildMatchExpression(): maplibregl.ExpressionSpecification {
    const expr: any[] = ["match", ["get", "LIBELLE"]];
    for (const [z, cfg] of Object.entries(ZONAGE_COLORS)) {
      expr.push(z, cfg.color);
    }
    expr.push("#cccccc");
    return expr;
  }

  function buildOpacityExpression(): maplibregl.ExpressionSpecification {
    const expr: any[] = ["match", ["get", "LIBELLE"]];
    for (const [z, cfg] of Object.entries(ZONAGE_COLORS)) {
      expr.push(z, cfg.opacity);
    }
    expr.push(0.4);
    return expr;
  }

  // ============================================================
  // 🔌 Source vectorielle MBTiles
  // ============================================================
  if (!map.getSource("plu_latresne")) {
    map.addSource("plu_latresne", {
      type: "vector",
      tiles: [`${MBTILES_BASE}/plu/{z}/{x}/{y}.mvt`],
      minzoom: 14,
      maxzoom: 19
    });
  }

  // ============================================================
  // 🗺️ Remplissage des zonages
  // ============================================================
  if (!map.getLayer("plu_latresne-fill")) {
    map.addLayer({
      id: "plu_latresne-fill",
      type: "fill",
      source: "plu_latresne",
      "source-layer": "zone_urba",
      minzoom: 14,
      paint: {
        "fill-color": buildMatchExpression(),
        "fill-opacity": buildOpacityExpression()
      }
    });
  }

  // ============================================================
  // 🧭 Contours
  // ============================================================
  if (!map.getLayer("plu_latresne-outline")) {
    map.addLayer({
      id: "plu_latresne-outline",
      type: "line",
      source: "plu_latresne",
      "source-layer": "zone_urba",
      minzoom: 14,
      paint: {
        "line-color": "#2D3748",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0.5,
          16, 1.2,
          18, 2
        ],
        "line-opacity": 0.8
      }
    });
  }

  // ============================================================
  // 🏷️ Labels (optionnels)
  // ============================================================
  if (!map.getLayer("plu_latresne-labels")) {
    map.addLayer({
      id: "plu_latresne-labels",
      type: "symbol",
      source: "plu_latresne",
      "source-layer": "zone_urba",
      minzoom: 15,
      layout: {
        "text-field": ["get", "LIBELLE"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 15, 11, 18, 16],
        "text-anchor": "center"
      },
      paint: {
        "text-color": "#1a1a1a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5
      }
    });
  }
}

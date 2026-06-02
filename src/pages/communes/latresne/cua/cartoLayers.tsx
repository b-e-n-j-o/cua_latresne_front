import type maplibregl from "maplibre-gl";

/**
 * Catalogue des couches carto (config déclarative).
 * Ajouter une couche = ajouter une entrée dans CARTO_LAYERS.
 * La page LatresneTilesPage parcourt ce catalogue et n'a pas à connaître les détails.
 *
 * ⚠️ Tout attribut utilisé ci-dessous (couleur, label, filtre) DOIT être une colonne
 *    sélectionnée à la génération des tuiles (generate_pmtiles.py). Sinon → regénérer.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const TILES_BASE = `${SUPABASE_URL}/storage/v1/object/public/pmtiles/latresne`;

// ---------------------------------------------------------------------------
// Couleurs du zonage PLU (attribut `zonage_reglement`).
// Édite simplement ce mapping pour coller au standard CNIG souhaité.
// ---------------------------------------------------------------------------
export const ZONAGE_COLORS: Record<string, string> = {
  // Zones urbaines -> rouge
  UA: "#d64545",
  UB: "#d64545",
  UC: "#d64545",
  UE: "#d64545",
  UX: "#d64545",
  // À urbaniser -> rouge léger
  "1AU": "#efa59c",
  "2AU": "#efa59c",
  // Agricole -> jaune
  A: "#f2c14e",
  // Naturelle -> vert
  N: "#5a9367",
};
const ZONAGE_FALLBACK = "#bdbdbd";

// Légende dérivée (regroupée par catégorie)
export const ZONAGE_LEGEND = [
  { label: "Zones U (urbaines)", color: "#d64545" },
  { label: "AU (à urbaniser)", color: "#efa59c" },
  { label: "A (agricole)", color: "#f2c14e" },
  { label: "N (naturelle)", color: "#5a9367" },
];

/**
 * Couleur de remplissage zonage : zonage_reglement (UA, 1AU…) ou typezone CNIG (U, A…).
 * Gère aussi les suffixes GPU (UAr, 1AUa…) via préfixe 2–3 caractères.
 */
export function zonageFillColor(): maplibregl.ExpressionSpecification {
  const code = [
    "upcase",
    ["to-string", ["coalesce", ["get", "zonage_reglement"], ["get", "typezone"], ""]],
  ] as maplibregl.ExpressionSpecification;
  const p2 = ["slice", code, 0, 2] as maplibregl.ExpressionSpecification;
  const p3 = ["slice", code, 0, 3] as maplibregl.ExpressionSpecification;

  const urban = "#d64545";
  const au = "#efa59c";
  const agri = "#f2c14e";
  const nat = "#5a9367";

  return [
    "case",
    ["match", p3, "1AU", true, "2AU", true, false],
    au,
    ["match", p2, "UA", true, "UB", true, "UC", true, "UE", true, "UX", true, false],
    urban,
    ["match", p2, "AU", true, false],
    au,
    ["match", code, "A", true, false],
    agri,
    ["match", code, "N", true, false],
    nat,
    ["match", code, "U", true, false],
    urban,
    ZONAGE_FALLBACK,
  ] as maplibregl.ExpressionSpecification;
}

/** Détecte les couches « bâti » du fond IGN (PLAN.IGN / standard). */
function isIgnBuildingLayerId(id: string): boolean {
  const s = id.toLowerCase();
  return s.includes("bati") || s.includes("zone batie") || s.includes("zone d'activité");
}

/**
 * Point d'insertion des overlays : juste au-dessus de tous les bâtiments du fond,
 * sous les toponymes / étiquettes IGN (le 1er symbole du style est trop bas dans la pile).
 */
export function findOverlayBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers?.length) return undefined;

  let lastBatiIdx = -1;
  for (let i = 0; i < layers.length; i++) {
    if (isIgnBuildingLayerId(layers[i].id)) lastBatiIdx = i;
  }

  if (lastBatiIdx >= 0 && lastBatiIdx < layers.length - 1) {
    return layers[lastBatiIdx + 1].id;
  }

  return layers.find((l) => l.type === "symbol")?.id;
}

/** @deprecated Utiliser findOverlayBeforeId */
export const findBeforeSymbolsLayer = findOverlayBeforeId;

export const PRESCRIPTION_FALLBACK = "#9D4EDD";
export const INFOS_SURF_FALLBACK = "#0D9488";
export const SERVITUDE_FALLBACK = "#457B9D";

/** Palettes hex (MapLibre ne supporte pas l'expression `hsl`). */
export const PRESCRIPTION_PALETTE = [
  "#9D4EDD",
  "#7B2CBF",
  "#5A189A",
  "#C77DFF",
  "#B388EB",
  "#E0AAFF",
  "#7209B7",
  "#560BAD",
  "#480CA8",
  "#3F37C9",
];

/** Valeurs `libelle` dans infos_surf_latresne.pmtiles */
const INFOS_SURF_LIBELLE_VALUES = [
  "Droit de préemption urbain",
  "Périmètre de droit de préemption urbain",
  "Périmètre de voisinage d'infrastructure de transport terrestre (secteur affecté par le bruit) - voie routière",
  "Zone d'effet des canalisations de gaz",
] as const;

const INFOS_SURF_LIBELLE_PALETTE = ["#0D9488", "#059669", "#0284C7", "#6366F1"] as const;

export const INFOS_SURF_LIBELLE_COLORS: Record<string, string> = Object.fromEntries(
  INFOS_SURF_LIBELLE_VALUES.map((label, i) => [
    label.toUpperCase(),
    INFOS_SURF_LIBELLE_PALETTE[i % INFOS_SURF_LIBELLE_PALETTE.length],
  ])
);

export const INFOS_SURF_LIBELLE_LEGEND: { key: string; label: string; color: string }[] =
  INFOS_SURF_LIBELLE_VALUES.map((label, i) => ({
    key: label.toUpperCase(),
    label,
    color: INFOS_SURF_LIBELLE_PALETTE[i % INFOS_SURF_LIBELLE_PALETTE.length],
  }));

export function infosSurfLibelleFillColor(): maplibregl.ExpressionSpecification {
  return colorByValue("libelle", INFOS_SURF_LIBELLE_COLORS, INFOS_SURF_FALLBACK);
}

export const SERVITUDE_PALETTE = [
  "#457B9D",
  "#1D3557",
  "#2A6F97",
  "#468FAF",
  "#61A5C2",
  "#89C2D9",
  "#33658A",
  "#264653",
  "#2C699A",
  "#048BA8",
];

/** Bâtiments cadastre Latresne (couleur agent PLU : #F5480A). */
export const BATIMENT_FALLBACK = "#F5480A";
export const BATIMENT_PALETTE = [
  "#F5480A",
  "#EA580C",
  "#FB923C",
  "#C2410C",
  "#FDBA74",
  "#9A3412",
  "#F97316",
  "#FED7AA",
  "#7C2D12",
  "#431407",
];

/** Types dans bati_latresne.pmtiles (attribut `type`). */
export const BATIMENT_TYPE_LEGEND: { key: string; label: string; color: string }[] = [
  { key: "BÂTIMENT EN DUR", label: "Bâtiment en dur", color: "#F5480A" },
  { key: "CONSTRUCTION LÉGÈRE", label: "Construction légère", color: "#FB923C" },
];

export const BATIMENT_TYPE_COLORS: Record<string, string> = Object.fromEntries(
  BATIMENT_TYPE_LEGEND.map((i) => [i.key, i.color])
);

export function batimentTypeFillColor(): maplibregl.ExpressionSpecification {
  return colorByValue("type", BATIMENT_TYPE_COLORS, BATIMENT_FALLBACK);
}

/**
 * Couleur stable par valeur de champ via palette (longueur du libellé → bucket).
 * Utile quand les valeurs (libelle, suptype…) ne sont pas connues à l'avance.
 */
export function categoricalFillColor(
  field: string,
  palette: readonly string[],
  fallback: string
): maplibregl.ExpressionSpecification {
  const key = [
    "upcase",
    ["to-string", ["coalesce", ["get", field], ""]],
  ] as maplibregl.ExpressionSpecification;
  const bucket = ["%", ["length", key], palette.length] as maplibregl.ExpressionSpecification;

  const matchExpr: unknown[] = ["match", bucket];
  for (let i = 0; i < palette.length; i++) {
    matchExpr.push(i, palette[i]);
  }
  matchExpr.push(fallback);

  return [
    "case",
    ["==", key, ""],
    fallback,
    matchExpr,
  ] as maplibregl.ExpressionSpecification;
}

/** Champ texte MapLibre en majuscules. */
export function uppercaseField(field: string): maplibregl.ExpressionSpecification {
  return ["upcase", ["to-string", ["coalesce", ["get", field], ""]]];
}

/** Couleurs PPRI (`nom_code`) — alignées sur section_ppri.py / identité foncière. */
export const PPRI_NOM_CODE_COLORS: Record<string, string> = {
  ROUGE_NON_URBA: "#DC2626",
  ROUGE_URBA: "#B91C1C",
  GRENAT: "#7F1D1D",
  BLEU_CLAIR: "#38BDF8",
  ROUGE_CENTRE: "#EF4444",
  BLEUE: "#1D4ED8",
};
export const PPRI_NOM_CODE_FALLBACK = "#9CA3AF";

export const PPRI_NOM_CODE_LEGEND: { key: string; label: string; color: string }[] = [
  { key: "(NON RENSEIGNÉ)", label: "null", color: PPRI_NOM_CODE_FALLBACK },
  { key: "ROUGE_NON_URBA", label: "ROUGE_NON_URBA", color: PPRI_NOM_CODE_COLORS.ROUGE_NON_URBA },
  { key: "ROUGE_URBA", label: "ROUGE_URBA", color: PPRI_NOM_CODE_COLORS.ROUGE_URBA },
  { key: "GRENAT", label: "GRENAT", color: PPRI_NOM_CODE_COLORS.GRENAT },
  { key: "BLEU_CLAIR", label: "BLEU_CLAIR", color: PPRI_NOM_CODE_COLORS.BLEU_CLAIR },
  { key: "ROUGE_CENTRE", label: "ROUGE_CENTRE", color: PPRI_NOM_CODE_COLORS.ROUGE_CENTRE },
  { key: "BLEUE", label: "BLEUE", color: PPRI_NOM_CODE_COLORS.BLEUE },
];

function colorByValue(
  field: string,
  colors: Record<string, string>,
  fallback: string
): maplibregl.ExpressionSpecification {
  const code = [
    "upcase",
    ["to-string", ["coalesce", ["get", field], ""]],
  ] as maplibregl.ExpressionSpecification;
  const expr: unknown[] = ["match", code];
  for (const [value, color] of Object.entries(colors)) {
    expr.push(value, color);
  }
  expr.push(fallback);
  return [
    "case",
    ["==", code, ""],
    fallback,
    expr,
  ] as maplibregl.ExpressionSpecification;
}

export function ppriNomCodeFillColor(): maplibregl.ExpressionSpecification {
  return colorByValue("nom_code", PPRI_NOM_CODE_COLORS, PPRI_NOM_CODE_FALLBACK);
}

// ---------------------------------------------------------------------------
// PPRMVT — zones par codezone (latresne.pprmvt)
// ---------------------------------------------------------------------------
export const PPRMVT_FALLBACK = "#2A9D8F";

/** Valeurs distinctes dans pprmvt_latresne.pmtiles (attribut codezone). */
const PPRMVT_CODEZONE_VALUES = [
  "BF",
  "BF,BG",
  "BF0",
  "BF1",
  "BF2",
  "BF2,BG",
  "BF2,BG,BP2",
  "BG",
  "BG,BP2",
  "BP2",
  "GF",
  "GF,BG",
  "RF",
  "RF,BG",
  "RF,RG",
  "RF,RG,RP",
  "RG",
  "RG,BF2",
  "RG,RP",
  "RP",
  "RP,BG",
] as const;

const PPRMVT_CODEZONE_PALETTE = [
  "#B45309",
  "#D97706",
  "#F59E0B",
  "#FBBF24",
  "#84CC16",
  "#65A30D",
  "#15803D",
  "#0D9488",
  "#0891B2",
  "#0284C7",
  "#2563EB",
  "#4F46E5",
  "#7C3AED",
  "#9333EA",
  "#C026D3",
  "#DB2777",
  "#E11D48",
  "#DC2626",
  "#78716C",
  "#57534E",
  "#1F2937",
] as const;

export const PPRMVT_CODEZONE_COLORS: Record<string, string> = Object.fromEntries(
  PPRMVT_CODEZONE_VALUES.map((label, i) => [
    label.toUpperCase(),
    PPRMVT_CODEZONE_PALETTE[i % PPRMVT_CODEZONE_PALETTE.length],
  ])
);

export const PPRMVT_CODEZONE_LEGEND: { key: string; label: string; color: string }[] =
  PPRMVT_CODEZONE_VALUES.map((label, i) => ({
    key: label.toUpperCase(),
    label,
    color: PPRMVT_CODEZONE_PALETTE[i % PPRMVT_CODEZONE_PALETTE.length],
  }));

export function pprmvtCodezoneFillColor(): maplibregl.ExpressionSpecification {
  return colorByValue("codezone", PPRMVT_CODEZONE_COLORS, PPRMVT_FALLBACK);
}

// ---------------------------------------------------------------------------
// Types du catalogue
// ---------------------------------------------------------------------------
/** Spec de layer MapLibre sans `source`/`source-layer` (injectés au chargement). */
export type CartoSubLayer = Omit<maplibregl.LayerSpecification, "source" | "source-layer">;

export interface CartoLayerDef {
  id: string;            // clé unique (= id de la source vector)
  title: string;         // libellé du toggle
  defaultVisible: boolean;
  pmtilesUrl: string;    // URL complète du .pmtiles
  sourceLayer: string;   // = `-nln` du script de génération
  /** Attribut affiché au survol (majuscules). */
  tooltipField?: string;
  /** Attribut pour sous-filtres / légende (libelle, suptype…). */
  groupField?: string;
  filterPalette?: readonly string[];
  filterFallback?: string;
  /** Couleurs par clé de groupe (nom_code, etc.) — prioritaire sur la palette générique. */
  groupColorMap?: Record<string, string>;
  /** Légende fixe (sous-filtres) même si une valeur n'est pas dans la vue courante. */
  staticGroupLegend?: readonly { key: string; label: string; color: string }[];
  /** Légende couleurs pliable (ex. catégories zonage PLU), sans sous-filtres. */
  colorLegend?: readonly { label: string; color: string }[];
  layers: CartoSubLayer[];
}

// ---------------------------------------------------------------------------
// Le catalogue
// ---------------------------------------------------------------------------
export const CARTO_LAYERS: CartoLayerDef[] = [
  {
    id: "zonage",
    title: "Zonage PLU",
    defaultVisible: true,
    pmtilesUrl: `${TILES_BASE}/latresne_zonage.pmtiles`,
    sourceLayer: "zonage",
    tooltipField: "libelle",
    colorLegend: ZONAGE_LEGEND,
    layers: [
      {
        id: "zonage-fill",
        type: "fill",
        paint: {
          "fill-color": zonageFillColor(),
          "fill-opacity": 0.5,
          "fill-antialias": true,
        },
      },
      {
        id: "zonage-outline",
        type: "line",
        paint: {
          "line-color": "#5f6368",
          "line-width": 0.6,
          "line-opacity": 0.6,
        },
      },
      {
        id: "zonage-labels",
        type: "symbol",
        minzoom: 14,
        layout: {
          "text-field": uppercaseField("libelle"),
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
          "text-max-width": 14,
        },
        paint: {
          "text-color": "#1a1a1a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      },
    ],
  },
  {
    id: "parcelles",
    title: "Cadastre",
    defaultVisible: true,
    pmtilesUrl: `${TILES_BASE}/latresne_parcelles.pmtiles`,
    sourceLayer: "parcelles",
    layers: [
      {
        id: "parcelles-outline",
        type: "line",
        paint: {
          "line-color": "#3c4043",
          "line-width": 0.8,
          "line-opacity": 0.85,
        },
      },
      {
        // Étiquettes "section numero" affichées seulement de près (zoom >= 17)
        id: "parcelles-labels",
        type: "symbol",
        minzoom: 17,
        layout: {
          "text-field": [
            "concat",
            ["get", "section"],
            " ",
            ["get", "numero"],
          ] as maplibregl.ExpressionSpecification,
          "text-size": 11,
          // ⚠️ Doit exister dans les glyphs du fond de carte.
          // IGN Plan v2 et la plupart des styles OSM exposent "Noto Sans Regular".
          // Si les labels n'apparaissent pas, adapte ce nom au style choisi.
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
          "text-padding": 2,
        },
        paint: {
          "text-color": "#1a1a1a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      },
    ],
  },
  {
    id: "prescriptions-surf",
    title: "Prescriptions surfaciques",
    defaultVisible: false,
    pmtilesUrl: `${TILES_BASE}/prescriptions_surf_latresne.pmtiles`,
    sourceLayer: "prescriptions_surf_latresne",
    tooltipField: "libelle",
    groupField: "libelle",
    filterPalette: PRESCRIPTION_PALETTE,
    filterFallback: PRESCRIPTION_FALLBACK,
    layers: [
      {
        id: "prescriptions-surf-fill",
        type: "fill",
        paint: {
          "fill-color": categoricalFillColor("libelle", PRESCRIPTION_PALETTE, PRESCRIPTION_FALLBACK),
          "fill-opacity": 0.4,
          "fill-antialias": true,
        },
      },
      {
        id: "prescriptions-surf-outline",
        type: "line",
        paint: {
          "line-color": categoricalFillColor("libelle", PRESCRIPTION_PALETTE, PRESCRIPTION_FALLBACK),
          "line-width": 1,
          "line-opacity": 0.85,
        },
      },
      {
        id: "prescriptions-surf-labels",
        type: "symbol",
        minzoom: 16,
        layout: {
          "text-field": uppercaseField("libelle"),
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
          "text-max-width": 14,
        },
        paint: {
          "text-color": "#4a148c",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      },
    ],
  },
  {
    id: "infos-surf",
    title: "Informations et préemption",
    defaultVisible: false,
    pmtilesUrl: `${TILES_BASE}/infos_surf_latresne.pmtiles`,
    sourceLayer: "infos_surf",
    tooltipField: "libelle",
    groupField: "libelle",
    groupColorMap: INFOS_SURF_LIBELLE_COLORS,
    staticGroupLegend: INFOS_SURF_LIBELLE_LEGEND,
    layers: [
      {
        id: "infos-surf-fill",
        type: "fill",
        paint: {
          "fill-color": infosSurfLibelleFillColor(),
          "fill-opacity": 0.4,
          "fill-antialias": true,
        },
      },
      {
        id: "infos-surf-outline",
        type: "line",
        paint: {
          "line-color": infosSurfLibelleFillColor(),
          "line-width": 1,
          "line-opacity": 0.85,
        },
      },
      {
        id: "infos-surf-labels",
        type: "symbol",
        minzoom: 16,
        layout: {
          "text-field": uppercaseField("libelle"),
          "text-size": 9,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
          "text-max-width": 12,
        },
        paint: {
          "text-color": "#134e4a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      },
    ],
  },
  {
    id: "servitudes",
    title: "Servitudes (assiettes)",
    defaultVisible: false,
    pmtilesUrl: `${TILES_BASE}/servitudes_latresne.pmtiles`,
    sourceLayer: "sup_assiette_s",
    tooltipField: "suptype",
    groupField: "suptype",
    filterPalette: SERVITUDE_PALETTE,
    filterFallback: SERVITUDE_FALLBACK,
    layers: [
      {
        id: "servitudes-fill",
        type: "fill",
        paint: {
          "fill-color": categoricalFillColor("suptype", SERVITUDE_PALETTE, SERVITUDE_FALLBACK),
          "fill-opacity": 0.35,
          "fill-antialias": true,
        },
      },
      {
        id: "servitudes-outline",
        type: "line",
        paint: {
          "line-color": categoricalFillColor("suptype", SERVITUDE_PALETTE, SERVITUDE_FALLBACK),
          "line-width": 1.2,
          "line-dasharray": [2, 1],
          "line-opacity": 0.9,
        },
      },
      {
        id: "servitudes-labels",
        type: "symbol",
        minzoom: 16,
        layout: {
          "text-field": uppercaseField("suptype"),
          "text-size": 11,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#1a3a52",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      },
    ],
  },
  {
    id: "ppri",
    title: "PPRI (PM1)",
    defaultVisible: false,
    pmtilesUrl: `${TILES_BASE}/ppri_latresne.pmtiles`,
    sourceLayer: "pm1_detaillee_gironde",
    tooltipField: "nom_code",
    groupField: "nom_code",
    groupColorMap: { "(NON RENSEIGNÉ)": PPRI_NOM_CODE_FALLBACK, ...PPRI_NOM_CODE_COLORS },
    staticGroupLegend: PPRI_NOM_CODE_LEGEND,
    layers: [
      {
        id: "ppri-fill",
        type: "fill",
        paint: {
          "fill-color": ppriNomCodeFillColor(),
          "fill-opacity": 0.45,
          "fill-antialias": true,
        },
      },
      {
        id: "ppri-outline",
        type: "line",
        paint: {
          "line-color": ppriNomCodeFillColor(),
          "line-width": 1,
          "line-opacity": 0.85,
        },
      },
      {
        id: "ppri-labels",
        type: "symbol",
        minzoom: 16,
        layout: {
          "text-field": uppercaseField("nom_code"),
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#1e3a5f",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      },
    ],
  },
  {
    id: "batiments",
    title: "Bâtiments",
    defaultVisible: true,
    pmtilesUrl: `${TILES_BASE}/bati_latresne.pmtiles`,
    sourceLayer: "batiments_latresne",
    tooltipField: "type",
    groupField: "type",
    filterPalette: BATIMENT_PALETTE,
    filterFallback: BATIMENT_FALLBACK,
    groupColorMap: BATIMENT_TYPE_COLORS,
    staticGroupLegend: BATIMENT_TYPE_LEGEND,
    layers: [
      {
        id: "latresne-batiments-fill",
        type: "fill",
        paint: {
          "fill-color": batimentTypeFillColor(),
          "fill-opacity": 0.55,
          "fill-antialias": true,
        },
      },
      {
        id: "latresne-batiments-outline",
        type: "line",
        paint: {
          "line-color": batimentTypeFillColor(),
          "line-width": 0.8,
          "line-opacity": 0.9,
        },
      },
    ],
  },
  {
    id: "pprmvt",
    title: "PPRMVT",
    defaultVisible: false,
    pmtilesUrl: `${TILES_BASE}/pprmvt_latresne.pmtiles`,
    sourceLayer: "pprmvt",
    tooltipField: "codezone",
    groupField: "codezone",
    groupColorMap: PPRMVT_CODEZONE_COLORS,
    staticGroupLegend: PPRMVT_CODEZONE_LEGEND,
    layers: [
      {
        id: "pprmvt-fill",
        type: "fill",
        paint: {
          "fill-color": pprmvtCodezoneFillColor(),
          "fill-opacity": 0.45,
          "fill-antialias": true,
        },
      },
      {
        id: "pprmvt-outline",
        type: "line",
        paint: {
          "line-color": pprmvtCodezoneFillColor(),
          "line-width": 1,
          "line-opacity": 0.85,
        },
      },
      {
        id: "pprmvt-labels",
        type: "symbol",
        minzoom: 15,
        layout: {
          "text-field": uppercaseField("codezone"),
          "text-size": 9,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
          "text-max-width": 12,
        },
        paint: {
          "text-color": "#134e4a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      },
    ],
  },
];
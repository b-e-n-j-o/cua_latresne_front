import type maplibregl from "maplibre-gl";

/**
 * Catalogue PMTiles Argelès — config déclarative.
 * Ajouter une couche = entrée dans CARTO_LAYERS + family si besoin.
 *
 * ⚠️ Les attributs (couleur, filtre, tooltip) doivent exister dans les tuiles
 *    (pmtiles.py / ogr2ogr). Sinon → regénérer le .pmtiles.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const TILES_BASE = `${SUPABASE_URL}/storage/v1/object/public/pmtiles/argeles`;

// ---------------------------------------------------------------------------
// Familles (légende repliable)
// ---------------------------------------------------------------------------
export const CARTO_FAMILIES = [
  { id: "zonages_plu", title: "Zonage PLU" },
  { id: "prescriptions", title: "Prescriptions" },
  { id: "informations", title: "Informations" },
  { id: "servitudes", title: "Servitudes" },
  { id: "risques", title: "Risques" },
  { id: "environnement", title: "Environnement" },
  { id: "reseaux", title: "Réseaux" },
  { id: "cadastre", title: "Cadastre" },
] as const;

export type CartoFamilyId = (typeof CARTO_FAMILIES)[number]["id"];

// ---------------------------------------------------------------------------
// Styles communs
// ---------------------------------------------------------------------------
const ZONAGE_FALLBACK = "#bdbdbd";
const ZONAGE_URBAN = "#d64545";
const ZONAGE_AU = "#efa59c";
const ZONAGE_AGRI = "#f2c14e";
const ZONAGE_NAT = "#5a9367";

export const ZONAGE_LEGEND = [
  { label: "Zones U (urbaines)", color: ZONAGE_URBAN },
  { label: "AU (à urbaniser)", color: ZONAGE_AU },
  { label: "A (agricole)", color: ZONAGE_AGRI },
  { label: "N (naturelle)", color: ZONAGE_NAT },
];

export const PRESCRIPTION_FALLBACK = "#9D4EDD";
export const INFOS_FALLBACK = "#0D9488";
export const SERVITUDE_FALLBACK = "#457B9D";

export const PRESCRIPTION_PALETTE = [
  "#9D4EDD", "#7B2CBF", "#5A189A", "#C77DFF", "#B388EB",
  "#E0AAFF", "#7209B7", "#560BAD", "#480CA8", "#3F37C9",
];

export const INFOS_PALETTE = [
  "#0D9488", "#14B8A6", "#2DD4BF", "#5EEAD4", "#134E4A",
  "#115E59", "#0F766E", "#047857", "#059669", "#10B981",
];

export const SERVITUDE_PALETTE = [
  "#457B9D", "#1D3557", "#2A6F97", "#468FAF", "#61A5C2",
  "#89C2D9", "#33658A", "#264653", "#2C699A", "#048BA8",
];

export const RISQUE_FALLBACK = "#E76F51";
export const RISQUE_PALETTE = [
  "#E76F51", "#F4A261", "#E9C46A", "#D62828", "#BC4749",
  "#9B2226", "#AE2012", "#BB3E03", "#CA6702", "#EE9B00",
];

export const ENV_FALLBACK = "#2D6A4F";
export const ENV_PALETTE = [
  "#1B4332", "#2D6A4F", "#40916C", "#52B788", "#74C69D",
  "#95D5B2", "#344E41", "#588157", "#3A5A40", "#A7C957",
];

export const RESEAU_FALLBACK = "#0077B6";
export const RESEAU_PALETTE = [
  "#0077B6", "#0096C7", "#00B4D8", "#48CAE4", "#023E8A",
  "#03045E", "#0077B6", "#1D3557", "#457B9D", "#2A6F97",
];

export const BATIMENT_FALLBACK = "#F5480A";
export const BATIMENT_PALETTE = [
  "#F5480A", "#EA580C", "#FB923C", "#C2410C", "#FDBA74",
  "#9A3412", "#F97316", "#FED7AA", "#7C2D12", "#431407",
];

function literalColor(color: string): maplibregl.ExpressionSpecification {
  return ["literal", color];
}

function tilesUrl(table: string): string {
  return `${TILES_BASE}/${table}.pmtiles`;
}

function isIgnBuildingLayerId(id: string): boolean {
  const s = id.toLowerCase();
  return s.includes("bati") || s.includes("zone batie") || s.includes("zone d'activité");
}

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

export function uppercaseField(field: string): maplibregl.ExpressionSpecification {
  return ["upcase", ["to-string", ["coalesce", ["get", field], ""]]];
}

export function zonageFillColor(): maplibregl.ExpressionSpecification {
  const code = [
    "upcase",
    ["to-string", ["coalesce", ["get", "libelle"], ["get", "typezone"], ""]],
  ] as maplibregl.ExpressionSpecification;
  const p1 = ["slice", code, 0, 1] as maplibregl.ExpressionSpecification;
  const p2 = ["slice", code, 0, 2] as maplibregl.ExpressionSpecification;
  const p3 = ["slice", code, 0, 3] as maplibregl.ExpressionSpecification;
  const isAu = [
    "any",
    ["==", p2, "AU"],
    ["match", p3, "1AU", true, "2AU", true, false],
  ] as maplibregl.ExpressionSpecification;

  return [
    "case",
    ["==", code, ""],
    ZONAGE_FALLBACK,
    isAu,
    ZONAGE_AU,
    ["==", p1, "N"],
    ZONAGE_NAT,
    ["==", p1, "A"],
    ZONAGE_AGRI,
    ZONAGE_URBAN,
  ] as maplibregl.ExpressionSpecification;
}

export type CartoSubLayer = Omit<maplibregl.LayerSpecification, "source" | "source-layer">;

export interface CartoLayerDef {
  id: string;
  title: string;
  defaultVisible: boolean;
  /** Absent = pas de tuiles (ex. cadastre GeoJSON seul). */
  pmtilesUrl?: string;
  sourceLayer: string;
  family?: CartoFamilyId;
  tooltipField?: string;
  groupField?: string;
  filterPalette?: readonly string[];
  filterFallback?: string;
  groupColorMap?: Record<string, string>;
  staticGroupLegend?: readonly { key: string; label: string; color: string }[];
  colorLegend?: readonly { label: string; color: string }[];
  layers: CartoSubLayer[];
}

function surfLayers(
  prefix: string,
  colorExpr: maplibregl.ExpressionSpecification,
  labelField = "libelle"
): CartoSubLayer[] {
  return [
    {
      id: `${prefix}-fill`,
      type: "fill",
      paint: { "fill-color": colorExpr, "fill-opacity": 0.4, "fill-antialias": true },
    },
    {
      id: `${prefix}-outline`,
      type: "line",
      paint: { "line-color": colorExpr, "line-width": 1, "line-opacity": 0.85 },
    },
    {
      id: `${prefix}-labels`,
      type: "symbol",
      minzoom: 16,
      layout: {
        "text-field": uppercaseField(labelField),
        "text-size": 10,
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false,
        "text-max-width": 14,
      },
      paint: { "text-color": "#1a1a1a", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
    },
  ];
}

function linLayers(
  prefix: string,
  colorExpr: maplibregl.ExpressionSpecification,
  labelField = "libelle"
): CartoSubLayer[] {
  return [
    {
      id: `${prefix}-line`,
      type: "line",
      paint: { "line-color": colorExpr, "line-width": 2, "line-opacity": 0.9 },
    },
    {
      id: `${prefix}-labels`,
      type: "symbol",
      minzoom: 16,
      layout: {
        "text-field": uppercaseField(labelField),
        "text-size": 9,
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false,
      },
      paint: { "text-color": "#1a1a1a", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
    },
  ];
}

function pctLayers(
  prefix: string,
  colorExpr: maplibregl.ExpressionSpecification,
  labelField = "libelle"
): CartoSubLayer[] {
  return [
    {
      id: `${prefix}-circle`,
      type: "circle",
      paint: {
        "circle-color": colorExpr,
        "circle-radius": 5,
        "circle-opacity": 0.85,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
      },
    },
    {
      id: `${prefix}-labels`,
      type: "symbol",
      minzoom: 16,
      layout: {
        "text-field": uppercaseField(labelField),
        "text-size": 9,
        "text-font": ["Noto Sans Regular"],
        "text-offset": [0, 1.2],
        "text-allow-overlap": false,
      },
      paint: { "text-color": "#1a1a1a", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
    },
  ];
}

function supSurfLayers(prefix: string): CartoSubLayer[] {
  const color = categoricalFillColor("suptype", SERVITUDE_PALETTE, SERVITUDE_FALLBACK);
  return [
    {
      id: `${prefix}-fill`,
      type: "fill",
      paint: { "fill-color": color, "fill-opacity": 0.35, "fill-antialias": true },
    },
    {
      id: `${prefix}-outline`,
      type: "line",
      paint: {
        "line-color": color,
        "line-width": 1.2,
        "line-dasharray": [2, 1],
        "line-opacity": 0.9,
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Catalogue — uniquement les PMTiles présents en storage (pmtiles/argeles/)
// ---------------------------------------------------------------------------
export const CARTO_LAYERS: CartoLayerDef[] = [
  // —— Zonages PLU ——
  {
    id: "zonage-plu",
    title: "Zonage PLU",
    family: "zonages_plu",
    defaultVisible: true,
    pmtilesUrl: tilesUrl("zonage_plu"),
    sourceLayer: "zonage_plu",
    tooltipField: "libelle",
    colorLegend: ZONAGE_LEGEND,
    layers: [
      {
        id: "argeles-zonage-fill",
        type: "fill",
        paint: { "fill-color": zonageFillColor(), "fill-opacity": 0.5, "fill-antialias": true },
      },
      {
        id: "argeles-zonage-outline",
        type: "line",
        paint: { "line-color": "#5f6368", "line-width": 0.6, "line-opacity": 0.6 },
      },
    ],
  },
  {
    id: "hauteurs",
    title: "Hauteurs maximales (PLU)",
    family: "zonages_plu",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("hauteurs"),
    sourceLayer: "hauteurs",
    tooltipField: "legende",
    groupField: "legende",
    filterPalette: PRESCRIPTION_PALETTE,
    filterFallback: PRESCRIPTION_FALLBACK,
    layers: surfLayers(
      "argeles-hauteurs",
      categoricalFillColor("legende", PRESCRIPTION_PALETTE, PRESCRIPTION_FALLBACK),
      "legende"
    ),
  },
  // —— Prescriptions ——
  {
    id: "prescriptions-surf",
    title: "Prescriptions surfaciques",
    family: "prescriptions",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("prescriptions_surf"),
    sourceLayer: "prescriptions_surf",
    tooltipField: "libelle",
    groupField: "libelle",
    filterPalette: PRESCRIPTION_PALETTE,
    filterFallback: PRESCRIPTION_FALLBACK,
    layers: surfLayers(
      "argeles-prescriptions-surf",
      categoricalFillColor("libelle", PRESCRIPTION_PALETTE, PRESCRIPTION_FALLBACK)
    ),
  },
  {
    id: "prescriptions-lin",
    title: "Prescriptions linéaires",
    family: "prescriptions",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("prescriptions_lineaires"),
    sourceLayer: "prescriptions_lineaires",
    tooltipField: "libelle",
    groupField: "libelle",
    filterPalette: PRESCRIPTION_PALETTE,
    filterFallback: PRESCRIPTION_FALLBACK,
    layers: linLayers(
      "argeles-prescriptions-lin",
      categoricalFillColor("libelle", PRESCRIPTION_PALETTE, PRESCRIPTION_FALLBACK)
    ),
  },
  {
    id: "prescriptions-pct",
    title: "Prescriptions ponctuelles",
    family: "prescriptions",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("prescriptions_ponctuelles"),
    sourceLayer: "prescriptions_ponctuelles",
    tooltipField: "libelle",
    groupField: "libelle",
    filterPalette: PRESCRIPTION_PALETTE,
    filterFallback: PRESCRIPTION_FALLBACK,
    layers: pctLayers(
      "argeles-prescriptions-pct",
      categoricalFillColor("libelle", PRESCRIPTION_PALETTE, PRESCRIPTION_FALLBACK)
    ),
  },
  // —— Informations ——
  {
    id: "infos-surf",
    title: "Informations surfaciques",
    family: "informations",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("infos_surf"),
    sourceLayer: "infos_surf",
    tooltipField: "libelle",
    groupField: "libelle",
    filterPalette: INFOS_PALETTE,
    filterFallback: INFOS_FALLBACK,
    layers: surfLayers(
      "argeles-infos-surf",
      categoricalFillColor("libelle", INFOS_PALETTE, INFOS_FALLBACK)
    ),
  },
  // —— Servitudes ——
  {
    id: "sup-assiette-s",
    title: "Assiettes surfaciques",
    family: "servitudes",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("sup_assiette_s"),
    sourceLayer: "sup_assiette_s",
    tooltipField: "suptype",
    groupField: "suptype",
    filterPalette: SERVITUDE_PALETTE,
    filterFallback: SERVITUDE_FALLBACK,
    layers: supSurfLayers("argeles-sup-assiette-s"),
  },
  {
    id: "generateurs-sup-lineaires",
    title: "Générateurs SUP linéaires",
    family: "servitudes",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("generateurs_sup_lineaires"),
    sourceLayer: "generateurs_sup_lineaires",
    tooltipField: "nomgen",
    groupField: "suptype",
    filterPalette: SERVITUDE_PALETTE,
    filterFallback: SERVITUDE_FALLBACK,
    layers: linLayers(
      "argeles-generateurs-sup-lin",
      categoricalFillColor("suptype", SERVITUDE_PALETTE, SERVITUDE_FALLBACK),
      "nomgen"
    ),
  },
  // —— Risques ——
  {
    id: "ppr",
    title: "PPR",
    family: "risques",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("ppr"),
    sourceLayer: "ppr",
    tooltipField: "label",
    groupField: "label",
    filterPalette: RISQUE_PALETTE,
    filterFallback: RISQUE_FALLBACK,
    layers: surfLayers(
      "argeles-ppr",
      categoricalFillColor("label", RISQUE_PALETTE, RISQUE_FALLBACK),
      "label"
    ),
  },
  {
    id: "pprif",
    title: "PPRIF",
    family: "risques",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("pprif"),
    sourceLayer: "pprif",
    tooltipField: "label",
    groupField: "label",
    filterPalette: RISQUE_PALETTE,
    filterFallback: RISQUE_FALLBACK,
    layers: surfLayers(
      "argeles-pprif",
      categoricalFillColor("label", RISQUE_PALETTE, RISQUE_FALLBACK),
      "label"
    ),
  },
  {
    id: "old",
    title: "Zones de débroussaillement (OLD)",
    family: "risques",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("old"),
    sourceLayer: "old",
    tooltipField: "zonage",
    groupField: "zonage",
    filterPalette: RISQUE_PALETTE,
    filterFallback: RISQUE_FALLBACK,
    layers: surfLayers(
      "argeles-old",
      categoricalFillColor("zonage", RISQUE_PALETTE, RISQUE_FALLBACK),
      "zonage"
    ),
  },
  {
    id: "retrait-gonflement-argiles",
    title: "Retrait-gonflement des argiles",
    family: "risques",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("retrait_gonflement_argiles_2026"),
    sourceLayer: "retrait_gonflement_argiles_2026",
    tooltipField: "niveau",
    groupField: "niveau",
    filterPalette: RISQUE_PALETTE,
    filterFallback: RISQUE_FALLBACK,
    layers: surfLayers(
      "argeles-retrait-argiles",
      categoricalFillColor("niveau", RISQUE_PALETTE, RISQUE_FALLBACK),
      "niveau"
    ),
  },
  // —— Environnement ——
  {
    id: "aoc",
    title: "AOC viticoles",
    family: "environnement",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("aoc"),
    sourceLayer: "aoc",
    tooltipField: "denom",
    groupField: "denom",
    filterPalette: ENV_PALETTE,
    filterFallback: ENV_FALLBACK,
    layers: surfLayers(
      "argeles-aoc",
      categoricalFillColor("denom", ENV_PALETTE, ENV_FALLBACK),
      "denom"
    ),
  },
  {
    id: "haies-bocages",
    title: "Haies et bocages",
    family: "environnement",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("haies_bocages"),
    sourceLayer: "haies_bocages",
    layers: linLayers("argeles-haies-bocages", literalColor(ENV_FALLBACK)),
  },
  {
    id: "znieffs",
    title: "ZNIEFF",
    family: "environnement",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("znieffs"),
    sourceLayer: "znieffs",
    tooltipField: "nom_site",
    groupField: "nom_site",
    filterPalette: ENV_PALETTE,
    filterFallback: ENV_FALLBACK,
    layers: surfLayers(
      "argeles-znieffs",
      categoricalFillColor("nom_site", ENV_PALETTE, ENV_FALLBACK),
      "nom_site"
    ),
  },
  {
    id: "prairies-sensibles",
    title: "Prairies sensibles (BCAE)",
    family: "environnement",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("prairies_sensibles"),
    sourceLayer: "prairies_sensibles",
    layers: surfLayers("argeles-prairies-sensibles", literalColor(ENV_FALLBACK)),
  },
  {
    id: "natura-2000",
    title: "NATURA 2000",
    family: "environnement",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("natura_2000"),
    sourceLayer: "natura_2000",
    tooltipField: "n_site",
    groupField: "n_site",
    filterPalette: ENV_PALETTE,
    filterFallback: ENV_FALLBACK,
    layers: surfLayers(
      "argeles-natura-2000",
      categoricalFillColor("n_site", ENV_PALETTE, ENV_FALLBACK),
      "n_site"
    ),
  },
  {
    id: "zaer",
    title: "ZAER",
    family: "environnement",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("zaer"),
    sourceLayer: "zaer",
    tooltipField: "nom",
    groupField: "nom",
    filterPalette: ENV_PALETTE,
    filterFallback: ENV_FALLBACK,
    layers: surfLayers(
      "argeles-zaer",
      categoricalFillColor("nom", ENV_PALETTE, ENV_FALLBACK),
      "nom"
    ),
  },
  // —— Réseaux ——
  {
    id: "reseaux-enedis-lineaires",
    title: "Réseaux ENEDIS linéaires",
    family: "reseaux",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("reseaux_enedis_lineaires"),
    sourceLayer: "reseaux_enedis_lineaires",
    tooltipField: "type",
    groupField: "type",
    filterPalette: RESEAU_PALETTE,
    filterFallback: RESEAU_FALLBACK,
    layers: linLayers(
      "argeles-reseaux-enedis-lin",
      categoricalFillColor("type", RESEAU_PALETTE, RESEAU_FALLBACK),
      "type"
    ),
  },
  {
    id: "reseau-enedis-ponctuels",
    title: "Réseaux ENEDIS ponctuels",
    family: "reseaux",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("reseau_enedis_ponctuels"),
    sourceLayer: "reseau_enedis_ponctuels",
    tooltipField: "type",
    groupField: "type",
    filterPalette: RESEAU_PALETTE,
    filterFallback: RESEAU_FALLBACK,
    layers: pctLayers(
      "argeles-reseaux-enedis-pct",
      categoricalFillColor("type", RESEAU_PALETTE, RESEAU_FALLBACK),
      "type"
    ),
  },
  // —— Cadastre ——
  {
    id: "parcelles",
    title: "Parcelles cadastrales",
    family: "cadastre",
    defaultVisible: true,
    sourceLayer: "",
    layers: [],
  },
  {
    id: "batiments",
    title: "Bâtiments",
    family: "cadastre",
    defaultVisible: false,
    pmtilesUrl: tilesUrl("batiments"),
    sourceLayer: "batiments",
    tooltipField: "type",
    groupField: "type",
    filterPalette: BATIMENT_PALETTE,
    filterFallback: BATIMENT_FALLBACK,
    layers: [
      {
        id: "argeles-batiments-fill",
        type: "fill",
        paint: {
          "fill-color": categoricalFillColor("type", BATIMENT_PALETTE, BATIMENT_FALLBACK),
          "fill-opacity": 0.55,
          "fill-antialias": true,
        },
      },
      {
        id: "argeles-batiments-outline",
        type: "line",
        paint: {
          "line-color": categoricalFillColor("type", BATIMENT_PALETTE, BATIMENT_FALLBACK),
          "line-width": 0.8,
          "line-opacity": 0.9,
        },
      },
    ],
  },
];

export function layersForFamily(familyId: CartoFamilyId): CartoLayerDef[] {
  return CARTO_LAYERS.filter((l) => l.family === familyId);
}

export function standaloneCartoLayers(): CartoLayerDef[] {
  return CARTO_LAYERS.filter((l) => !l.family);
}

export function getCartoLayer(id: string): CartoLayerDef | undefined {
  return CARTO_LAYERS.find((l) => l.id === id);
}

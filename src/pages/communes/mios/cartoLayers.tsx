import type maplibregl from "maplibre-gl";

/**
 * Catalogue des couches carto Mios (config déclarative).
 * Ajouter une couche = ajouter une entrée dans CARTO_LAYERS.
 *
 * ⚠️ Tout attribut utilisé ci-dessous (couleur, label, filtre) DOIT être une colonne
 *    sélectionnée à la génération des tuiles (pmtiles_latresne.py). Sinon → regénérer.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const TILES_BASE = `${SUPABASE_URL}/storage/v1/object/public/pmtiles/mios`;

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

/** Couleur CNIG côté légende (clé = libelle en majuscules). */
export function cnigZonageColorForKey(rawKey: string): string {
  const code = rawKey.trim().toUpperCase();
  if (!code || code === "(NON RENSEIGNÉ)") return ZONAGE_FALLBACK;
  const p2 = code.slice(0, 2);
  const p3 = code.slice(0, 3);
  if (p2 === "AU" || p3 === "1AU" || p3 === "2AU") return ZONAGE_AU;
  if (code[0] === "N") return ZONAGE_NAT;
  if (code[0] === "A") return ZONAGE_AGRI;
  return ZONAGE_URBAN;
}

/**
 * Couleur zonage Mios (CNIG) : préfixe AU* → rouge clair, N* → vert, A* → jaune, reste → rouge.
 * S'appuie sur libelle puis typezone.
 */
export function miosZonageFillColor(): maplibregl.ExpressionSpecification {
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

export const PRESCRIPTION_FALLBACK = "#9D4EDD";
export const SERVITUDE_FALLBACK = "#457B9D";
export const INFOS_FALLBACK = "#2A9D8F";
export const BATIMENT_FALLBACK = "#F5480A";

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

export const INFOS_PALETTE = [
  "#2A9D8F",
  "#264653",
  "#1D7874",
  "#40916C",
  "#52B788",
  "#74C69D",
  "#95D5B2",
  "#168AAD",
  "#1A759F",
  "#184E77",
];

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

export type CartoSubLayer = Omit<maplibregl.LayerSpecification, "source" | "source-layer">;

export interface CartoLayerDef {
  id: string;
  title: string;
  defaultVisible: boolean;
  /** Absent ou vide = couche sans tuiles (ex. cadastre GeoJSON uniquement). */
  pmtilesUrl?: string;
  sourceLayer: string;
  tooltipField?: string;
  groupField?: string;
  filterPalette?: readonly string[];
  filterFallback?: string;
  groupColorMap?: Record<string, string>;
  /** Résolveur de couleur par clé de groupe (prioritaire sur filterPalette). */
  resolveGroupColor?: (key: string) => string;
  staticGroupLegend?: readonly { key: string; label: string; color: string }[];
  layers: CartoSubLayer[];
}

export const CARTO_LAYERS: CartoLayerDef[] = [
  {
    id: "zonage",
    title: "Zonage PLU",
    defaultVisible: true,
    pmtilesUrl: `${TILES_BASE}/zonage_plu.pmtiles`,
    sourceLayer: "zonage_plu",
    tooltipField: "libelle",
    groupField: "libelle",
    resolveGroupColor: cnigZonageColorForKey,
    filterFallback: ZONAGE_FALLBACK,
    layers: [
      {
        id: "mios-zonage-fill",
        type: "fill",
        paint: {
          "fill-color": miosZonageFillColor(),
          "fill-opacity": 0.5,
          "fill-antialias": true,
        },
      },
      {
        id: "mios-zonage-outline",
        type: "line",
        paint: {
          "line-color": "#5f6368",
          "line-width": 0.6,
          "line-opacity": 0.6,
        },
      },
    ],
  },
  {
    id: "parcelles",
    title: "Cadastre",
    defaultVisible: true,
    sourceLayer: "",
    layers: [],
  },
  {
    id: "prescriptions-surf",
    title: "Prescriptions surfaciques",
    defaultVisible: true,
    pmtilesUrl: `${TILES_BASE}/prescriptions_surf.pmtiles`,
    sourceLayer: "prescriptions_surf",
    tooltipField: "libelle",
    groupField: "libelle",
    filterPalette: PRESCRIPTION_PALETTE,
    filterFallback: PRESCRIPTION_FALLBACK,
    layers: [
      {
        id: "mios-prescriptions-surf-fill",
        type: "fill",
        paint: {
          "fill-color": categoricalFillColor("libelle", PRESCRIPTION_PALETTE, PRESCRIPTION_FALLBACK),
          "fill-opacity": 0.4,
          "fill-antialias": true,
        },
      },
      {
        id: "mios-prescriptions-surf-outline",
        type: "line",
        paint: {
          "line-color": categoricalFillColor("libelle", PRESCRIPTION_PALETTE, PRESCRIPTION_FALLBACK),
          "line-width": 1,
          "line-opacity": 0.85,
        },
      },
      {
        id: "mios-prescriptions-surf-labels",
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
    id: "servitudes",
    title: "Servitudes (assiettes)",
    defaultVisible: true,
    pmtilesUrl: `${TILES_BASE}/sup_assiette_s.pmtiles`,
    sourceLayer: "sup_assiette_s",
    tooltipField: "suptype",
    groupField: "suptype",
    filterPalette: SERVITUDE_PALETTE,
    filterFallback: SERVITUDE_FALLBACK,
    layers: [
      {
        id: "mios-servitudes-fill",
        type: "fill",
        paint: {
          "fill-color": categoricalFillColor("suptype", SERVITUDE_PALETTE, SERVITUDE_FALLBACK),
          "fill-opacity": 0.35,
          "fill-antialias": true,
        },
      },
      {
        id: "mios-servitudes-outline",
        type: "line",
        paint: {
          "line-color": categoricalFillColor("suptype", SERVITUDE_PALETTE, SERVITUDE_FALLBACK),
          "line-width": 1.2,
          "line-dasharray": [2, 1],
          "line-opacity": 0.9,
        },
      },
      {
        id: "mios-servitudes-labels",
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
    id: "infos-surf",
    title: "Informations surfaciques",
    defaultVisible: true,
    pmtilesUrl: `${TILES_BASE}/infos_surf.pmtiles`,
    sourceLayer: "infos_surf",
    tooltipField: "libelle",
    groupField: "libelle",
    filterPalette: INFOS_PALETTE,
    filterFallback: INFOS_FALLBACK,
    layers: [
      {
        id: "mios-infos-surf-fill",
        type: "fill",
        paint: {
          "fill-color": categoricalFillColor("libelle", INFOS_PALETTE, INFOS_FALLBACK),
          "fill-opacity": 0.35,
          "fill-antialias": true,
        },
      },
      {
        id: "mios-infos-surf-outline",
        type: "line",
        paint: {
          "line-color": categoricalFillColor("libelle", INFOS_PALETTE, INFOS_FALLBACK),
          "line-width": 1,
          "line-opacity": 0.85,
        },
      },
      {
        id: "mios-infos-surf-labels",
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
          "text-color": "#1b4332",
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
    pmtilesUrl: `${TILES_BASE}/batiments_mios.pmtiles`,
    sourceLayer: "batiments_mios",
    tooltipField: "type",
    groupField: "type",
    filterPalette: BATIMENT_PALETTE,
    filterFallback: BATIMENT_FALLBACK,
    layers: [
      {
        id: "mios-batiments-fill",
        type: "fill",
        paint: {
          "fill-color": categoricalFillColor("type", BATIMENT_PALETTE, BATIMENT_FALLBACK),
          "fill-opacity": 0.55,
          "fill-antialias": true,
        },
      },
      {
        id: "mios-batiments-outline",
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

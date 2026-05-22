export const PARCELLE_OUTLINE = "#FFD600";
export const PARCELLE_FILL = "rgba(255, 214, 0, 0.12)";
export const PARCELLE_UNION_FILL = "rgba(255, 214, 0, 0.05)";
export const PARCELLE_LABEL_COLOR = "#FFD600";
export const MAP_BUFFER_M = 100;
export const ZONE_FILL_OPACITY = 0.48;

export const PRESCRIPTION_SURF_COLOR = "#9D4EDD";
export const PRESCRIPTION_LINE_COLOR = "#E63946";
export const PRESCRIPTION_POINT_COLOR = "#FFBE0B";
export const PRESCRIPTION_SURF_OPACITY = 0.4;

export const SERVITUDES_COLOR = "#457B9D";
export const SERVITUDES_FILL_OPACITY = 0.35;

export const INFO_SURF_COLOR = "#2A9D8F";
export const INFO_LINE_COLOR = "#1D3557";
export const INFO_POINT_COLOR = "#F4A261";
export const INFO_SURF_OPACITY = 0.38;

/** Teinte de base par famille de couche pour dériver une couleur par groupe. */
export const GROUP_HUE = {
  servitudes: 205,
  prescriptions: 275,
  informations: 165,
} as const;

/**
 * Style commun fill + contour pour les polygones carto.
 * Même teinte : aplat semi-transparent + contour plus marqué pour situer les entités.
 * (Pas de données supplémentaires — sous-couches line déjà dans les PMTiles.)
 */

/** Opacité des aplats surfaciques. */
export const CARTO_FILL_OPACITY = 0.38;

/** Contour : même couleur que le fill, plus opaque pour délimiter les entités. */
export const CARTO_OUTLINE_OPACITY = 0.92;

export const CARTO_OUTLINE_WIDTH = 1;

export const CARTO_OUTLINE_WIDTH_EMPHASIS = 1.2;

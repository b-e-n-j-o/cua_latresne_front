export const KERELIA_LOGO_SRC = "/logo_kerelia_noir.png";

/** Photo Bordeaux Métropole — fond hero (mélangée aux dégradés dans `kereliaLandingPage.css`). */
export const HERO_BACKGROUND_IMAGE_SRC = "/bg-bdx-mtropole.png";

const baseUrl = import.meta.env.BASE_URL || "/";

/** Boucles vidéo panneaux « Nos domaines » (M30, M36, M42, M48) — déposer les fichiers dans `public/videos/nos-domaines/`. */
export const NOS_DOMAINES_PANEL_VIDEOS = {
  urbanisme: `${baseUrl}videos/nos-domaines/panel-1-cua.mp4`,
  compensationFoncier: `${baseUrl}videos/nos-domaines/panel-2-carto-dreal.mp4`,
  bancarisationErc: `${baseUrl}videos/nos-domaines/panel-3-erc-dashboard.mp4`,
  preEtudes: `${baseUrl}videos/nos-domaines/panel-4-rapport-apercu.mp4`,
} as const;

/** `public/svgs/france.svg` — `mapsvg:geoViewBox` = ouest, nord, est, sud (WGS84). */
export const FRANCE_OUTLINE_SVG_SRC = "/svgs/france.svg";

/**
 * Position du point Bordeaux sur la carte (coordonnées ~ -0.5792°, 44.8378°),
 * projetée dans le repère du fichier SVG (596.41547 × 584.5448).
 */
export const BORDEAUX_FRANCE_MAP_PIN = { leftPct: 29, topPct: 64.0 } as const;

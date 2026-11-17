/** Base URL Vite + dossier `public/logos-banniere` (ASCII, fiable en prod). */
const baseUrl = import.meta.env.BASE_URL || "/";
export const partnerLogosBasePath = `${baseUrl.replace(/\/*$/, "")}/logos-banniere`;

export type PartnerBannerLogo = {
  file: string;
  alt: string;
};

export const partnerBannerLogos: readonly PartnerBannerLogo[] = [
  { file: "ARS.png", alt: "Agence régionale de santé" },
  { file: "Airbus_Defence_Space.png", alt: "Airbus Defence and Space" },
  { file: "BRGM.png", alt: "BRGM" },
  { file: "CNES.png", alt: "CNES" },
  { file: "Copernicus.png", alt: "Copernicus" },
  { file: "EauFrance.png", alt: "Eau France" },
  { file: "HubEau.png", alt: "Hub'Eau" },
  { file: "IGN.png", alt: "IGN" },
  { file: "INPN.png", alt: "INPN" },
  { file: "INRAE.png", alt: "INRAE" },
  { file: "Meteo_France.png", alt: "Météo-France" },
  { file: "OFB.png", alt: "Office français de la biodiversité" },
] satisfies readonly PartnerBannerLogo[];

/** Profils UI veille RAA — alignés sur api/raa/raa_config.py côté backend. */

export type RaaCommuneSlug = "argeles" | "latresne";

export type RaaCommuneConfig = {
  slug: RaaCommuneSlug;
  communeLabel: string;
  departementLabel: string;
  /** Libellé court pour les badges (ex. « Argelès citée ») */
  communeShort: string;
  /** Libellé niveau ROUGE (ex. « Concerne Argelès ») */
  niveauRougeLabel: string;
};

export const RAA_COMMUNES: Record<RaaCommuneSlug, RaaCommuneConfig> = {
  argeles: {
    slug: "argeles",
    communeLabel: "Argelès-sur-Mer",
    departementLabel: "Pyrénées-Orientales",
    communeShort: "Argelès",
    niveauRougeLabel: "Concerne Argelès",
  },
  latresne: {
    slug: "latresne",
    communeLabel: "Latresne",
    departementLabel: "Gironde",
    communeShort: "Latresne",
    niveauRougeLabel: "Concerne Latresne",
  },
};

export function isRaaCommuneSlug(value: string | undefined): value is RaaCommuneSlug {
  return Boolean(value && value in RAA_COMMUNES);
}

export function getRaaConfig(slug: string | undefined): RaaCommuneConfig | null {
  if (!isRaaCommuneSlug(slug)) return null;
  return RAA_COMMUNES[slug];
}

/** Nature thématique d'un arrêté (clé JSON `nature` dans raa_analyse.arretes). */
export type ArreteNature = "URBANISME" | "ENVIRONNEMENT" | "EVENEMENT" | "AUTRE";

export const ARRETE_NATURE_LABELS: Record<ArreteNature, string> = {
  URBANISME: "Urbanisme",
  ENVIRONNEMENT: "Environnement",
  EVENEMENT: "Événement",
  AUTRE: "Autre",
};

export function normaliseArreteNature(value?: string | null): ArreteNature {
  const v = (value || "").trim().toUpperCase();
  if (v === "EVENNEMENT") return "EVENEMENT";
  if (v in ARRETE_NATURE_LABELS) return v as ArreteNature;
  return "AUTRE";
}

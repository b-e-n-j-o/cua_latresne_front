export type AboutPillarCopy = {
  label: string;
  desc: string;
};

export type AboutCopy = {
  title: readonly string[];
  tagline: string;
  pillars: readonly AboutPillarCopy[];
  partners: string;
  /** Alt de la carte animée (première frame). */
  mapAlt: string;
};

export const aboutCopy = {
  title: [
    "Qui sommes-nous.",
  ] as const,
  tagline: "Fondée en 2025 · Bordeaux · Incubée à Technowest · Couverture nationale",
  pillars: [] satisfies readonly AboutPillarCopy[],
  partners: "Co-développements avec SIMETHIS et Eco-Compensation · Incubée à Technowest (Bordeaux Métropole)",
  mapAlt: "Expansion Kerelia — de la Nouvelle-Aquitaine à la couverture nationale",
} satisfies AboutCopy;

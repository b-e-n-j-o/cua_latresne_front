export type HeroCopy = {
  headlineLines: readonly string[];
  sub: string;
  metaBl: readonly string[];
};

export const heroCopy = {
  headlineLines: ["Édition de logiciels d'intelligence géospatiale."] as const,
  sub:
    "Kerelia produit des outils intelligents d'analyses réglementaires, environnementales et foncières à partir de données publiques et propriétaires.",
  metaBl: ["BORDEAUX 44.836° N 0.578° W", "INCUBÉE A TECHNOWEST"] as const,
} satisfies HeroCopy;

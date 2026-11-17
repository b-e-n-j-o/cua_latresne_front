export type LandingPageMeta = {
  documentTitle: string;
  heroScreenLabel: string;
  sourcesScreenLabel: string;
  methodologyScreenLabel: string;
  metricsScreenLabel: string;
  aboutScreenLabel: string;
  contactScreenLabel: string;
  footerScreenLabel: string;
};

export const landingPageMeta = {
  documentTitle: "Kerelia — Cabinet d'expertise géospatiale",
  heroScreenLabel: "01 Hero",
  sourcesScreenLabel: "02 Sources & Partenariats",
  methodologyScreenLabel: "05 Souveraineté & Conformité",
  metricsScreenLabel: "07 Chiffres & Témoignages",
  aboutScreenLabel: "06 Qui sommes-nous",
  contactScreenLabel: "07 Contact",
  footerScreenLabel: "08 Footer",
} satisfies LandingPageMeta;

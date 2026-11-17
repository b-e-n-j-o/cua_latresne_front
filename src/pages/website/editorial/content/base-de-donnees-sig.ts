import type { EditorialPageContent } from "../types";

export const baseDonneesSigPage = {
  sectionLabel: "Outils / Data SIG",
  blocks: [
    {
      type: "hero",
      kicker: "EN COURS DE CONSTRUCTION",
      title: "Base de données SIG",
      subtitle: "Infrastructure PostGIS centralisée. Intégration des référentiels IGN, cadastre, PLU, DVF, RPGSIG. Accès API standardisé pour vos outils métier.",
    },
    {
      type: "cta",
      label: "Nous contacter →",
      href: "/#contact",
    },
  ],
} satisfies EditorialPageContent;

import type { EditorialPageContent } from "../types";

export const etudesEnvironnementalesPage = {
  sectionLabel: "Environnement",
  blocks: [
    {
      type: "hero",
      kicker: "EN COURS DE CONSTRUCTION",
      title: "Études environnementales automatisées",
      subtitle: "Pré-études foncières, analyse hydrologique des bassins versants, cartographie des contraintes environnementales. Rapports générés automatiquement à partir des données IGN et CEREMA.",
    },
    {
      type: "cta",
      label: "Nous contacter →",
      href: "/#contact",
    },
  ],
} satisfies EditorialPageContent;

import type { EditorialPageContent } from "../types";

export const veilleReglementairePage = {
  sectionLabel: "Urbanisme",
  blocks: [
    {
      type: "hero",
      kicker: "EN COURS DE CONSTRUCTION",
      title: "Veille réglementaire",
      subtitle: "Surveillance automatisée des publications RAA et JORF. Détection des modifications de documents d\'urbanisme impactant vos zones d\'intérêt, avec alertes Slack.",
    },
    {
      type: "cta",
      label: "Nous contacter →",
      href: "/#contact",
    },
  ],
} satisfies EditorialPageContent;

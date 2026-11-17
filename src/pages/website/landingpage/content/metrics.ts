export type MetricItem = { value: string; label: string };
export type Testimonial = { quote: string };

export type MetricsCopy = {
  title: string;
  metrics: readonly MetricItem[];
  testimonials: readonly Testimonial[];
};

export const metricsCopy = {
  title: "En chiffres.",
  metrics: [
    { value: "1 min", label: "Génération d\u2019un certificat d\u2019urbanisme analytique complet" },
    { value: "15 min", label: "Pré-étude environnementale complète (vs. plusieurs jours)" },
    { value: "\u221230\u00a0%", label: "Temps d\u2019instruction économisé pour les services municipaux" },
    { value: "24/7", label: "Veille réglementaire automatisée (JO, actes administratifs)" },
  ] as const,
  testimonials: [
    {
      quote: "Depuis que nous utilisons les CUa de Kerelia, nos instructeurs gagnent un temps considérable. Les cartes intégrées leur évitent des déplacements et les contraintes sont clairement expliquées.",
    },
    {
      quote: "L\u2019outil de recherche foncière nous a permis d\u2019identifier en quelques jours des parcelles que nous aurions mis des semaines à trouver manuellement. La qualité du scoring est remarquable.",
    },
    {
      quote: "Les pré-études environnementales nous donnent un go/no go fiable en 15 minutes. On sait immédiatement si un terrain vaut la peine d\u2019être approfondi avant d\u2019engager des frais de VNEI.",
    },
  ] as const,
} satisfies MetricsCopy;

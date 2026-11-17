import type { DomaineInterventionCardModel } from "../components/KereliaUi";

export type DomainesInterventionCopy = {
  title: string;
  cards: readonly DomaineInterventionCardModel[];
};

/** Section 04 — cinq domaines d'intervention (cartes dépliables, fond sombre). */
export const domainesInterventionCopy = {
  title: "En détail",
  cards: [
    {
      tag: "URBANISME RÉGLEMENTAIRE",
      title: "Documents d'urbanisme et veille réglementaire",
      bullets: [
        "Génération automatisée de Certificats d'Urbanisme analytiques (CUa) avec analyse exhaustive des servitudes, zonages PLU/PLUi, contraintes paysagères et environnementales. Solution déployée pour la commune de Latresne.",
        "Cartes d'Identité Foncières équivalentes aux CUa sur le plan documentaire, sans portée juridique, pour études de faisabilité.",
        "Cartographie réglementaire 2D superposée, intégrée aux CUa et disponible sur abonnement avec les CIF.",
        "Analyse de nuages de points LiDAR et modèles topographiques 3D intégrés aux livrables, pour caractérisation du relief, des pentes et des contraintes physiques.",
        "Veille réglementaire automatisée sur Journal Officiel et recueils des actes administratifs préfectoraux et communaux. Pipeline quotidien, restitution sous forme de newsletter classée par pertinence.",
        "Cartographies pour mise à jour des PLU et PLUi à la demande.",
      ],
    },
    {
      tag: "ÉTUDES ENVIRONNEMENTALES",
      title: "Pré-études et compensation écologique",
      bullets: [
        "Pré-études préalables à l'acquisition foncière : inventaires faune-flore, caractérisation des habitats, analyse hydrologique et bassins versants (dimensionnement préliminaire des ouvrages de rétention, évaluation du ruissellement), contexte géologique et hydrogéologique, recensement des sources potentielles de pollution.",
        "Estimation préliminaire des coûts associés aux mesures de mise en conformité environnementale.",
        "Recherche foncière pour compensation écologique en partenariat avec SIMETHIS et Eco Compensation. Identification de parcelles compatibles avec les prescriptions DREAL et des critères écologiuqes en matière de compensation. Le suivi terrain et la maîtrise d'œuvre écologique sont assurés par les partenaires.",
        "Suivi temporel par analyse d'imagerie satellitaire pour le contrôle des engagements environnementaux.",
      ],
    },
    {
      tag: "OUTILS SIG SUR MESURE",
      title: "Bancarisation et supervision ERC",
      bullets: [
        "Plateforme de bancarisation et de suivi technique et financier des engagements ERC (Évitement, Réduction, Compensation) pour promoteurs et aménageurs. Intégration des prestataires, suivi des plannings, état d'avancement des mesures, traçabilité documentaire.",
        "Module de supervision à destination des services DREAL pour le suivi consolidé des dossiers ERC dans le temps. En cours de développement.",
        "API géospatiales pour intégration des flux Kerelia dans les systèmes d'information existants.",
      ],
    },
    {
      tag: "IA & DONNÉES GÉOSPATIALES",
      title: "Pipelines, modèles et croisement",
      bullets: [
        "Pipelines de traitement de données géospatiales hétérogènes : extraction, nettoyage, croisement, géo-référencement.",
        "Fine-tuning de modèles de vision par ordinateur pour interprétation de documents cartographiques et analyse de textes réglementaires géoréférencés.",
        "Croisement multi-sources de référentiels publics et privés.",
        "Développements sur mesure pour cas d'usage spécifiques.",
      ],
    },
    {
      tag: "CONSEIL & EXPERTISE",
      title: "Audits, accompagnement et formation",
      wide: true,
      bullets: [
        "Audits ponctuels de sites et de dossiers : vérification de conformité, second avis sur des contraintes complexes, analyse de risques avant acquisition.",
        "Accompagnement méthodologique des bureaux d'études et collectivités sur des problématiques de croisement de données géospatiales.",
        "Formation aux outils Kerelia pour les équipes internes des clients abonnés.",
      ],
    },
  ] satisfies DomainesInterventionCopy["cards"],
} satisfies DomainesInterventionCopy;

import type { ExpertiseCardModel } from "./components/KereliaUi";

export const heroCopy = {
  headlineLines: ["La donnée territoriale", "pour guider vos projets."] as const,
  sub:
    "Kerelia transforme la donnée brute en levier opérationnel. Comprenez les contraintes d'un terrain, anticipez les enjeux environnementaux et pilotez vos projets avec des outils sur mesure.",
  metaBl: ["BORDEAUX 44.836 N 0.578 W", "INCUBEE A TECHNOWEST"] as const,
} as const;

export const statsCopy = [
  {
    label: "COUVERTURE",
    num: "12",
    desc: "Départements de Nouvelle-Aquitaine",
    numVariant: "default" as const,
  },
  {
    label: "RÉFÉRENTIELS",
    num: "20+",
    desc: "Sources publiques et privées intégrées",
    numVariant: "yellow" as const,
  },
  {
    label: "STATUT",
    num: "2025",
    desc: "Année de fondation — Technowest Bordeaux",
    numVariant: "default" as const,
  },
] as const;

export const expertiseCopy = {
  title: "Cinq domaines d'intervention, un même socle technique.",
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
  ] satisfies ExpertiseCardModel[],
};

export const methodologyCopy = {
  title: "Sources primaires et traçabilité documentaire.",
  steps: [
    {
      num: "01",
      title: "Cadrage",
      desc: "Définition du périmètre, identification des sources réglementaires et techniques pertinentes pour le dossier.",
    },
    {
      num: "02",
      title: "Sourcing primaire",
      desc: "Extraction depuis les référentiels officiels (IGN, BRGM, INPN, Cadastre, Géoportail de l'Urbanisme, Pléiades, Copernicus, SANDRE, ARS, INRAE, observatoires régionaux).",
    },
    {
      num: "03",
      title: "Croisement & analyse",
      desc: "Géo-référencement, superposition multi-couches, détection d'incohérences, génération de livrables techniques.",
    },
    {
      num: "04",
      title: "Validation",
      desc: "Conformité réglementaire vérifiée, croisement avec les prescriptions DREAL et les arrêtés préfectoraux applicables.",
    },
    {
      num: "05",
      title: "Livrable horodaté",
      desc: "Documents PDF, cartographies 2D/3D, exports SIG, données structurées. Traçabilité complète des sources et des dates de millésime.",
    },
  ] as const,
};

/** Base URL Vite + dossier `public/logos-banniere` (ASCII, fiable en prod). */
const baseUrl = import.meta.env.BASE_URL || "/";
export const partnerLogosBasePath = `${baseUrl.replace(/\/*$/, "")}/logos-banniere`;

export type PartnerBannerLogo = {
  readonly file: string;
  readonly alt: string;
};

/**
 * Logos du bandeau — chaque `file` doit exister dans `public/logos-banniere/`
 * (sinon 404 et pastille de secours côté UI).
 */
export const partnerBannerLogos: readonly PartnerBannerLogo[] = [
  { file: "ADEME.png", alt: "ADEME" },
  { file: "ARS.png", alt: "Agence régionale de santé" },
  { file: "Airbus_Defence_Space.png", alt: "Airbus Defence and Space" },
  { file: "BNPE.jpg", alt: "Banque nationale des procédures environnementales" },
  { file: "BRGM.png", alt: "BRGM" },
  { file: "CEREMA.png", alt: "Cerema" },
  { file: "CNES.png", alt: "CNES" },
  { file: "Copernicus.png", alt: "Copernicus" },
  { file: "Data_Gouv.jpg", alt: "data.gouv.fr" },
  { file: "EauFrance.png", alt: "Eau France" },
  { file: "fauna.png", alt: "Faune France" },
  { file: "Geoportail_Urbanisme.png", alt: "Géoportail de l'urbanisme" },
  { file: "Georisques.png", alt: "Géorisques" },
  { file: "HubEau.png", alt: "Hub'Eau" },
  { file: "IGN.png", alt: "IGN" },
  { file: "INPN.png", alt: "INPN" },
  { file: "INRAE.png", alt: "INRAE" },
  { file: "Meteo_France.png", alt: "Météo-France" },
  { file: "OFB.jpg", alt: "Office français de la biodiversité" },
  { file: "Sandre.png", alt: "Sandre" },
  { file: "Tela_Botanica.png", alt: "Tela Botanica" },
] as const;

export type EtudeTopoClass = "topo-1" | "topo-2" | "topo-3";

export type EtudeCardCopy = {
  topoClass: EtudeTopoClass;
  pill: string;
  title: string;
  desc: string;
  date: string;
};

export const etudesCopy: EtudeCardCopy[] = [
  {
    topoClass: "topo-1",
    pill: "URBANISME",
    title: "Certificat d'urbanisme et Carte d'Identité Foncière",
    desc: "Génération automatisée de Certificats d'Urbanisme analytiques (CUa) avec analyse exhaustive des servitudes, zonages PLU/PLUi, contraintes réglementaires et environnementales locales.",
    date: "EN PRODUCTION — 2025",
  },
  {
    topoClass: "topo-2",
    pill: "COMPENSATION ÉCOLOGIQUE & ENVIRONNEMENT",
    title: "Recherche et étude écologique de foncier pour compensation écologique",
    desc: "Identification de parcelles compatibles avec les prescriptions DREAL pour des projets d'aménagement en Nouvelle-Aquitaine. Travail conduit en partenariat avec SIMETHIS et Eco Compensation.",
    date: "EN COURS — 2025",
  },
  {
    topoClass: "topo-3",
    pill: "OUTILS SIG SUR MESURE",
    title: "Plateforme de bancarisation de projets de compensation ERC",
    desc: "Développement d'une plateforme de suivi technique et financier des engagements ERC. Intégration des prestataires, plannings, traçabilité documentaire.",
    date: "EN DÉVELOPPEMENT — 2025-2026",
  },
];

export const aboutCopy = {
  title: "Cabinet d'expertise géospatiale ancré en Nouvelle-Aquitaine.",
  body:
    "Kerelia est une SAS fondée en 2025, incubée à Technowest Bordeaux. L'activité couvre l'urbanisme réglementaire, les études environnementales préalables et le développement de logiciels métier pour la gestion des engagements ERC. La rigueur sur les sources primaires, la traçabilité documentaire et la conformité aux prescriptions DREAL Nouvelle-Aquitaine constituent le socle méthodologique. Les développements logiciels et les modèles d'IA sont conçus en interne, avec une attention particulière à l'intégration dans les workflows existants des collectivités, bureaux d'études et aménageurs.",
} as const;

export type TeamMemberCopy = {
  readonly name: string;
  readonly title: string;
  readonly image: string;
  readonly email: string;
  readonly linkedin: string;
  readonly description: string;
};

export const teamCopy = {
  title: "Notre équipe",
  sub: "Nous construisons Kerelia avec passion pour les territoires.",
  members: [
    {
      name: "Christophe Collantier",
      title: "Fondateur & Président",
      image: "/christophe.png",
      email: "christophe.collantier@kerelia.fr",
      linkedin: "https://www.linkedin.com/in/christophe-collantier-b4290695/",
      description:
        "Président de Kerelia — expertise réglementaire & pilotage des collectivités, au cœur des besoins terrain.",
    },
    {
      name: "Benjamin Benoit",
      title: "CTO - IA / Cartographie",
      image: "/benjamin.png",
      email: "benjamin.b@kerelia.fr",
      linkedin: "https://www.linkedin.com/in/benjamin-benoit-ai-ml/",
      description:
        "Ingénieur Data SIG Full Stack — Développement d'outils SIG d'analyses règlementaires et environnementales sur mesures.",
    },
  ] satisfies readonly TeamMemberCopy[],
} as const;

export const contactCopy = {
  titleBeforeEm: "Discutons de votre ",
  titleEm: "projet",
  titleAfterEm: ".",
  sub: "Réponse sous 48 heures ouvrées.",
  primaryCta: "Demander un devis →",
  email: "contact@kerelia.fr",
} as const;

export const footerCopy = {
  title: "De la donnée à vos décisions projet.",
  primaryCta: "Demander un devis →",
  nav: [
    { href: "#expertise", label: "Expertises" },
    { href: "#etudes", label: "Études" },
    { href: "#apropos", label: "À propos" },
    { href: "/login", label: "Mon Espace Pro" },
  ] as const,
  linkedinLabel: "LINKEDIN",
  linkedinHref: "https://www.linkedin.com/company/kerelia",
} as const;

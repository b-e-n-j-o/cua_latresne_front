import type { DomaineInterventionCardModel } from "./components/KereliaUi";
import { NOS_DOMAINES_PANEL_VIDEOS } from "./lib/constants";

/** CTA principal hero + bouton flottant (section 2+) — demande de démo / contact. */
export const demoContactCtaCopy = {
  label: "Nous contacter →",
  href: "/demo",
} as const;

export const heroCopy = {
  headlineLines: ["Bureau d'études en données géospatiales."] as const,
  sub:
    "Kerelia produit des analyses réglementaires, environnementales et foncières à partir de référentiels publics et propriétaires.",
  metaBl: ["BORDEAUX 44.836° N 0.578° W", "INCUBÉE A TECHNOWEST"] as const,
} as const;

export const sourcesPartnershipsCopy = {
  title: "Sources & partenariats",
  intro:
    "Kerelia produit ses analyses à partir des référentiels publics et privés faisant autorité. Nous travaillons sans intermédiaire avec les sources de l'État, des établissements publics et des organismes scientifiques.",
  institutionalHeading: "Références institutionnelles",
  operationalHeading: "Partenariats opérationnels",
  partnerships: [
    {
      name: "SIMETHIS et Eco-Compensation",
      body:
        "Co-conception du logiciel de bancarisation et de suivi des mesures ERC. SIMETHIS apporte vingt ans de pratique de terrain en écologie réglementaire ; Kerelia, l'ingénierie de données et le développement logiciel.",
    },
    {
      name: "Technowest",
      body:
        "Incubateur technologique de Bordeaux Métropole. Kerelia est incubée à Technowest depuis 2025.",
    },
  ],
} as const;

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
  ] satisfies DomaineInterventionCardModel[],
};

export const methodologyCopy = {
  title: "Nos engagements.",
  intro: "Kerelia garantit un traitement 100\u00a0% souverain de vos données. Hébergement français, intelligence artificielle française, référentiels publics français. Chaque analyse est traçable de la source au livrable.",
  steps: [
    {
      num: "01",
      title: "Souveraineté",
      desc: "Hébergement OVH, intelligence artificielle Mistral. Vos données ne transitent pas hors du territoire national.",
    },
    {
      num: "02",
      title: "Traçabilité",
      desc: "Chaque analyse est horodatée et sourcée. Notre architecture permet de retracer l\u2019origine, le traitement et la destination de chaque donnée. Référentiels français : IGN, BRGM, INPN, Pléiades, Cadastre\u2026",
    },
    {
      num: "03",
      title: "Conformité",
      desc: "Traitement conforme au RGPD. Registre des traitements tenu \u00e0 jour. Droit d\u2019acc\u00e8s, de rectification et de suppression garanti.",
    },
    {
      num: "04",
      title: "Identité",
      desc: "Authentification des professionnels (notaires, demandeurs de CU) via FranceConnect et ProConnect. Interopérabilité native avec l\u2019écosystème d\u2019identité numérique de l\u2019État.",
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
  { file: "ARS.png", alt: "Agence régionale de santé" },
  { file: "Airbus_Defence_Space.png", alt: "Airbus Defence and Space" },
  { file: "BRGM.png", alt: "BRGM" },
  { file: "CNES.png", alt: "CNES" },
  { file: "Copernicus.png", alt: "Copernicus" },
  { file: "EauFrance.png", alt: "Eau France" },
  { file: "HubEau.png", alt: "Hub'Eau" },
  { file: "IGN.png", alt: "IGN" },
  { file: "INPN.png", alt: "INPN" },
  { file: "INRAE.png", alt: "INRAE" },
  { file: "Meteo_France.png", alt: "Météo-France" },
  { file: "OFB.png", alt: "Office français de la biodiversité" },
] as const;

export type EtudeTopoClass = "topo-1" | "topo-2" | "topo-3" | "topo-4";

/** Libellés courts — indicateur de progression (M53 / M58). */
export const nosDomainesPinLabels = [
  "Urbanisme réglementaire",
  "Compensation écologique",
  "Bancarisation ERC",
  "Pré-études environnementales",
] as const;

export const nosDomainesSectionMeta = {
  id: "etudes",
  screenLabel: "03 Nos domaines",
  skipLabel: "Passer →",
  /** Section C — « En détail » (domaines d'intervention). */
  skipTargetId: "domaines-intervention",
} as const;

export type NosDomainePanelModel = {
  topoClass: EtudeTopoClass;
  pill: string;
  title: string;
  desc: string;
  videoSrc: string;
  ctaLabel: string;
  ctaHref: string;
};

/** Section 03 — Nos domaines (4 panneaux, M58). */
export const etudesSectionCopy = {
  title: "Nos domaines.",
  cards: [
    {
      topoClass: "topo-1",
      pill: "URBANISME RÉGLEMENTAIRE",
      title: "Certificat d'urbanisme analytique (CUa) et Carte d'identité foncière (CIF)",
      desc: "Production automatisée des CUa officiels pour les communes. Livraison au format Word pour relecture interne, ou signature et horodatage automatiques selon le mode retenu par la commune.",
      videoSrc: NOS_DOMAINES_PANEL_VIDEOS.urbanisme,
      ctaLabel: "En savoir plus →",
      ctaHref: "/urbanisme/certificats-durbanisme",
    },
    {
      topoClass: "topo-2",
      pill: "COMPENSATION ÉCOLOGIQUE",
      title: "Recherche et animation foncière pour la compensation écologique",
      desc: "Identification de parcelles compatibles avec les prescriptions DREAL, mise en relation avec les propriétaires fonciers et montage des dossiers de sécurisation foncière. Outil ouvert de gestion de base de données foncières.",
      videoSrc: NOS_DOMAINES_PANEL_VIDEOS.compensationFoncier,
      ctaLabel: "En savoir plus →",
      ctaHref: "/environnement/scoring-compensation-ecologique",
    },
    {
      topoClass: "topo-3",
      pill: "BANCARISATION ERC",
      title: "Bancarisation et suivi des mesures ERC",
      desc: "Logiciel de bancarisation et de pilotage des mesures compensatoires : suivi technique, financier et documentaire des engagements ERC sur toute la durée des atteintes. Destiné aux bureaux d'études, opérateurs de compensation et services instructeurs de l'État.",
      videoSrc: NOS_DOMAINES_PANEL_VIDEOS.bancarisationErc,
      ctaLabel: "En savoir plus →",
      ctaHref: "/environnement/bancarisation-suivi-erc",
    },
    {
      topoClass: "topo-4",
      pill: "ENVIRONNEMENT",
      title: "Pré-études environnementales automatisées",
      desc: "Pré-rapport environnemental généré à partir des références cadastrales : zonages réglementaires, hydrologie, hydrogéologie, biodiversité connue, structure de la canopée, évolution historique du site. Destiné aux aménageurs, promoteurs et bureaux d'études pour cadrer les enjeux d'un site en amont d'une VNEI.",
      videoSrc: NOS_DOMAINES_PANEL_VIDEOS.preEtudes,
      ctaLabel: "Voir un rapport exemple →",
      ctaHref: "/environnement/etudes-environnementales",
    },
  ] satisfies readonly NosDomainePanelModel[],
} as const;

export type AboutPillarCopy = {
  readonly label: string;
  readonly desc: string;
};

export const aboutCopy = {
  title: [
    "Qui sommes-nous.",
  ] as const,
  tagline: "Fondée en 2025 · Bordeaux · Incubée à Technowest · Couverture nationale",
  pillars: [] satisfies readonly AboutPillarCopy[],
  partners: "Co-développements avec SIMETHIS et Eco-Compensation · Incubée à Technowest (Bordeaux Métropole)",
} as const;

/** Section Chiffres & Témoignages */
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
      name: "Marie Dupont",
      title: "Directrice Générale des Services",
      org: "Commune de [à compléter]",
    },
    {
      quote: "L\u2019outil de recherche foncière nous a permis d\u2019identifier en quelques jours des parcelles que nous aurions mis des semaines à trouver manuellement. La qualité du scoring est remarquable.",
      name: "Pierre Martin",
      title: "Directeur technique",
      org: "SIMETHIS",
    },
    {
      quote: "Les pré-études environnementales nous donnent un go/no go fiable en 15 minutes. On sait immédiatement si un terrain vaut la peine d\u2019être approfondi avant d\u2019engager des frais de VNEI.",
      name: "Sophie Laurent",
      title: "Responsable foncier",
      org: "[Aménageur à compléter]",
    },
  ] as const,
} as const;

export type TeamMemberCopy = {
  readonly name: string;
  readonly title: string;
  readonly image: string;
  readonly email: string;
  readonly linkedin: string;
  readonly quote: string;
  readonly description: string;
};

export const teamCopy = {
  title: "Notre équipe",
  members: [
    {
      name: "Christophe Collantier",
      title: "Fondateur",
      image: "/christophe.png",
      email: "christophe.collantier@kerelia.fr",
      linkedin: "https://www.linkedin.com/in/christophe-collantier-b4290695/",
      quote: "Quinze ans à naviguer dans les procédures d\u2019urbanisme m\u2019ont appris exactement où le système coince. Kerelia est née de la volonté de résoudre ces blocages par la donnée.",
      description:
        "Fondateur de Kerelia. Pilote les sujets réglementaires et la relation avec les collectivités et les services de l\u2019État.",
    },
    {
      name: "Benjamin Benoit",
      title: "CTO - Data SIG / IA",
      image: "/benjamin.png",
      email: "benjamin.b@kerelia.fr",
      linkedin: "https://www.linkedin.com/in/benjamin-benoit-ai-ml/",
      quote: "Faire fusionner l\u2019analyse de données et la géomatique pour produire des résultats concrets au service de l\u2019environnement.",
      description:
        "Ingénieur Data SIG. Conception des pipelines géospatiaux, croisement multi-sources et génération automatisée de rapports.",
    },
  ] satisfies readonly TeamMemberCopy[],
} as const;

export const contactCopy = {
  titleBeforeEm: "Discutons de votre ",
  titleEm: "projet",
  titleAfterEm: ".",
  primaryCta: "Nous contacter →",
  primaryCtaHref: "/demo",
  email: "contact@kerelia.fr",
} as const;

export const footerCopy = {
  title: "De la donnée à vos décisions projet.",
  primaryCta: "Demander un devis →",
  nav: [
    { href: "#domaines-intervention", label: "Expertises" },
    { href: "#etudes", label: "Études" },
    { href: "#apropos", label: "À propos" },
    { href: "/login", label: "Mon Espace Pro" },
  ] as const,
  linkedinLabel: "LINKEDIN",
  linkedinHref: "https://www.linkedin.com/company/kerelia",
} as const;

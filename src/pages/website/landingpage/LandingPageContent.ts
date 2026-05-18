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
    "Kerelia transforme la donnée brute en levier opérationnel. Comprenez les contraintes d'un terrain, anticipez les enjeux environnementaux et pilotez vos projets avec des outils sur mesure.",
  metaBl: ["BORDEAUX 44.836 N 0.578 W", "INCUBEE A TECHNOWEST"] as const,
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
  status: string;
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
      status: "En production locale",
      videoSrc: NOS_DOMAINES_PANEL_VIDEOS.urbanisme,
      ctaLabel: "En savoir plus →",
      ctaHref: "/urbanisme/certificats-durbanisme",
    },
    {
      topoClass: "topo-2",
      pill: "COMPENSATION ÉCOLOGIQUE",
      title: "Recherche et animation foncière pour la compensation écologique",
      desc: "Identification de parcelles compatibles avec les prescriptions DREAL, mise en relation avec les propriétaires fonciers et montage des dossiers de sécurisation foncière. Outil ouvert de gestion de base de données foncières.",
      status:
        "Co-développé avec SIMETHIS et Eco-Compensation · Exclusivité d'emploi SIMETHIS en Nouvelle-Aquitaine · Couverture nationale via réseau de bureaux d'études partenaires",
      videoSrc: NOS_DOMAINES_PANEL_VIDEOS.compensationFoncier,
      ctaLabel: "En savoir plus →",
      ctaHref: "/environnement/scoring-compensation-ecologique",
    },
    {
      topoClass: "topo-3",
      pill: "BANCARISATION ERC",
      title: "Bancarisation et suivi des mesures ERC",
      desc: "Logiciel de bancarisation et de pilotage des mesures compensatoires : suivi technique, financier et documentaire des engagements ERC sur toute la durée des atteintes. Destiné aux bureaux d'études, opérateurs de compensation et services instructeurs de l'État.",
      status:
        "Bêta · Co-développé avec Eco-Compensation et SIMETHIS · selon les prescriptions de la DREAL NA · Commercialisation directe Kerelia",
      videoSrc: NOS_DOMAINES_PANEL_VIDEOS.bancarisationErc,
      ctaLabel: "En savoir plus →",
      ctaHref: "/environnement/bancarisation-suivi-erc",
    },
    {
      topoClass: "topo-4",
      pill: "ENVIRONNEMENT",
      title: "Pré-études environnementales automatisées",
      desc: "Pré-rapport environnemental généré à partir des références cadastrales : zonages réglementaires, hydrologie, hydrogéologie, biodiversité connue, structure de la canopée, évolution historique du site. Destiné aux aménageurs, promoteurs et bureaux d'études pour cadrer les enjeux d'un site en amont d'une VNEI.",
      status:
        "Production Kerelia · Méthodologie consolidée avec SIMETHIS · Couverture nationale",
      videoSrc: NOS_DOMAINES_PANEL_VIDEOS.preEtudes,
      ctaLabel: "Voir un rapport exemple →",
      ctaHref: "/environnement/etudes-environnementales",
    },
  ] satisfies readonly NosDomainePanelModel[],
} as const;

export const aboutCopy = {
  title: [
    "Fondée en Nouvelle-Aquitaine,",
    "déployée à l'échelle nationale.",
  ] as const,
  body: [
    "Kerelia est une SAS fondée en 2025, basée à Bordeaux et incubée à Technowest.",
    "Notre activité couvre l'urbanisme réglementaire pour les communes, les pré-études environnementales pour les aménageurs et les bureaux d'études, et le développement de logiciels métier pour la gestion des engagements ERC.",
    "La rigueur sur les sources primaires, la traçabilité documentaire et la conformité aux prescriptions réglementaires constituent notre socle méthodologique. Logiciels et les modèles d'analyse cartographique sont conçus en interne.",
    "Nous sommes accompagnés par l'IGN et nous co-développons nos outils environnementaux avec SIMETHIS, bureau d'études spécialisé.",
  ],
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
  members: [
    {
      name: "Christophe Collantier",
      title: "Fondateur",
      image: "/christophe.png",
      email: "christophe.collantier@kerelia.fr",
      linkedin: "https://www.linkedin.com/in/christophe-collantier-b4290695/",
      description:
        "Fondateur de Kerelia. Quinze ans en développement immobilier et foncier. Pilote les sujets réglementaires et la relation avec les collectivités et les services de l'État.",
    },
    {
      name: "Benjamin Benoit",
      title: "CTO - Data SIG  / IA",
      image: "/benjamin.png",
      email: "benjamin.b@kerelia.fr",
      linkedin: "https://www.linkedin.com/in/benjamin-benoit-ai-ml/",
      description:
        "Ingénieur Data SIG. Conception et développement des outils de traitement géospatiales : extraction, croisement, génération automatisée de rapports. Pilote l'architecture technique et les modèles d'IA.",
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

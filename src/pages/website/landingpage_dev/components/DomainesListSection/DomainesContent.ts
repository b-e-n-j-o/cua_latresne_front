export interface DomaineItem {
    num: string;
    titre: string;
    sousTitre: string;
    modal: {
      intro: string;       // paragraphe d'accroche (grand, gauche)
      body: string[];      // paragraphes de corps (droite / dessous)
      imageAlt?: string;   // alt text de l'image (src à brancher plus tard)
      imageSrc?: string;   // chemin ou URL de l'image illustrative
    };
  }
  
  export const DOMAINES: DomaineItem[] = [
    {
      num: "01",
      titre: "Urbanisme réglementaire",
      sousTitre: "Certificat d'urbanisme analytique, Carte d'identité foncière et veille légale.",
      modal: {
        intro:
          "Nous automatisons la lecture des documents d'urbanisme pour produire des analyses réglementaires exhaustives, traçables et opposables.",
        body: [
          "Le Certificat d'Urbanisme analytique (CUa) Kerelia croise l'ensemble des servitudes d'utilité publique, des zonages PLU/PLUi, des contraintes paysagères, environnementales et topographiques applicables à une parcelle. Le livrable PDF intègre les cartographies 2D réglementaires et, lorsque les données LiDAR sont disponibles, une représentation 3D du relief.",
          "La Carte d'Identité Foncière (CIF) offre le même niveau d'analyse documentaire que le CUa, sans portée juridique — adaptée aux études de faisabilité, aux audits préalables à l'acquisition ou aux simulations de programme.",
          "La veille réglementaire automatisée surveille quotidiennement le Journal Officiel, les recueils d'actes administratifs préfectoraux et les délibérations communales. Les alertes pertinentes sont restituées sous forme de newsletter classée par thème et niveau d'impact.",
        ],
        imageAlt: "Carte réglementaire multi-couches générée par Kerelia",
        imageSrc: "",
      },
    },
    {
      num: "02",
      titre: "Compensation écologique : Animation foncière",
      sousTitre: "Recherche et sécurisation de parcelles pour la compensation écologique.",
      modal: {
        intro:
          "Identifier les parcelles compatibles avec les prescriptions DREAL, dans les fenêtres de temps imposées par les dossiers de compensation.",
        body: [
          "Kerelia conduit la recherche foncière préalable à la mise en œuvre des mesures compensatoires : identification des parcelles répondant aux critères écologiques et réglementaires, analyse de leur contexte (occupation du sol, historique agricole RPG, propriétaires, transactions DVF récentes), scoring de faisabilité d'acquisition.",
          "Ce travail est mené en partenariat avec SIMETHIS et Eco Compensation, qui assurent le suivi terrain, la maîtrise d'œuvre écologique et le reporting auprès des services instructeurs. Kerelia intervient sur le volet données et cartographie.",
          "Le résultat livré est un dossier de sélection parcellaire avec carte comparative, fiches synthétiques par site et estimation préliminaire des coûts d'acquisition et de mise en conformité.",
        ],
        imageAlt: "Cartographie des parcelles candidates pour compensation écologique",
        imageSrc: "",
      },
    },
    {
      num: "03",
      titre: "Mesures compensatoires : Bancarisation et suivi ERC",
      sousTitre: "Pilotage technique, financier et documentaire des mesures compensatoires.",
      modal: {
        intro:
          "Une plateforme pour centraliser, suivre et justifier l'ensemble des engagements ERC sur la durée d'un projet.",
        body: [
          "La plateforme Kerelia ERC permet aux promoteurs et aménageurs de piloter leurs obligations de compensation (Évitement, Réduction, Compensation) de la phase d'instruction jusqu'à la clôture des mesures. Elle intègre les prestataires intervenants, les plannings, l'état d'avancement des mesures et la traçabilité documentaire.",
          "Un module dédié à la supervision DREAL est en cours de développement : il permettra aux services instructeurs de consulter en temps réel l'état consolidé des dossiers ERC relevant de leur ressort territorial.",
          "Des API géospatiales permettent l'intégration des flux Kerelia dans les systèmes d'information existants (SIG collectivités, outils métier bureaux d'études).",
        ],
        imageAlt: "Interface de suivi ERC — tableau de bord consolidé",
        imageSrc: "",
      },
    },
    {
      num: "04",
      titre: "Pré-études environnementales",
      sousTitre: "Analyse préalable à l'acquisition — go / no go.",
      modal: {
        intro:
          "Avant toute acquisition foncière, caractériser les contraintes environnementales d'un site pour sécuriser la décision.",
        body: [
          "Les pré-études Kerelia couvrent les inventaires faune-flore (données INPN, observatoires régionaux, Faune-Aquitaine), la caractérisation des habitats, l'analyse hydrologique et des bassins versants avec dimensionnement préliminaire des ouvrages de rétention, le contexte géologique et hydrogéologique (BRGM), et le recensement des sources potentielles de pollution.",
          "Chaque pré-étude est restituée sous forme d'un rapport de synthèse accompagné d'une cartographie multicouche et d'une estimation préliminaire des coûts de mise en conformité environnementale.",
          "L'objectif est de fournir un avis documenté en amont de la décision d'acquisition, permettant d'anticiper les risques réglementaires et financiers liés aux contraintes environnementales du site.",
        ],
        imageAlt: "Cartographie des sensibilités environnementales — bassins versants et habitats",
        imageSrc: "",
      },
    },
    {
      num: "05",
      titre: "Ingénierie SIG & IA",
      sousTitre: "Pipelines, modèles, croisement de données.",
      modal: {
        intro:
          "Construire les pipelines de données géospatiales et les modèles d'IA qui alimentent les outils Kerelia et les systèmes de nos clients.",
        body: [
          "Kerelia conçoit et opère des pipelines de traitement de données géospatiales hétérogènes : extraction depuis les référentiels publics (IGN WFS, Géoportail de l'Urbanisme, Cadastre, SANDRE, ADEME…), nettoyage, géo-référencement, enrichissement et chargement en base PostGIS.",
          "Les modèles d'IA développés en interne couvrent l'interprétation de documents cartographiques (PLU rasterisés, plans de servitudes), l'analyse de nuages de points LiDAR HD, et le traitement de textes réglementaires pour extraction structurée d'informations.",
          "Des développements sur mesure sont réalisés pour des cas d'usage spécifiques : intégration de nouveaux référentiels, construction de scoreboards fonciers, automatisation de rapports sectoriels.",
        ],
        imageAlt: "Pipeline de traitement géospatial — architecture de données Kerelia",
        imageSrc: "",
      },
    },
    {
      num: "06",
      titre: "Conseil & formation",
      sousTitre: "Audits, accompagnement méthodologique, formation.",
      modal: {
        intro:
          "Un regard extérieur sur vos données géospatiales, vos processus et vos outils — pour aller plus loin ou éviter les erreurs coûteuses.",
        body: [
          "Les audits ponctuels Kerelia portent sur la vérification de conformité réglementaire de dossiers existants, l'analyse de risques avant acquisition (contraintes complexes, incohérences entre documents d'urbanisme), ou le second avis sur des conclusions d'études préalables.",
          "L'accompagnement méthodologique s'adresse aux bureaux d'études et aux collectivités souhaitant structurer leurs pratiques de croisement de données géospatiales : choix des référentiels, architecture de base de données, automatisation de traitements récurrents.",
          "Des formations aux outils Kerelia sont proposées aux équipes internes des clients abonnés, adaptées au niveau technique des participants.",
        ],
        imageAlt: "Session de formation aux outils SIG Kerelia",
        imageSrc: "",
      },
    },
  ];
  
  /** Index de séparation : les lignes 0–3 sont des "services", 4–5 des "capacités transversales" */
  export const SEPARATOR_BEFORE_INDEX = 4;
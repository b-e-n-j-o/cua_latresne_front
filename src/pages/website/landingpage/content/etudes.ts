import { NOS_DOMAINES_PANEL_VIDEOS } from "../lib/constants";

export type EtudeTopoClass = "topo-1" | "topo-2" | "topo-3" | "topo-4";

export type NosDomainePanelModel = {
  topoClass: EtudeTopoClass;
  pill: string;
  title: string;
  desc: string;
  videoSrc: string;
  ctaLabel: string;
  ctaHref: string;
};

export type NosDomainesSectionMeta = {
  id: string;
  screenLabel: string;
  skipLabel: string;
  skipTargetId: string;
};

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
} satisfies { title: string; cards: readonly NosDomainePanelModel[] };

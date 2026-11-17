export type NavLink = {
  label: string;
  href: string;
};

export type NavSection = {
  id: string;
  label: string;
  sectionLabel: string;
  items: readonly NavLink[];
};

export type HeaderCopy = {
  brandWord: string;
  brandAriaLabel: string;
  navAriaLabel: string;
  vousEtesLabel: string;
  vousEtesMenuAriaLabel: string;
  profiles: readonly NavLink[];
  sections: readonly NavSection[];
  openMenuLabel: string;
  closeMenuLabel: string;
};

export const headerCopy = {
  brandWord: "KERELIA",
  brandAriaLabel: "Kerelia accueil",
  navAriaLabel: "Navigation principale",
  vousEtesLabel: "Vous êtes…",
  vousEtesMenuAriaLabel: "Sélectionnez votre profil",
  profiles: [
    { label: "Une collectivité territoriale", href: "/profil/collectivite" },
    { label: "Un service de l'État", href: "/profil/etat" },
    { label: "Un bureau d'études", href: "/profil/bureau-etudes" },
    { label: "Un aménageur ou porteur de projet", href: "/profil/amenageur" },
    { label: "Un opérateur de compensation", href: "/profil/operateur-compensation" },
    { label: "Une profession du foncier", href: "/profil/foncier" },
  ],
  sections: [
    {
      id: "urbanisme",
      label: "Urbanisme réglementaire",
      sectionLabel: "01 — URBANISME RÉGLEMENTAIRE",
      items: [
        { label: "Certificat d'urbanisme (CUa)", href: "/urbanisme/certificats-durbanisme" },
        { label: "Carte d'identité foncière (CIF)", href: "/urbanisme/carte-didentite-fonciere" },
        { label: "Veille réglementaire", href: "/urbanisme/veille-reglementaire" },
      ],
    },
    {
      id: "environnement",
      label: "Environnement",
      sectionLabel: "02 — ÉTUDES ENVIRONNEMENTALES",
      items: [
        { label: "Pré-études environnementales", href: "/environnement/etudes-environnementales" },
        { label: "Bancarisation et suivi ERC", href: "/environnement/bancarisation-suivi-erc" },
        { label: "Recherche foncière de compensation", href: "/environnement/scoring-compensation-ecologique" },
      ],
    },
    {
      id: "outils",
      label: "Ingénierie SIG",
      sectionLabel: "03 — OUTILS & DATA SIG",
      items: [
        { label: "Base de données géospatiales", href: "/outils/base-de-donnees-sig" },
        { label: "Outils SIG", href: "/outils/outils-pilotage-sig" },
        { label: "Visualisation MNT / LiDAR", href: "/outils/visualisation-mnt-lidar" },
      ],
    },
  ],
  openMenuLabel: "Ouvrir le menu",
  closeMenuLabel: "Fermer le menu",
} satisfies HeaderCopy;

export type FooterNavItem = { href: string; label: string };

export type FooterCopy = {
  title: string;
  primaryCta: string;
  nav: readonly FooterNavItem[];
  linkedinLabel: string;
  linkedinHref: string;
};

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
} satisfies FooterCopy;

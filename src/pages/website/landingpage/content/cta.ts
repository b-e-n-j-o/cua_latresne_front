export type DemoContactCtaCopy = { label: string; href: string };

export const demoContactCtaCopy = {
  label: "Nous contacter →",
  href: "/demo",
} satisfies DemoContactCtaCopy;

export type ContactCopy = {
  titleBeforeEm: string;
  titleEm: string;
  titleAfterEm: string;
  /** Absent du contenu d'origine : le paragraphe reste vide. */
  sub?: string;
  primaryCta: string;
  primaryCtaHref: string;
  email: string;
};

export const contactCopy = {
  titleBeforeEm: "Discutons de votre ",
  titleEm: "projet",
  titleAfterEm: ".",
  primaryCta: "Nous contacter →",
  primaryCtaHref: "/demo",
  email: "contact@kerelia.fr",
} satisfies ContactCopy;

/** Segment de texte. Une chaîne seule est du texte brut. */
export type RichSpan =
  | string
  | {
      text: string;
      strong?: boolean;
      href?: string;
    };

export type RichText = readonly RichSpan[];

export type EditorialImage = {
  src: string;
  alt: string;
  caption?: string;
};

export type HeroBlock = {
  type: "hero";
  kicker?: string;
  title: string;
  subtitle?: string;
  image?: EditorialImage;
};

export type SectionBlock = {
  type: "section";
  title?: string;
  paragraphs: readonly RichText[];
};

export type ListBlock = {
  type: "list";
  title?: string;
  items: readonly RichText[];
};

export type ImageBlock = {
  type: "image";
  src: string;
  alt: string;
  caption?: string;
};

export type ColumnsBlock = {
  type: "columns";
  title?: string;
  paragraphs: readonly RichText[];
  image: EditorialImage;
  imageSide?: "left" | "right";
};

export type StatsBlock = {
  type: "stats";
  title?: string;
  items: readonly { value: string; label: string }[];
};

export type FaqBlock = {
  type: "faq";
  title?: string;
  items: readonly { question: string; answer: RichText }[];
};

export type CtaBlock = {
  type: "cta";
  label: string;
  href: string;
};

export type EditorialBlock =
  | HeroBlock
  | SectionBlock
  | ListBlock
  | ImageBlock
  | ColumnsBlock
  | StatsBlock
  | FaqBlock
  | CtaBlock;

export type EditorialPageContent = {
  sectionLabel: string;
  blocks: readonly EditorialBlock[];
};

/**
 * Configuration du portail par commune (`/:commune/outil`).
 * À terme : alimenter depuis l’API / droits utilisateur.
 */

export type CommunePortalSlug = "latresne" | "argeles" | "mios" | "france";

export type PortalToolId = "cua" | "chat" | "reglements" | "documents" | "raa";

export type CommunePortalEntry = {
  slug: CommunePortalSlug;
  /** Libellé affiché dans la barre latérale */
  label: string;
  /** Outils activés pour cette commune (ordre = priorité de redirection) */
  tools: PortalToolId[];
};

export const COMMUNE_PORTAL: Record<CommunePortalSlug, CommunePortalEntry> = {
  latresne: {
    slug: "latresne",
    label: "Latresne",
    tools: ["cua", "chat", "raa"],
  },
  argeles: {
    slug: "argeles",
    label: "Argelès-sur-Mer",
    tools: ["cua", "chat", "reglements", "documents", "raa"],
  },
  mios: {
    slug: "mios",
    label: "Mios",
    tools: ["cua", "chat"],
  },
  france: {
    slug: "france",
    label: "France",
    tools: ["chat"],
  },
};

export function isCommunePortalSlug(value: string | undefined): value is CommunePortalSlug {
  return Boolean(value && value in COMMUNE_PORTAL);
}

export function getCommunePortal(slug: string | undefined): CommunePortalEntry | null {
  if (!isCommunePortalSlug(slug)) return null;
  return COMMUNE_PORTAL[slug];
}

export function defaultToolPath(slug: CommunePortalSlug): string {
  const tools = COMMUNE_PORTAL[slug].tools;
  return `/${slug}/${tools[0]}`;
}

/** Communes avec une page CUA dédiée (pas le template chat). */
export const CUA_PAGE_SLUGS = ["latresne", "argeles", "mios"] as const;
export type CuaPageSlug = (typeof CUA_PAGE_SLUGS)[number];

export function isCuaPageSlug(slug: string | undefined): slug is CuaPageSlug {
  return Boolean(slug && (CUA_PAGE_SLUGS as readonly string[]).includes(slug));
}

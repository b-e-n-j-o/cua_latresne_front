/**
 * communeConfig.ts — miroir frontend des profils commune PLU (backend `communes/*.py`).
 *
 * Responsabilité
 * --------------
 * - Associer chaque route chat (`/argeles/chat`, `/latresne/chat`) au bon préfixe API.
 * - Fournir les libellés UI (en-tête PluChat) sans dupliquer la logique métier.
 *
 * Non géré ici (reste côté backend `CommuneProfile`) :
 * - schéma SQL, couches carto, tools Gemini, prompt système.
 *
 * Ajouter une commune : étendre `PluCommuneSlug`, une entrée dans `PLU_COMMUNE_CONFIG`,
 * une route dans `App.tsx` et un profil dans `api/agents/plu_agent/communes/`.
 */

/** Communes disposant d'un agent PLU (préfixe API /api/plu/{slug}). */
export type PluCommuneSlug = "argeles" | "latresne";

export type PluCommuneConfig = {
  slug: PluCommuneSlug;
  /** Libellé court (en-tête, placeholder). */
  label: string;
  /** Sous-titre de la marque. */
  brandSub: string;
};

export const PLU_COMMUNE_CONFIG: Record<PluCommuneSlug, PluCommuneConfig> = {
  argeles: {
    slug: "argeles",
    label: "Argelès-sur-Mer",
    brandSub: "Argelès-sur-Mer · analyse réglementaire",
  },
  latresne: {
    slug: "latresne",
    label: "Latresne",
    brandSub: "Latresne · analyse réglementaire",
  },
};

/** Racine API agent PLU pour une commune, ex. `…/api/plu/latresne`. */
export function pluApiRoot(apiBase: string, commune: PluCommuneSlug): string {
  const base = apiBase.replace(/\/$/, "");
  return `${base}/api/plu/${commune}`;
}

/** Registre communes portail — aligné sur services/auth/commune_access.py (backend). */

import type { CommunePortalSlug } from "../layouts/communePortalConfig";

export const INSEE_TO_SLUG: Record<string, CommunePortalSlug> = {
  "33234": "latresne",
  "66008": "argeles",
  "33531": "mios",
};

export const SLUG_TO_INSEE: Record<CommunePortalSlug, string> = {
  latresne: "33234",
  argeles: "66008",
  mios: "33531",
  france: "",
};

export function slugFromInsee(code: string): CommunePortalSlug | null {
  const slug = INSEE_TO_SLUG[code.trim()];
  return slug ?? null;
}

export function inseeCodesFromMetadata(meta: Record<string, unknown> | undefined): string[] {
  if (!meta) return [];
  const field = meta.insee;
  if (typeof field === "string" && field.trim()) return [field.trim()];
  if (Array.isArray(field)) {
    return field.map((v) => String(v).trim()).filter(Boolean);
  }
  return [];
}

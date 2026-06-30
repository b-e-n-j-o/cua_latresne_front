import type { User } from "@supabase/supabase-js";
import type { CommunePortalSlug } from "../layouts/communePortalConfig";
import { defaultToolPath, isCommunePortalSlug } from "../layouts/communePortalConfig";
import { apiFetch } from "../api/apiFetch";
import { inseeCodesFromMetadata, slugFromInsee } from "./communeRegistry";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export type CommuneAccessSnapshot = {
  /** null = toutes les communes portail */
  allowedSlugs: CommunePortalSlug[] | null;
  unrestricted: boolean;
  isSuperadmin?: boolean;
  /** Commune par défaut pour « Mon espace » (y compris superadmin via INSEE). */
  homeCommuneSlug?: CommunePortalSlug | null;
};

type ApiCommuneAccessResponse = {
  success?: boolean;
  unrestricted?: boolean;
  is_superadmin?: boolean;
  allowed_commune_slugs?: string[] | null;
  home_commune_slug?: string | null;
};

function slugsFromInseeCodes(codes: string[]): CommunePortalSlug[] {
  const slugs = codes
    .map((code) => slugFromInsee(code))
    .filter((slug): slug is CommunePortalSlug => Boolean(slug));
  return [...new Set(slugs)];
}

function normalizeSlugList(values: string[] | null | undefined): CommunePortalSlug[] | null {
  if (values == null) return null;
  const slugs = values
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is CommunePortalSlug => isCommunePortalSlug(s));
  return [...new Set(slugs)];
}

function normalizeHomeSlug(value: string | null | undefined): CommunePortalSlug | null {
  const slug = (value || "").trim().toLowerCase();
  return isCommunePortalSlug(slug) ? slug : null;
}

function accessFromMetadata(user: User): CommuneAccessSnapshot {
  const codes = inseeCodesFromMetadata(user.user_metadata as Record<string, unknown>);
  if (codes.length === 0) {
    return { allowedSlugs: [], unrestricted: false, homeCommuneSlug: null };
  }
  const slugs = slugsFromInseeCodes(codes);
  return {
    allowedSlugs: slugs,
    unrestricted: false,
    homeCommuneSlug: slugs[0] ?? null,
  };
}

export async function fetchCommuneAccess(user: User): Promise<CommuneAccessSnapshot> {
  if (!API_BASE) {
    return accessFromMetadata(user);
  }

  try {
    const res = await apiFetch("/account/commune-access");
    if (!res.ok) {
      return accessFromMetadata(user);
    }
    const data = (await res.json()) as ApiCommuneAccessResponse;
    if (!data.success) {
      return accessFromMetadata(user);
    }
    const homeCommuneSlug = normalizeHomeSlug(data.home_commune_slug);
    if (data.unrestricted || data.allowed_commune_slugs == null) {
      return {
        allowedSlugs: null,
        unrestricted: true,
        isSuperadmin: Boolean(data.is_superadmin),
        homeCommuneSlug,
      };
    }
    const slugs = normalizeSlugList(data.allowed_commune_slugs);
    return {
      allowedSlugs: slugs,
      unrestricted: false,
      isSuperadmin: Boolean(data.is_superadmin),
      homeCommuneSlug: homeCommuneSlug ?? slugs?.[0] ?? null,
    };
  } catch {
    return accessFromMetadata(user);
  }
}

export function canAccessCommuneSlug(
  slug: CommunePortalSlug,
  allowedSlugs: CommunePortalSlug[] | null
): boolean {
  if (allowedSlugs === null) return true;
  return allowedSlugs.includes(slug);
}

/** Chemin portail CUA/outil par défaut pour « Mon espace ». */
export function resolveMonEspacePath(access: CommuneAccessSnapshot): string | null {
  if (access.homeCommuneSlug) {
    return defaultToolPath(access.homeCommuneSlug);
  }
  if (access.allowedSlugs && access.allowedSlugs.length > 0) {
    return defaultToolPath(access.allowedSlugs[0]);
  }
  return null;
}

export function resolvePostLoginPath(access: CommuneAccessSnapshot): string {
  const monEspace = resolveMonEspacePath(access);
  if (monEspace) return monEspace;
  if (!access.unrestricted && access.allowedSlugs?.length === 0) {
    return "/login";
  }
  return "/";
}

export function resolveCommuneRedirectPath(access: CommuneAccessSnapshot): string {
  return resolveMonEspacePath(access) ?? "/";
}

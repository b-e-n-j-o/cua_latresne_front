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
};

type ApiCommuneAccessResponse = {
  success?: boolean;
  unrestricted?: boolean;
  is_superadmin?: boolean;
  allowed_commune_slugs?: string[] | null;
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

function accessFromMetadata(user: User): CommuneAccessSnapshot {
  const codes = inseeCodesFromMetadata(user.user_metadata as Record<string, unknown>);
  if (codes.length === 0) {
    return { allowedSlugs: [], unrestricted: false };
  }
  const slugs = slugsFromInseeCodes(codes);
  return { allowedSlugs: slugs, unrestricted: false };
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
    if (data.unrestricted || data.allowed_commune_slugs == null) {
      return {
        allowedSlugs: null,
        unrestricted: true,
        isSuperadmin: Boolean(data.is_superadmin),
      };
    }
    const slugs = normalizeSlugList(data.allowed_commune_slugs);
    return {
      allowedSlugs: slugs,
      unrestricted: false,
      isSuperadmin: Boolean(data.is_superadmin),
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

export function resolvePostLoginPath(access: CommuneAccessSnapshot): string {
  if (access.unrestricted || access.allowedSlugs === null) {
    return "/";
  }
  if (access.allowedSlugs.length === 0) {
    return "/login";
  }
  return defaultToolPath(access.allowedSlugs[0]);
}

export function resolveCommuneRedirectPath(access: CommuneAccessSnapshot): string {
  if (access.allowedSlugs && access.allowedSlugs.length > 0) {
    return defaultToolPath(access.allowedSlugs[0]);
  }
  return "/";
}

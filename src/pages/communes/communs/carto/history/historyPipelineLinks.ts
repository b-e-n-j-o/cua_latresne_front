import { encodeCuaViewerToken } from "../../../../../utils/cuaViewer";
import type { HistoryPipeline } from "../tools/HistoryPipelineCard";

export function getValidityExpiryDate(createdAt: string | undefined): Date | null {
  if (!createdAt) return null;
  try {
    const created = new Date(createdAt);
    const expiry = new Date(created);
    expiry.setMonth(expiry.getMonth() + 18);
    return expiry;
  } catch {
    return null;
  }
}

export function formatValidityEndLabel(createdAt: string | undefined): string | null {
  const expiry = getValidityExpiryDate(createdAt);
  if (!expiry) return null;
  const formatted = expiry.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const now = new Date();
  if (now >= expiry) return `Expiré le ${formatted}`;
  return `Valide jusqu'au ${formatted}`;
}

export function getExpirationProgress(
  createdAt: string | undefined,
): { progress: number; isExpired: boolean } | null {
  if (!createdAt) return null;
  try {
    const created = new Date(createdAt);
    const expiry = getValidityExpiryDate(createdAt);
    if (!expiry) return null;
    const now = new Date();
    if (now <= created) return { progress: 0, isExpired: false };
    if (now >= expiry) return { progress: 100, isExpired: true };
    const total = expiry.getTime() - created.getTime();
    const elapsed = now.getTime() - created.getTime();
    return { progress: (elapsed / total) * 100, isExpired: false };
  } catch {
    return null;
  }
}

export function resolveHistoryCuaViewerPath(pipeline: HistoryPipeline): string | null {
  if (!pipeline.output_cua) return null;
  const token = encodeCuaViewerToken({
    bucket: "visualisation",
    docx: pipeline.output_cua,
    slug: pipeline.slug,
  });
  return `/cua?t=${encodeURIComponent(token)}`;
}

export function resolveHistoryCarteUrl(pipeline: HistoryPipeline): string | null {
  const meta = pipeline.metadata;
  return (
    pipeline.qr_url ||
    pipeline.carte_2d_url ||
    meta?.carte_2d_url ||
    pipeline.carte_3d_url ||
    meta?.carte_3d_url ||
    null
  );
}

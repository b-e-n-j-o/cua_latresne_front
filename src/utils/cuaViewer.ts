/** Token base64 pour la route front `/cua?t=…` (compatible backend mammoth). */
export function encodeCuaViewerToken(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

/** Télécharge le DOCX via l'API (évite le cache CDN / navigateur sur l'URL publique Supabase). */
export async function downloadCuaDocx(
  token: string,
  options?: { version?: string | number; filename?: string },
): Promise<void> {
  const version = options?.version ?? Date.now();
  const url = `${API_BASE}/cua/download/docx?t=${encodeURIComponent(token)}&v=${encodeURIComponent(String(version))}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let detail = "Erreur lors du téléchargement";
    try {
      const data = await res.json();
      detail = data?.detail || detail;
    } catch {
      // réponse binaire ou vide
    }
    throw new Error(detail);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = options?.filename || "CUA_unite_fonciere.docx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Chemin relatif vers le viewer CUA embarqué (dev + prod). */
export function buildCuaViewerPath(docxUrl: string, bucket = "visualisation"): string {
  const token = encodeCuaViewerToken({ bucket, docx: docxUrl });
  return `/cua?t=${encodeURIComponent(token)}`;
}

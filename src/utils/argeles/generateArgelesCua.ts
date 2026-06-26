import { apiFetch } from "../../api/apiFetch";
import { buildCuaViewerPath } from "../cuaViewer";

export type ArgelesCuaParcelleRef = {
  section: string;
  numero: string;
};

export type GenerateArgelesCuaOptions = {
  communeSlug?: string;
  refs: ArgelesCuaParcelleRef[];
  numeroCu: string;
  persist?: boolean;
};

export type GenerateArgelesCuaSuccess = {
  slug?: string;
  docxUrl?: string | null;
  viewerUrl?: string | null;
  carteUrl?: string | null;
  nCouchesConcernees?: number;
};

function parseApiError(data: { detail?: unknown }, status: number): string {
  const d = data.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) =>
        typeof x === "object" && x !== null && "msg" in x
          ? String((x as { msg: string }).msg)
          : String(x),
      )
      .join(", ");
  }
  return `HTTP ${status}`;
}

export async function generateArgelesCua(
  options: GenerateArgelesCuaOptions,
): Promise<GenerateArgelesCuaSuccess> {
  const slug = (options.communeSlug ?? "argeles").trim().toLowerCase();
  const numeroCu = options.numeroCu.trim();
  if (!numeroCu) {
    throw new Error("Référence du dossier requise pour générer le certificat d'urbanisme.");
  }

  const response = await apiFetch(`/communes/${slug}/cua/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refs: options.refs.map((p) => ({ section: p.section.trim(), numero: p.numero.trim() })),
      dossier: { numero_cu: numeroCu },
      persist: options.persist ?? true,
    }),
  });

  const data = (await response.json()) as {
    slug?: string;
    output_cua?: string | null;
    cua_viewer_url?: string | null;
    carte_context_url?: string | null;
    n_couches_concernees?: number;
    detail?: unknown;
  };

  if (!response.ok) {
    throw new Error(parseApiError(data, response.status));
  }

  const docxUrl = data.output_cua ?? null;
  return {
    slug: data.slug,
    docxUrl,
    viewerUrl: docxUrl ? buildCuaViewerPath(docxUrl) : data.cua_viewer_url ?? null,
    carteUrl: data.carte_context_url ?? null,
    nCouchesConcernees: data.n_couches_concernees,
  };
}

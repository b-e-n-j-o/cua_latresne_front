import { generateArgelesCua } from "../../../../../utils/argeles/generateArgelesCua";

export type CommuneCuaParcelleRef = {
  section: string;
  numero: string;
};

export type GenerateCommuneCuaOptions = {
  communeSlug: string;
  refs: CommuneCuaParcelleRef[];
  numeroCu?: string;
  demandeurNom?: string;
  insee?: string;
  communeNom?: string;
  unionGeometry?: GeoJSON.Geometry;
  userId?: string | null;
  userEmail?: string | null;
};

function buildAutoNumeroCu(refs: CommuneCuaParcelleRef[]): string {
  const parcelPart = refs
    .map((p) => `${p.section.trim().toUpperCase()}${p.numero.trim()}`)
    .filter(Boolean)
    .join("+");
  return parcelPart ? `CU-${parcelPart}` : `CU-${Date.now()}`;
}

function buildLatresneDemandeur(demandeurNom?: string) {
  const nom = demandeurNom?.trim();
  if (nom) {
    return { type: "particulier", nom };
  }
  return { type: "particulier" };
}

export type GenerateCommuneCuaResult = {
  slug?: string;
  docxUrl?: string | null;
  viewerUrl?: string | null;
  carteUrl?: string | null;
};

const LATRESNE_DEFAULTS = {
  insee: "33234",
  commune: "Latresne",
  codePostal: "33360",
};

function todayFr(): string {
  return new Date().toLocaleDateString("fr-FR");
}

async function pollLatresneJob(jobId: string): Promise<GenerateCommuneCuaResult> {
  const apiBase = import.meta.env.VITE_API_BASE;
  const maxAttempts = 120;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${apiBase}/status/${jobId}`);
    const data = await res.json();

    if (data.status === "success") {
      const slug =
        data.slug ||
        data.pipeline_slug ||
        data.result?.slug ||
        data.result?.pipeline_slug ||
        data.result_enhanced?.slug ||
        data.result_enhanced?.pipeline_slug ||
        undefined;
      return {
        slug,
        viewerUrl: data.result_enhanced?.cua_viewer_url ?? null,
        docxUrl: data.result_enhanced?.output_cua ?? data.result?.output_cua ?? null,
        carteUrl: data.result_enhanced?.carte_context_url ?? null,
      };
    }

    if (data.status === "error") {
      throw new Error(data.error || "Erreur lors de la génération du CUA.");
    }
  }

  throw new Error("Délai dépassé lors de la génération du CUA.");
}

async function generateLatresneCua(options: GenerateCommuneCuaOptions): Promise<GenerateCommuneCuaResult> {
  const insee = options.insee?.trim() || LATRESNE_DEFAULTS.insee;
  const commune = options.communeNom?.trim() || LATRESNE_DEFAULTS.commune;
  const refs = options.refs.map((p) => ({
    section: p.section.trim().toUpperCase(),
    numero: p.numero.trim(),
  }));
  const numeroCu = options.numeroCu?.trim() || buildAutoNumeroCu(refs);

  const cerfaDataForBuilder = {
    numero_cu: numeroCu,
    type_cu: "CU",
    date_depot: todayFr(),
    commune_nom: commune,
    commune_insee: insee,
    demandeur: buildLatresneDemandeur(options.demandeurNom),
    adresse_terrain: {
      ville: commune,
      code_postal: LATRESNE_DEFAULTS.codePostal,
    },
    references_cadastrales: refs,
    superficie_totale_m2: 0,
  };

  const response = await fetch(`${import.meta.env.VITE_API_BASE}/analyze-parcelles-with-json-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parcelles: refs,
      code_insee: insee,
      commune_nom: commune,
      cerfa_data: cerfaDataForBuilder,
      union_geometry: options.unionGeometry,
      user_id: options.userId || undefined,
      user_email: options.userEmail || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error("Erreur lors du lancement de la génération du CUA.");
  }

  const data = (await response.json()) as { job_id?: string };
  if (!data.job_id) {
    throw new Error("Réponse serveur invalide (job_id manquant).");
  }

  return pollLatresneJob(data.job_id);
}

export async function generateCommuneCua(
  options: GenerateCommuneCuaOptions
): Promise<GenerateCommuneCuaResult> {
  const slug = options.communeSlug.trim().toLowerCase();

  if (slug === "argeles") {
    return generateArgelesCua({
      communeSlug: slug,
      refs: options.refs,
      numeroCu: options.numeroCu,
      demandeurNom: options.demandeurNom,
    });
  }

  if (slug === "latresne") {
    return generateLatresneCua(options);
  }

  throw new Error(`Génération CUA non configurée pour la commune « ${options.communeSlug} ».`);
}

export function usesDirectCuaPipeline(communeSlug: string): boolean {
  const slug = communeSlug.trim().toLowerCase();
  return slug === "argeles" || slug === "latresne";
}

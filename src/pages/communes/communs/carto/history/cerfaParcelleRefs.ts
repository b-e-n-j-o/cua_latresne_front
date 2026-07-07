import type { CerfaData } from "../tools/HistoryPipelineCard";

type ParcelleRef = { section?: string; numero?: string };

export function getCerfaParcelleRefs(cerfa?: CerfaData | null): ParcelleRef[] {
  if (!cerfa) return [];
  const fromParcelles = cerfa.parcelles ?? [];
  if (fromParcelles.length > 0) return fromParcelles;
  return cerfa.references_cadastrales ?? [];
}

export function formatCerfaParcelleRefs(cerfa?: CerfaData | null): string {
  const refs = getCerfaParcelleRefs(cerfa);
  if (!refs.length) return "Parcelles non renseignées";
  return refs
    .map((p) => `${String(p.section ?? "").trim().toUpperCase()} ${String(p.numero ?? "").trim()}`.trim())
    .filter(Boolean)
    .join(" · ");
}

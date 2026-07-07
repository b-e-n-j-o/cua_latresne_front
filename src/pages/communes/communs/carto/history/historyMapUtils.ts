import type { HistoryPipeline } from "../tools/HistoryPipelineCard";
import { getCerfaParcelleRefs } from "./cerfaParcelleRefs";

export function getPingColor(createdAt: string | undefined): "green" | "yellow" | "red" {
  if (!createdAt) return "green";
  try {
    const created = new Date(createdAt);
    const expiry = new Date(created);
    expiry.setMonth(expiry.getMonth() + 18);
    const now = new Date();
    if (now >= expiry) return "red";
    const monthsLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return monthsLeft <= 3 ? "yellow" : "green";
  } catch {
    return "green";
  }
}

export function parseIdentiteCentroid(raw: unknown): { lon: number; lat: number } | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && "lon" in raw && "lat" in raw) {
    const o = raw as { lon: unknown; lat: unknown };
    const lon = Number(o.lon);
    const lat = Number(o.lat);
    if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat };
    return null;
  }
  if (typeof raw === "string") {
    try {
      return parseIdentiteCentroid(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  return null;
}

function getPipelineCentroid(p: HistoryPipeline): { lon: number; lat: number } | null {
  return parseIdentiteCentroid(p.centroid as unknown);
}

export function normalizeHistoryPipelines(pipelines: HistoryPipeline[]): HistoryPipeline[] {
  return pipelines.map((p) => {
    const centroid = getPipelineCentroid(p);
    return centroid ? { ...p, centroid } : p;
  });
}

export function buildHistoryMapFeatures(pipelines: HistoryPipeline[]): GeoJSON.Feature[] {
  return pipelines.flatMap((p) => {
    const c = getPipelineCentroid(p);
    if (!c) return [];
    return [
      {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [c.lon, c.lat],
        },
        properties: {
          slug: p.slug,
          numero_cu: p.cerfa_data?.numero_cu,
          demandeur: p.cerfa_data?.demandeur,
          section: getCerfaParcelleRefs(p.cerfa_data)[0]?.section,
          numero: getCerfaParcelleRefs(p.cerfa_data)[0]?.numero,
          commune: p.commune,
          code_insee: p.code_insee,
          pingColor: getPingColor(p.created_at),
        },
      },
    ];
  });
}

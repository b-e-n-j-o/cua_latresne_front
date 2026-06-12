import type {
  CartoCatalogue,
  FamilyIntersectionGroup,
  FullIntersectionsReport,
  IntersectionLayerResult,
  IntersectionObject,
} from "../../types/fullIntersections";
import type { StudyZoneCartoContext } from "../../components/carto/studyZone/types";
import type { ParcelleResumeRef } from "../../types/sigResume";
import { MIN_OBJET_PCT_SIG } from "./sigResume";

const STUDY_ZONE_INTERNAL_PROPS = new Set([
  "intersects_parcel",
  "_fid",
  "_studyKey",
  "_studyColor",
  "_studyLabel",
]);

const SKIP_LAYER_IDS = new Set(["parcelles"]);

export function isSignificantIntersectionObj(obj: IntersectionObject): boolean {
  const pct = obj.pct_sig;
  if (typeof pct === "number" && !Number.isNaN(pct)) return pct >= MIN_OBJET_PCT_SIG;
  const area = obj.surface_inter_m2;
  if (typeof area === "number" && !Number.isNaN(area) && area > 0) return true;
  const len = obj.longueur_inter_m;
  return typeof len === "number" && !Number.isNaN(len) && len > 0;
}

export function objectLabelFromTip(
  tip: string | undefined,
  obj: IntersectionObject,
  fallback = "—"
): string {
  if (tip) {
    const v = obj[tip];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  for (const key of ["libelle", "label", "legende", "nom", "type", "suptype", "nomsuplitt", "id"]) {
    const v = obj[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return fallback;
}

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");
}

export async function fetchCartoCatalogue(communeSlug: string): Promise<CartoCatalogue> {
  const res = await fetch(`${apiBase()}/communes/${communeSlug}/carto/catalogue`);
  if (!res.ok) throw new Error(`Catalogue carto (${res.status})`);
  return res.json();
}

/**
 * Dérive le rapport d'intersections strictes (UF seule) depuis la réponse carto-context.
 * Le backend sélectionne les entités dans le buffer carto mais calcule pct_sig / surfaces
 * uniquement sur l'intersection réelle avec l'UF (flag intersects_parcel).
 */
export function buildIntersectionsReportFromCartoContext(
  context: StudyZoneCartoContext
): FullIntersectionsReport {
  const intersections: Record<string, IntersectionLayerResult> = {};
  const surfaceM2 = context.surface_m2 ?? 0;

  for (const [layerId, layer] of Object.entries(context.layers)) {
    const geomType = layer.geom_type;
    const parcelHits = (layer.features?.features ?? []).filter(
      (f) => (f.properties as { intersects_parcel?: boolean })?.intersects_parcel
    );

    const objets: IntersectionObject[] = parcelHits.map((f) => {
      const props = { ...(f.properties ?? {}) };
      for (const k of STUDY_ZONE_INTERNAL_PROPS) delete props[k];
      return props as IntersectionObject;
    });

    let pctSig = 0;
    if (geomType === "surfacique" && surfaceM2 > 0) {
      const totalArea = objets.reduce((sum, o) => {
        const a = o.surface_inter_m2;
        return sum + (typeof a === "number" ? a : 0);
      }, 0);
      const raw = (totalArea / surfaceM2) * 100;
      pctSig = Math.round(Math.min(100, raw) * 10000) / 10000;
    }

    intersections[layerId] = {
      nom: layer.title,
      geom_type: geomType,
      pct_sig: pctSig,
      objets,
    };
  }

  const nConcerned = Object.values(intersections).filter((l) => l.objets?.length).length;

  return {
    parcelles: context.parcelles,
    surface_m2: surfaceM2,
    computed_at: context.computed_at,
    n_couches: Object.keys(context.layers).length,
    n_couches_concernees: nConcerned,
    intersections,
  };
}

export async function fetchFullIntersections(
  communeSlug: string,
  parcelles: ParcelleResumeRef[]
): Promise<FullIntersectionsReport> {
  const res = await fetch(`${apiBase()}/communes/${communeSlug}/parcelles/intersections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refs: parcelles.map((p) => ({ section: p.section, numero: p.numero })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.detail === "string" ? err.detail : `Intersections (${res.status})`
    );
  }
  return res.json();
}

export function groupIntersectionsByFamily(
  catalogue: CartoCatalogue,
  report: FullIntersectionsReport
): FamilyIntersectionGroup[] {
  const familyTitle = new Map(catalogue.families.map((f) => [f.id, f.title]));
  const buckets = new Map<string, FamilyIntersectionGroup>();

  for (const [layerId, layerMeta] of Object.entries(catalogue.layers)) {
    if (SKIP_LAYER_IDS.has(layerId) || layerMeta.src === "geojson") continue;

    const result = report.intersections[layerId];
    const objets = (result?.objets ?? []).filter(isSignificantIntersectionObj);
    if (!objets.length) continue;

    const familyId = layerMeta.family ?? "_other";
    if (!buckets.has(familyId)) {
      buckets.set(familyId, {
        familyId,
        familyTitle: familyTitle.get(familyId) ?? "Autres",
        layers: [],
      });
    }
    buckets.get(familyId)!.layers.push({
      layerId,
      title: layerMeta.title ?? result?.nom ?? layerId,
      tip: layerMeta.tip,
      geom: layerMeta.geom,
      result: result ?? { nom: layerMeta.title, objets: [], pct_sig: 0, geom_type: "surfacique" },
      significantObjets: objets,
    });
  }

  const order = catalogue.families.map((f) => f.id);
  return [...buckets.values()].sort(
    (a, b) => {
      const ia = order.indexOf(a.familyId);
      const ib = order.indexOf(b.familyId);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    }
  );
}

export const FAMILY_ACCENT: Record<string, string> = {
  zonages_plu: "bg-blue-600",
  prescriptions: "bg-orange-500",
  informations: "bg-violet-500",
  servitudes: "bg-rose-500",
  risques: "bg-red-600",
  environnement: "bg-emerald-600",
  reseaux: "bg-slate-600",
  cadastre: "bg-gray-500",
  _other: "bg-gray-400",
};

import type {
  ParcelleResumeRef,
  SigResume,
  SigResumeLayer,
  SigResumeLayerKey,
  SigResumeObjet,
} from "../../types/sigResume";
import { SIG_RESUME_LAYER_ORDER } from "../../types/sigResume";

/** Aligné sur enrich_parcelles_resume.py — micro-recouvrements aux limites de parcelles. */
export const MIN_OBJET_PCT_SIG = 1.0;

export function isSignificantIntersection(obj: SigResumeObjet): boolean {
  const pct = obj.pct_sig;
  if (typeof pct === "number" && !Number.isNaN(pct)) {
    return pct >= MIN_OBJET_PCT_SIG;
  }
  const area = obj.surface_inter_m2;
  return typeof area === "number" && !Number.isNaN(area) && area > 0;
}

export function filterSignificantObjets(
  objets: SigResumeObjet[] | undefined
): SigResumeObjet[] {
  return (objets ?? []).filter(isSignificantIntersection);
}

/**
 * Pourcentage couche / parcelle (union des intersections, plafonné à 100 %).
 * Préfère layer.pct_sig (ST_Union côté enrichissement batch) ; repli sur surfaces.
 */
export function layerPctFromLayer(
  layer: SigResumeLayer | undefined,
  objets: SigResumeObjet[],
  parcelSurfaceM2?: number
): number {
  if (typeof layer?.pct_sig === "number" && !Number.isNaN(layer.pct_sig)) {
    return Math.min(100, Math.round(layer.pct_sig * 10) / 10);
  }

  if (parcelSurfaceM2 && parcelSurfaceM2 > 0) {
    const sumArea = objets.reduce((sum, obj) => {
      const a = obj.surface_inter_m2;
      return sum + (typeof a === "number" && !Number.isNaN(a) ? a : 0);
    }, 0);
    if (sumArea > 0) {
      const pct = (sumArea / parcelSurfaceM2) * 100;
      return Math.min(100, Math.round(pct * 10) / 10);
    }
  }

  const sumPct = objets.reduce((sum, obj) => {
    if (typeof obj.pct_sig === "number" && !Number.isNaN(obj.pct_sig)) {
      return sum + obj.pct_sig;
    }
    return sum;
  }, 0);
  return sumPct > 0 ? Math.min(100, Math.round(sumPct * 10) / 10) : 0;
}

/** @deprecated Préférer layerPctFromLayer — la somme des pct_sig objet peut dépasser 100 %. */
export function layerPctFromObjets(objets: SigResumeObjet[]): number {
  return layerPctFromLayer(undefined, objets);
}

export function normalizeParcelSection(raw: unknown): string {
  const v = String(raw ?? "").trim().toUpperCase();
  return v ? v.padStart(2, "0") : "";
}

export function normalizeParcelNumero(raw: unknown): string {
  const v = String(raw ?? "").trim();
  return v ? v.padStart(4, "0") : "";
}

/** Ignore null, undefined et chaînes vides (fréquent en base GPU). */
export function pickAttr(
  obj: SigResumeObjet,
  keys: string[],
  fallback = "—"
): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return fallback;
}

export function formatLayerObjectLabel(
  layerKey: SigResumeLayerKey,
  obj: SigResumeObjet
): string {
  switch (layerKey) {
    case "zonage_plu": {
      const reg = pickAttr(obj, ["zonage_reglement", "libelle"], "");
      const long = pickAttr(obj, ["libelong"], "");
      if (reg && long) return `${reg} — ${long}`;
      return reg || long || "Zonage";
    }
    case "hauteurs": {
      const label = pickAttr(
        obj,
        ["legende", "hauteur", "libelle", "libelong"],
        ""
      );
      if (label) return label;
      if (typeof obj.pct_sig === "number" && obj.pct_sig > 0) {
        return "Prescription hauteur (libellé non renseigné en base)";
      }
      return "—";
    }
    case "sup_assiette_s":
      return pickAttr(
        obj,
        ["nomsuplitt", "nom_servitude", "nomreg", "suptype"],
        "Servitude"
      );
    case "ppr":
    case "pprif": {
      const parts = ["label", "degre", "risque", "document"]
        .map((k) => pickAttr(obj, [k], ""))
        .filter(Boolean);
      return parts.length ? parts.join(" · ") : "—";
    }
    default:
      return "—";
  }
}

export function layerMissingReason(
  sig: SigResume | null | undefined,
  layerKey: SigResumeLayerKey
): string {
  const layers = sig?.layers;
  if (!layers) {
    return "sig_resume absent — enrichissement batch non effectué";
  }
  const layer = layers[layerKey];
  if (!layer) {
    const enriched = SIG_RESUME_LAYER_ORDER.filter((k) => layers[k]);
    if (enriched.length > 0) {
      return "aucune intersection ou couche non enrichie (relancer --only " + layerKey + " --apply)";
    }
    return "enrichissement batch non effectué";
  }
  if (!filterSignificantObjets(layer.objets).length) {
    if (layer.objets?.length) {
      return "recouvrement négligeable (< 1 % de la parcelle)";
    }
    if (layer.status === "non_concernee") {
      return "aucune intersection géométrique avec cette couche";
    }
    return "aucune intersection géométrique avec cette couche";
  }
  return "";
}

export function parseSigResume(raw: unknown): SigResume | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SigResume;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as SigResume;
  return null;
}

export function findSigResumeInCadastre(
  cadastre: GeoJSON.FeatureCollection | null | undefined,
  section: string,
  numero: string
): SigResume | null {
  if (!cadastre?.features?.length) return null;
  const s = normalizeParcelSection(section);
  const n = normalizeParcelNumero(numero);
  const feature = cadastre.features.find((f) => {
    const p = f.properties as Record<string, unknown> | undefined;
    return (
      normalizeParcelSection(p?.section) === s &&
      normalizeParcelNumero(p?.numero) === n
    );
  });
  if (!feature?.properties) return null;
  const props = feature.properties as Record<string, unknown>;
  return (
    parseSigResume(props.sig_resume) ?? {
      section: String(props.section ?? section),
      numero: String(props.numero ?? numero),
      idu: props.idu != null ? String(props.idu) : undefined,
      contenance_m2:
        props.contenance != null ? Number(props.contenance) : undefined,
    }
  );
}

export type ParcelleResumeView = ParcelleResumeRef & {
  sig: SigResume | null;
};

function parcelResumeKey(section: string, numero: string): string {
  return `${normalizeParcelSection(section)}:${normalizeParcelNumero(numero)}`;
}

export function mergeSigResumeFromApiItem(
  item: Record<string, unknown>
): SigResume | null {
  const parsed = parseSigResume(item.sig_resume);
  if (parsed?.layers) return parsed;
  if (parsed) return parsed;
  return {
    section: String(item.section ?? ""),
    numero: String(item.numero ?? ""),
    idu: item.idu != null ? String(item.idu) : undefined,
    contenance_m2:
      item.contenance != null ? Number(item.contenance) : undefined,
    layers: undefined,
  };
}

async function fetchParcellesResumeOnce(
  communeSlug: string,
  parcelles: ParcelleResumeRef[]
): Promise<Record<string, SigResume>> {
  const base = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");
  const refs = parcelles
    .map((p) => `${normalizeParcelSection(p.section)}:${normalizeParcelNumero(p.numero)}`)
    .join(",");
  const url = `${base}/communes/${communeSlug}/parcelles/resume?refs=${encodeURIComponent(refs)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Resume parcelles (${res.status})`);
  }
  const data = (await res.json()) as { items?: Record<string, unknown>[] };
  const out: Record<string, SigResume> = {};
  for (const item of data.items ?? []) {
    const section = String(item.section ?? "");
    const numero = String(item.numero ?? "");
    const sig = mergeSigResumeFromApiItem(item);
    if (sig) {
      out[parcelResumeKey(section, numero)] = sig;
    }
  }
  return out;
}

export async function fetchParcellesResume(
  communeSlug: string,
  parcelles: ParcelleResumeRef[]
): Promise<Record<string, SigResume>> {
  if (!parcelles.length) return {};

  try {
    return await fetchParcellesResumeOnce(communeSlug, parcelles);
  } catch {
    // Fallback parcelle par parcelle (ex. UF où une parcelle a des NaN en base)
    const out: Record<string, SigResume> = {};
    await Promise.all(
      parcelles.map(async (p) => {
        try {
          const partial = await fetchParcellesResumeOnce(communeSlug, [p]);
          Object.assign(out, partial);
        } catch {
          /* cadastre GeoJSON utilisé en secours côté buildParcelleResumeViews */
        }
      })
    );
    if (Object.keys(out).length === 0) {
      throw new Error("Resume parcelles indisponible");
    }
    return out;
  }
}

export function buildParcelleResumeViews(
  parcelles: ParcelleResumeRef[],
  cadastre: GeoJSON.FeatureCollection | null | undefined,
  apiResumes: Record<string, SigResume> = {}
): ParcelleResumeView[] {
  return parcelles.map((p) => {
    const key = parcelResumeKey(p.section, p.numero);
    const fromApi = apiResumes[key];
    const fromCadastre = findSigResumeInCadastre(cadastre, p.section, p.numero);
    const sig =
      fromApi?.layers != null
        ? fromApi
        : fromCadastre?.layers != null
          ? fromCadastre
          : fromApi ?? fromCadastre;
    return { ...p, sig };
  });
}

export { parcelResumeKey };

export type LayerAggregateRow = {
  key: string;
  label: string;
  area_m2: number;
  pct_uf: number;
  detail?: string;
};

function layerObjectKey(layerKey: SigResumeLayerKey, obj: SigResumeObjet): string {
  return formatLayerObjectLabel(layerKey, obj);
}

function layerObjectLabel(layerKey: SigResumeLayerKey, obj: SigResumeObjet): string {
  return formatLayerObjectLabel(layerKey, obj);
}

export function aggregateLayerForUf(
  views: ParcelleResumeView[],
  layerKey: SigResumeLayerKey
): LayerAggregateRow[] {
  const totals = new Map<string, LayerAggregateRow>();
  let ufArea = 0;

  for (const view of views) {
    const parcelArea =
      view.sig?.surface_sig_m2 ??
      view.surface_m2 ??
      view.sig?.contenance_m2 ??
      0;
    ufArea += parcelArea > 0 ? parcelArea : 0;

    const layer = view.sig?.layers?.[layerKey];
    const objets = filterSignificantObjets(layer?.objets);
    if (!objets.length) continue;

    for (const obj of objets) {
      const area =
        typeof obj.surface_inter_m2 === "number"
          ? obj.surface_inter_m2
          : parcelArea > 0 && typeof obj.pct_sig === "number"
            ? (parcelArea * obj.pct_sig) / 100
            : 0;
      if (area <= 0) continue;
      const key = layerObjectKey(layerKey, obj);
      const existing = totals.get(key);
      if (existing) {
        existing.area_m2 += area;
      } else {
        totals.set(key, {
          key,
          label: layerObjectLabel(layerKey, obj),
          area_m2: area,
          pct_uf: 0,
        });
      }
    }
  }

  const rows = [...totals.values()].sort((a, b) => b.area_m2 - a.area_m2);
  const sumAreas = rows.reduce((s, r) => s + r.area_m2, 0) || ufArea || 1;
  for (const row of rows) {
    row.pct_uf = Math.round((row.area_m2 / sumAreas) * 1000) / 10;
  }
  return rows;
}

export function totalUfSurfaceM2(views: ParcelleResumeView[]): number {
  return views.reduce((sum, v) => {
    const a =
      v.sig?.surface_sig_m2 ??
      v.surface_m2 ??
      v.sig?.contenance_m2 ??
      0;
    return sum + (a > 0 ? a : 0);
  }, 0);
}

export function layerDisplayName(layerKey: SigResumeLayerKey, layer?: { nom?: string }): string {
  return layer?.nom ?? layerKey;
}

export { SIG_RESUME_LAYER_ORDER };

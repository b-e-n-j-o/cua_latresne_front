import { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiFetch";
import type { EtapeFrise, EvenementParcelle, GeomVersion, Graphe, IsoDate, Millesime, PeriodeSpatiale, VersionInfo } from "./types";

export const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export class NotFoundError extends Error {}

const base = (commune: string) => `/communes/${encodeURIComponent(commune)}/filiation`;

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (res.status === 404) {
    const body = await res.json().catch(() => ({}));
    throw new NotFoundError(typeof body?.detail === "string" ? body.detail : "Introuvable");
  }
  if (!res.ok) throw new Error(`Erreur ${res.status} sur ${path}`);
  return (await res.json()) as T;
}

const qs = (params: Record<string, string | number | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const filiationApi = {
  millesimes: (c: string) => getJson<Millesime[]>(`${base(c)}/millesimes`),
  versionActuelle: (c: string, idu: string) =>
    getJson<{ version_id: number }>(`${base(c)}/version-actuelle${qs({ idu })}`).then((r) => r.version_id),
  version: (c: string, v: number) => getJson<VersionInfo>(`${base(c)}/versions/${v}`),
  frise: (c: string, v: number) => getJson<EtapeFrise[]>(`${base(c)}/versions/${v}/frise`),
  graphe: (c: string, v: number) => getJson<Graphe>(`${base(c)}/versions/${v}/graphe`),
  evenements: (c: string, idu: string) =>
    getJson<EvenementParcelle[]>(`${base(c)}/parcelles/${encodeURIComponent(idu)}/evenements`),
  historique: (c: string, idus: string[], date?: IsoDate) =>
    getJson<PeriodeSpatiale[]>(`${base(c)}/uf/historique${qs({ idus: idus.join(","), date })}`),
  geomVersions: (c: string, ids: number[]) =>
    getJson<GeomVersion[]>(`${base(c)}/geom-versions${qs({ ids: ids.join(",") })}`),
  tileUrl: (c: string, date: IsoDate, cacheVersion: string) =>
    `${API_BASE}${base(c)}/tuiles/{z}/{x}/{y}.pbf${qs({ date, v: cacheVersion })}`,
};

// --- Cache mémoire --------------------------------------------------------------
// Les réponses sont stables entre deux ingestions : un cache par clé suffit,
// sans dépendance supplémentaire. Les erreurs ne sont pas mises en cache.

const cache = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fn();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export const invalidateFiliationCache = () => cache.clear();

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/** key null = pas de requête. La fonction n'est relue que quand la clé change. */
export function useFiliation<T>(key: string | null, fn: () => Promise<T>): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ data: undefined, error: undefined, loading: !!key });

  useEffect(() => {
    if (!key) {
      setState({ data: undefined, error: undefined, loading: false });
      return;
    }
    let alive = true;
    setState({ data: undefined, error: undefined, loading: true });
    cached(key, fn).then(
      (data) => alive && setState({ data, error: undefined, loading: false }),
      (error: Error) => alive && setState({ data: undefined, error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type maplibregl from "maplibre-gl";
import { autorisationsApi, type AutProps } from "./autorisationsApi";
import {
  AUT_CATEGORIES,
  AUT_CLICK_LAYERS,
  applyAutData,
  defaultFilterState,
  emptyFc,
  ensureAutLayers,
  filtrer,
  fitToFeature,
  setAutVisibility,
  type AutFilterState,
} from "./autorisationsMap";

const YEAR_NOW = new Date().getFullYear();

/** Couche carte des autorisations. La consultation se fait dans l'historique (barre gauche). */
export default function AutorisationsUrbanismeLayer({
  map,
  communeSlug,
  layerVisible,
  openAutId,
  onLayersReady,
  onHover,
}: {
  map: maplibregl.Map | null;
  communeSlug: string;
  layerVisible: boolean;
  cadastre?: GeoJSON.FeatureCollection | null;
  openAutId?: string | null;
  /** Remet les pastilles devant le cadastre après chaque synchro de style. */
  onLayersReady?: (map: maplibregl.Map) => void;
  onHover?: (tip: { x: number; y: number; content: string } | null) => void;
}) {
  const [rawPts, setRawPts] = useState<GeoJSON.FeatureCollection>(emptyFc());
  const [rawEmp, setRawEmp] = useState<GeoJSON.FeatureCollection>(emptyFc());
  const [filters] = useState<AutFilterState>(() => defaultFilterState(YEAR_NOW));
  const [externalId, setExternalId] = useState<string | null>(null);
  const [choix, setChoix] = useState<{ x: number; y: number; items: AutProps[] } | null>(null);

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const id = (ev as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setExternalId(id);
    };
    window.addEventListener("kerelia-open-aut", onOpen);
    return () => window.removeEventListener("kerelia-open-aut", onOpen);
  }, []);

  const hoverId = useRef<string | null>(null);
  const selectedId = useRef<string | null>(null);
  const empById = useRef<Map<string, GeoJSON.Feature>>(new Map());

  const filteredPts = useMemo(
    () => ({ type: "FeatureCollection" as const, features: filtrer(rawPts.features, filters) }),
    [rawPts, filters],
  );
  const filteredEmp = useMemo(
    () => ({ type: "FeatureCollection" as const, features: filtrer(rawEmp.features, filters) }),
    [rawEmp, filters],
  );

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    autorisationsApi
      .geojson(communeSlug)
      .then((data) => {
        if (cancelled) return;
        setRawPts(data.points);
        setRawEmp(data.emprises);
        empById.current = new Map(
          (data.emprises.features ?? []).map((f) => [String(f.id ?? (f.properties as AutProps)?.id), f]),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [map, communeSlug]);

  useEffect(() => {
    if (!map) return;
    const mount = () => {
      ensureAutLayers(map);
      applyAutData(map, filteredPts, filteredEmp);
      setAutVisibility(map, layerVisible);
      onLayersReady?.(map);
    };
    if (map.isStyleLoaded()) mount();
    else map.once("load", mount);
    const onIdle = () => onLayersReady?.(map);
    map.on("idle", onIdle);
    return () => {
      map.off("idle", onIdle);
    };
  }, [map, filteredPts, filteredEmp, layerVisible, onLayersReady]);

  const setHover = useCallback((mapInst: maplibregl.Map, id: string | null) => {
    if (hoverId.current && hoverId.current !== id) {
      try {
        mapInst.setFeatureState({ source: "aut-emprises", id: hoverId.current }, { hover: false });
      } catch {
        /* ignore */
      }
    }
    hoverId.current = id;
    if (id) {
      try {
        mapInst.setFeatureState({ source: "aut-emprises", id }, { hover: true });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const setSelected = useCallback((mapInst: maplibregl.Map, id: string | null) => {
    if (selectedId.current) {
      try {
        mapInst.setFeatureState({ source: "aut-emprises", id: selectedId.current }, { selected: false });
      } catch {
        /* ignore */
      }
    }
    selectedId.current = id;
    if (id) {
      try {
        mapInst.setFeatureState({ source: "aut-emprises", id }, { selected: true });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const openFiche = useCallback(
    async (id: string, mapInst?: maplibregl.Map | null) => {
      const m = mapInst ?? map;
      if (m) {
        setSelected(m, id);
        const feat = empById.current.get(id);
        fitToFeature(m, feat?.geometry ?? null);
      }
    },
    [map, setSelected],
  );

  useEffect(() => {
    const id = openAutId || externalId;
    if (id) void openFiche(id);
  }, [openAutId, externalId, openFiche]);

  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!layerVisible) return;
      const layers = AUT_CLICK_LAYERS.filter((id) => map.getLayer(id));
      if (!layers.length) return;
      const feats = map.queryRenderedFeatures(e.point, { layers });
      if (!feats.length) return;
      const cluster = feats.find((f) => f.properties && "point_count" in f.properties);
      if (cluster && cluster.properties?.cluster_id != null) {
        const src = map.getSource("aut-points") as maplibregl.GeoJSONSource;
        const cid = Number(cluster.properties.cluster_id);
        const geom = cluster.geometry as GeoJSON.Point;
        const point = e.point;
        void (async () => {
          const zoom = await clusterZoom(src, cid);
          const leaves = await clusterLeaves(src, cid);
          const identiques = memePoint(leaves);
          if (identiques || zoom == null || zoom >= map.getMaxZoom() || map.getZoom() >= zoom - 0.05) {
            setChoix({
              x: point.x,
              y: point.y,
              items: leaves.map((f) => (f.properties ?? {}) as AutProps).filter((p) => p.id),
            });
            return;
          }
          map.easeTo({ center: geom.coordinates as [number, number], zoom });
        })();
        return;
      }
      setChoix(null);
      const id = String((feats[0].properties as AutProps | undefined)?.id ?? feats[0].id ?? "");
      if (id) {
        window.dispatchEvent(new CustomEvent("kerelia-open-aut", { detail: { id } }));
        void openFiche(id, map);
      }
    };

    let tipVisible = false;
    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (!layerVisible) return;
      const layers = AUT_CLICK_LAYERS.filter((id) => map.getLayer(id));
      const feats = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : [];
      map.getCanvas().style.cursor = feats.length ? "pointer" : "";
      const id = feats[0]?.properties?.id ? String(feats[0].properties.id) : null;
      setHover(map, id);

      const point = map.getLayer("aut-points")
        ? map.queryRenderedFeatures(e.point, { layers: ["aut-points"] }).find((f) => !("point_count" in (f.properties ?? {})))
        : undefined;
      if (!point) {
        if (tipVisible) {
          tipVisible = false;
          onHover?.(null);
        }
        return;
      }
      tipVisible = true;
      const p = (point.properties ?? {}) as AutProps;
      const nature = AUT_CATEGORIES.find((c) => c.key === p.categorie)?.label ?? p.categorie;
      const nom = [p.type_dau, p.id].filter(Boolean).join(" · ");
      const date = p.date ? String(p.date).slice(0, 10).split("-").reverse().join("/") : "Date inconnue";
      onHover?.({ x: e.point.x, y: e.point.y, content: `${nature}\n${nom}\n${date}` });
    };

    map.on("click", onClick);
    map.on("mousemove", onMove);
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMove);
    };
  }, [map, layerVisible, openFiche, setHover, onHover]);

  if (!choix?.items.length) return null;

  return (
    <div
      className="absolute z-50 w-64 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-xl"
      style={{ left: choix.x, top: choix.y }}
    >
      <p className="px-2 py-1 text-[11px] text-slate-500">{choix.items.length} autorisations à cet endroit</p>
      {choix.items.map((p) => {
        const nature = AUT_CATEGORIES.find((c) => c.key === p.categorie)?.label ?? p.categorie;
        const date = p.date ? String(p.date).slice(0, 10).split("-").reverse().join("/") : "Date inconnue";
        return (
          <button
            key={p.id}
            type="button"
            className="block w-full px-2 py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              setChoix(null);
              window.dispatchEvent(new CustomEvent("kerelia-open-aut", { detail: { id: p.id } }));
              if (map) void openFiche(p.id, map);
            }}
          >
            <span className="block font-medium text-slate-900">{[p.type_dau, p.id].filter(Boolean).join(" · ")}</span>
            <span className="text-slate-500">{nature} · {date}</span>
          </button>
        );
      })}
    </div>
  );
}

function asPromise<T>(value: unknown, callbackStyle: (done: (result: T | null) => void) => void): Promise<T | null> {
  if (value && typeof (value as Promise<T>).then === "function") return value as Promise<T>;
  return new Promise((resolve) => callbackStyle(resolve));
}

function clusterZoom(src: maplibregl.GeoJSONSource, cid: number): Promise<number | null> {
  const result = src.getClusterExpansionZoom(cid) as unknown;
  return asPromise<number>(result, (done) => {
    src.getClusterExpansionZoom(cid, (err, zoom) => done(err || zoom == null ? null : zoom));
  });
}

function clusterLeaves(src: maplibregl.GeoJSONSource, cid: number): Promise<GeoJSON.Feature[]> {
  const result = src.getClusterLeaves(cid, 80, 0) as unknown;
  return asPromise<GeoJSON.Feature[]>(result, (done) => {
    src.getClusterLeaves(cid, 80, 0, (err, leaves) => done(err ? [] : leaves ?? []));
  }).then((leaves) => leaves ?? []);
}

function memePoint(leaves: GeoJSON.Feature[]): boolean {
  const coords = leaves
    .map((f) => (f.geometry?.type === "Point" ? (f.geometry.coordinates as number[]) : null))
    .filter((c): c is number[] => !!c);
  if (coords.length < 2) return false;
  const [x, y] = coords[0];
  return coords.every((c) => Math.abs(c[0] - x) < 1e-7 && Math.abs(c[1] - y) < 1e-7);
}

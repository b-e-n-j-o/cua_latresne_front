import type { HistoryPipeline } from "../tools/HistoryPipelineCard";
import { getCerfaParcelleRefs } from "./cerfaParcelleRefs";
import {
  CUA_HISTORY_HIT_LAYER_ID,
  CUA_HISTORY_PICK_LAYER_IDS,
  CUA_PING_PICK_RADIUS_ENTER,
  CUA_PING_PICK_RADIUS_STICKY,
  PMTILES_CADASTRE_LAYER_IDS,
} from "./cuaHistoryPingLayers";

export { CUA_HISTORY_HIT_LAYER_ID, CUA_HISTORY_PICK_LAYER_IDS };

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

export const CUA_HISTORY_LAYER_IDS = [
  "pipelines-history-halo",
  "pipelines-history-point",
  CUA_HISTORY_HIT_LAYER_ID,
] as const;

type HistoryHoverMap = {
  getLayer: (id: string) => unknown;
  setPaintProperty: (layerId: string, name: string, value: unknown) => void;
  moveLayer?: (layerId: string, beforeId?: string) => void;
};

/** Pings CUA au-dessus de toutes les autres couches. */
export function bringCuaHistoryLayersToFront(map: HistoryHoverMap): void {
  if (!map.moveLayer) return;
  for (const id of CUA_HISTORY_LAYER_IDS) {
    try {
      if (map.getLayer(id)) map.moveLayer(id);
    } catch {
      /* style en cours de chargement */
    }
  }
}

export type HistoryPingLayerReorderOptions = {
  cadastreHitLayerIds?: readonly string[];
  cadastreGridLayerIds?: readonly string[];
  cadastreLabelLayerIds?: readonly string[];
  overlayLayerIds?: readonly string[];
};

/**
 * Cadastre + overlays sous la zone de hit des pings ; pings toujours au sommet.
 * À rappeler après sync légende ou toggle « Parcelles cadastrales ».
 */
export function ensureHistoryPingLayersOnTop(
  map: HistoryHoverMap,
  opts: HistoryPingLayerReorderOptions = {},
): void {
  if (!map.moveLayer) return;

  const pingAnchor = map.getLayer(CUA_HISTORY_HIT_LAYER_ID)
    ? CUA_HISTORY_HIT_LAYER_ID
    : map.getLayer("pipelines-history-point")
      ? "pipelines-history-point"
      : undefined;

  const pingIdSet = new Set<string>(CUA_HISTORY_LAYER_IDS);

  const placeBelowPings = (layerId: string) => {
    if (!map.getLayer(layerId) || pingIdSet.has(layerId)) return;
    try {
      if (pingAnchor) map.moveLayer!(layerId, pingAnchor);
    } catch {
      /* style en cours de chargement */
    }
  };

  for (const id of opts.cadastreGridLayerIds ?? []) placeBelowPings(id);
  for (const id of opts.cadastreHitLayerIds ?? []) placeBelowPings(id);
  for (const id of opts.cadastreLabelLayerIds ?? []) placeBelowPings(id);
  for (const id of PMTILES_CADASTRE_LAYER_IDS) placeBelowPings(id);
  for (const id of opts.overlayLayerIds ?? []) placeBelowPings(id);

  bringCuaHistoryLayersToFront(map);
}

export function pickCuaHistoryPingFeature(
  map: { getLayer: (id: string) => unknown; queryRenderedFeatures: (...args: unknown[]) => GeoJSON.Feature[] },
  point: { x: number; y: number },
  radius: number = CUA_PING_PICK_RADIUS_ENTER,
): GeoJSON.Feature | undefined {
  const layers = CUA_HISTORY_PICK_LAYER_IDS.filter((id) => map.getLayer(id));
  if (!layers.length) return undefined;
  const hits = map.queryRenderedFeatures(point, { layers, radius }) as GeoJSON.Feature[];
  return hits[0];
}

export type CuaHistoryPointerHandlers = {
  isEnabled?: () => boolean;
  onHover: (payload: {
    slug: string;
    x: number;
    y: number;
    demandeur?: string;
    numeroCu?: string;
    section?: string;
    numero?: string;
  }) => void;
  onLeave: () => void;
};

/**
 * Survol fiable via queryRenderedFeatures (couches métier / PMTiles au-dessus).
 * À enregistrer après attachCartoHoverHandlers pour appliquer le tooltip en dernier.
 */
export function attachCuaHistoryPointerHandlers(
  map: {
    on: (type: string, listener: (e: { point?: { x: number; y: number } }) => void) => void;
    off: (type: string, listener: (e: { point?: { x: number; y: number } }) => void) => void;
    getLayer: (id: string) => unknown;
    queryRenderedFeatures: (...args: unknown[]) => GeoJSON.Feature[];
  },
  handlers: CuaHistoryPointerHandlers,
): () => void {
  let stickySlug: string | null = null;

  const onMove = (e: { point: { x: number; y: number } }) => {
    if (handlers.isEnabled && !handlers.isEnabled()) {
      stickySlug = null;
      handlers.onLeave();
      return;
    }

    const pickRadius = stickySlug ? CUA_PING_PICK_RADIUS_STICKY : CUA_PING_PICK_RADIUS_ENTER;
    const feature = pickCuaHistoryPingFeature(map, e.point, pickRadius);
    if (!feature?.properties) {
      if (stickySlug) {
        stickySlug = null;
        handlers.onLeave();
      }
      return;
    }

    const props = feature.properties as Record<string, unknown>;
    const slug = String(props.slug ?? "").trim();
    if (!slug) {
      if (stickySlug) {
        stickySlug = null;
        handlers.onLeave();
      }
      return;
    }

    stickySlug = slug;
    handlers.onHover({
      slug,
      x: e.point.x,
      y: e.point.y,
      demandeur: String(props.demandeur ?? "").trim() || undefined,
      numeroCu: String(props.numero_cu ?? "").trim() || undefined,
      section: String(props.section ?? "").trim() || undefined,
      numero: String(props.numero ?? "").trim() || undefined,
    });
  };

  const onMapLeave = () => {
    stickySlug = null;
    handlers.onLeave();
  };

  map.on("mousemove", onMove);
  map.on("mouseout", onMapLeave);
  return () => {
    map.off("mousemove", onMove);
    map.off("mouseout", onMapLeave);
  };
}

const CUA_MATCH = (slug: string) => ["==", ["get", "slug"], slug] as const;

/** Agrandit le halo / point du CUA survolé et atténue les autres. */
export function applyCuaHistoryHoverHighlight(
  map: HistoryHoverMap,
  hoveredSlug: string | null,
): void {
  if (!map.getLayer("pipelines-history-halo") || !map.getLayer("pipelines-history-point")) return;

  const match = hoveredSlug ? CUA_MATCH(hoveredSlug) : null;

  map.setPaintProperty(
    "pipelines-history-halo",
    "circle-radius",
    match ? ["case", match, 34, 12] : 15,
  );
  map.setPaintProperty(
    "pipelines-history-halo",
    "circle-opacity",
    match ? ["case", match, 0.55, 0.08] : 0.15,
  );
  map.setPaintProperty(
    "pipelines-history-halo",
    "circle-stroke-width",
    match ? ["case", match, 2.5, 0] : 0,
  );
  map.setPaintProperty("pipelines-history-halo", "circle-stroke-color", "#ffffff");
  map.setPaintProperty(
    "pipelines-history-halo",
    "circle-stroke-opacity",
    match ? ["case", match, 0.95, 0] : 0,
  );

  map.setPaintProperty(
    "pipelines-history-point",
    "circle-radius",
    match ? ["case", match, 12, 6] : 8,
  );
  map.setPaintProperty(
    "pipelines-history-point",
    "circle-opacity",
    match ? ["case", match, 1, 0.4] : 1,
  );
  map.setPaintProperty(
    "pipelines-history-point",
    "circle-stroke-width",
    match ? ["case", match, 3, 1] : 1.5,
  );
}

/** Même dualité pour les pings d'identité foncière. */
export function applyIdentiteHistoryHoverHighlight(
  map: HistoryHoverMap,
  hoveredProjectId: string | null,
): void {
  if (
    !map.getLayer("identite-fonciere-history-halo") ||
    !map.getLayer("identite-fonciere-history-point")
  ) {
    return;
  }

  const match = hoveredProjectId
    ? (["==", ["get", "project_id"], hoveredProjectId] as const)
    : null;

  map.setPaintProperty(
    "identite-fonciere-history-halo",
    "circle-radius",
    match ? ["case", match, 34, 12] : 15,
  );
  map.setPaintProperty(
    "identite-fonciere-history-halo",
    "circle-opacity",
    match ? ["case", match, 0.5, 0.1] : 0.22,
  );
  map.setPaintProperty(
    "identite-fonciere-history-point",
    "circle-radius",
    match ? ["case", match, 12, 6] : 8,
  );
  map.setPaintProperty(
    "identite-fonciere-history-point",
    "circle-opacity",
    match ? ["case", match, 1, 0.4] : 1,
  );
}

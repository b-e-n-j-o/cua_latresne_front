import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as pmtiles from "pmtiles";
import * as turf from "@turf/turf";
import { useNavigate } from "react-router-dom";
import CartoLeftSidebar, { type CartoToolSection } from "../../../../components/carto/left-sidebar/CartoLeftSidebar";
import RightSidebarPatch from "../../../../components/carto/right-sidebar/RightSidebarPatch";
import ParcelleSearchForm from "../../../../components/tools/carto/ParcelleSearchform";
import SearchUniteFonciere from "../../../../components/tools/carto/SearchUniteFonciere";
import { type HistoryPipeline } from "../../../../components/tools/carto/HistoryPipelineCard";
import SuiviInstructionCard from "../../../../components/tools/carto/SuiviInstructionCard";
import UniteFonciereCard from "../../../../components/tools/carto/UniteFonciereCard";
import type { ParcelleInfo, ZonageInfo } from "../../../../types/parcelle";
import type { FullIntersectionsReport } from "../../../../types/fullIntersections";
import type { ParcelleResumeRef } from "../../../../types/sigResume";
import { buildIntersectionsReportFromCartoContext } from "../../../../utils/argeles/fullIntersections";
import ParcelleResumePanel from "./ParcelleResumePanel";
import supabase from "../../../../supabaseClient";
import { MapLoadingOverlay, MapTooltipOverlay, UfBuilderModeBanner } from "./ArgelesMapOverlays";
import type { IdentiteFonciereHistoryRow } from "../../../../components/carto/right-sidebar/CartoHistoryPanel";
import { CARTO_LAYERS } from "./cartoLayers";
import { mountAllCartoLayers, syncCartoOnMap } from "./cartoFilters";
import CartoLegendPanel from "./CartoLegendPanel";
import StudyZoneControls from "../../../../components/carto/studyZone/StudyZoneControls";
import StudyZoneLegendPanel from "../../../../components/carto/studyZone/StudyZoneLegendPanel";
import { fetchStudyZoneCarto } from "../../../../components/carto/studyZone/studyZoneApi";
import {
  applyStudyZoneToMap,
  buildBufferPolygon,
  clearStudyZoneFromMap,
  defaultVisibleLayerIds,
  filterStudyZoneContext,
  fitStudyZoneBounds,
  studyZoneLayerSummary,
  updateStudyZoneOnMap,
  type StudyZoneFilterOptions,
} from "../../../../components/carto/studyZone/studyZoneMap";
import { attachStudyZoneInteractions } from "../../../../components/carto/studyZone/studyZoneInteractions";
import { buildStudyZoneLegends } from "../../../../components/carto/studyZone/studyZoneLegend";
import { buildInitialVisibleGroups, mergeVisibleGroupKeys } from "../../../../components/carto/studyZone/studyZoneCarto";
import type { StudyZoneModeState } from "../../../../components/carto/studyZone/types";
import { studyZoneParcellesKey, STUDY_ZONE_BUFFER_MAX_DEFAULT, STUDY_ZONE_DISPLAY_CLIP_M, studyZoneLabel } from "../../../../components/carto/studyZone/types";

const cartoProtocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", cartoProtocol.tile);

const ARGELLES_BOUNDS: [number, number, number, number] = [
  3.005104, 42.531832, 3.063641, 42.559276,
];

const CADASTRE_HIT_LAYER_IDS = [
  "latresne_parcelles-fill",
  "latresne_parcelles-fill-hover",
  "latresne_parcelles-outline",
  "parcelle-search-fill",
  "parcelle-search-outline",
  "parcelle-target-fill",
  "parcelle-target",
  "parcelle-selected-fill",
  "parcelle-selected",
] as const;

const CADASTRE_LABEL_LAYER_IDS = [
  "latresne_parcelles-labels",
  "parcelle-search-labels",
] as const;

const MAP_UI_TOP_LAYER_IDS = [
  "uf-builder-fill",
  "uf-builder-outline",
  "uf-fill",
  "uf-outline",
  "cerfa-parcelles-fill",
  "cerfa-parcelles-outline",
  "history-pipeline-parcelles-fill",
  "history-pipeline-parcelles-outline",
  "pipelines-history-halo",
  "pipelines-history-point",
  "identite-fonciere-history-halo",
  "identite-fonciere-history-point",
] as const;

function moveLayerToTop(map: maplibregl.Map, layerId: string) {
  try {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  } catch {
    /* style en cours de chargement */
  }
}

function bringCadastreHitLayersToFront(map: maplibregl.Map) {
  for (const id of CADASTRE_HIT_LAYER_IDS) moveLayerToTop(map, id);
  for (const id of CADASTRE_LABEL_LAYER_IDS) moveLayerToTop(map, id);
  for (const id of MAP_UI_TOP_LAYER_IDS) moveLayerToTop(map, id);
}

/** Applique un paint uniquement si la couche existe (style IGN ≠ OSM). */
function setPaintPropertyIfExists(
  map: maplibregl.Map,
  layerId: string,
  property: string,
  value: unknown
): void {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    /* fond vectoriel pas encore prêt */
  }
}

function softenIgnBaseLayers(map: maplibregl.Map): void {
  setPaintPropertyIfExists(map, "water", "fill-opacity", 0.45);
  setPaintPropertyIfExists(map, "landcover", "fill-opacity", 0.35);
  setPaintPropertyIfExists(map, "building", "fill-opacity", 0.25);
}

const API_BASE = import.meta.env.VITE_API_BASE;
const ARG_CADASTRE_API_PATH = "/communes/argeles/parcelles/geojson";
const ARG_CADASTRE_FALLBACK_PATH = "/data/parcelles.geojson";
const ARG_CADASTRE_CACHE_NAME = "cua-cadastre-v2-geom";
const ARG_CADASTRE_CACHE_META_KEY = "cua-cadastre:argeles:last-sync-v2";
const ARG_CADASTRE_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h
let cadastreMemoryCache: GeoJSON.FeatureCollection | null = null;

function isFeatureCollection(value: unknown): value is GeoJSON.FeatureCollection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; features?: unknown };
  return candidate.type === "FeatureCollection" && Array.isArray(candidate.features);
}

async function readCadastreFromCache(apiUrl: string): Promise<GeoJSON.FeatureCollection | null> {
  try {
    if (typeof window === "undefined" || !("caches" in window)) return null;
    const lastSync = Number(window.localStorage.getItem(ARG_CADASTRE_CACHE_META_KEY) || "0");
    const isFresh = Number.isFinite(lastSync) && Date.now() - lastSync < ARG_CADASTRE_CACHE_TTL_MS;
    if (!isFresh) return null;

    const cache = await window.caches.open(ARG_CADASTRE_CACHE_NAME);
    const cached = await cache.match(apiUrl);
    if (!cached) return null;

    const data = (await cached.json()) as unknown;
    return isFeatureCollection(data) ? data : null;
  } catch {
    return null;
  }
}

async function writeCadastreToCache(apiUrl: string, data: GeoJSON.FeatureCollection): Promise<void> {
  try {
    if (typeof window === "undefined" || !("caches" in window)) return;
    const cache = await window.caches.open(ARG_CADASTRE_CACHE_NAME);
    await cache.put(
      apiUrl,
      new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      })
    );
    window.localStorage.setItem(ARG_CADASTRE_CACHE_META_KEY, String(Date.now()));
  } catch {
    // Cache navigateur facultatif: on n'interrompt pas le flux principal.
  }
}

async function fetchCadastreGeojson(): Promise<GeoJSON.FeatureCollection> {
  if (cadastreMemoryCache) return cadastreMemoryCache;

  const base = (API_BASE || "http://localhost:8000").replace(/\/$/, "");
  const apiUrl = `${base}${ARG_CADASTRE_API_PATH}`;

  const cached = await readCadastreFromCache(apiUrl);
  if (cached) {
    cadastreMemoryCache = cached;
    return cached;
  }

  let response = await fetch(apiUrl);
  if (!response.ok) {
    // Fallback local pour éviter un écran vide si backend indisponible.
    response = await fetch(ARG_CADASTRE_FALLBACK_PATH);
  }
  if (!response.ok) {
    throw new Error(`Chargement cadastre impossible (${response.status})`);
  }

  const data = (await response.json()) as unknown;
  if (!isFeatureCollection(data)) {
    throw new Error("Réponse cadastre invalide");
  }

  cadastreMemoryCache = data;
  // On ne persiste que les données API (pas le fallback local).
  if (response.url.includes(ARG_CADASTRE_API_PATH)) {
    await writeCadastreToCache(apiUrl, data);
  }
  return data;
}

function normalizeUfSection(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

function normalizeUfNumero(raw: unknown): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  return trimmed.padStart(4, "0");
}

function isTopFeatureFromLayer(
  map: maplibregl.Map,
  point: maplibregl.PointLike,
  layerId: "latresne_parcelles-fill" | "parcelle-search-fill"
): boolean {
  const hits = map.queryRenderedFeatures(point, {
    layers: ["parcelle-search-fill", "latresne_parcelles-fill"],
  });
  if (!hits.length) return false;
  return hits[0].layer.id === layerId;
}

function getPingColor(createdAt: string | undefined): "green" | "yellow" | "red" {
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

/** Centroïde CIF : Supabase peut renvoyer un objet ou une chaîne JSON. */
function parseIdentiteCentroid(raw: unknown): { lon: number; lat: number } | null {
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

function normalizeHistoryPipelines(pipelines: HistoryPipeline[]): HistoryPipeline[] {
  return pipelines.map((p) => {
    const centroid = getPipelineCentroid(p);
    return centroid ? { ...p, centroid } : p;
  });
}

function buildHistoryMapFeatures(pipelines: HistoryPipeline[]): GeoJSON.Feature[] {
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
          section: p.cerfa_data?.parcelles?.[0]?.section,
          numero: p.cerfa_data?.parcelles?.[0]?.numero,
          commune: p.commune,
          code_insee: p.code_insee,
          pingColor: getPingColor(p.created_at),
        },
      },
    ];
  });
}

const ARGELLES_INSEE = "66008";
const ARGELLES_COMMUNE = "Argelès-sur-Mer";

const PARCELLE_CLICK_ZOOM = 13;
const PARCELLE_LABEL_MIN_ZOOM = 16;
/** Zoom cible lors de la sélection d'une parcelle (clic ou recherche). */
const PARCELLE_SELECT_ZOOM = 17;

function zoomMapToParcelGeometry(map: maplibregl.Map, geometry: GeoJSON.Geometry): void {
  const center = turf.center(geometry);
  const coords = center.geometry.coordinates as [number, number];
  map.flyTo({
    center: coords,
    zoom: Math.max(map.getZoom(), PARCELLE_SELECT_ZOOM),
    duration: 900,
    essential: true,
  });
}

const PARCELLE_LABEL_LAYOUT: maplibregl.SymbolLayerSpecification["layout"] = {
  "text-field": [
    "concat",
    ["get", "section"],
    " ",
    ["get", "numero"],
  ],
  "text-size": 11,
  "text-font": ["Noto Sans Regular"],
  "text-allow-overlap": false,
  "text-padding": 2,
};

const PARCELLE_LABEL_PAINT: maplibregl.SymbolLayerSpecification["paint"] = {
  "text-color": "#1a1a1a",
  "text-halo-color": "#ffffff",
  "text-halo-width": 1.4,
};
const CARD_EST_HEIGHT = 380;
const CARD_WIDTH = 320;
const POPUP_GAP = 14;

function getPopupPlacement(_x: number, y: number, _containerW: number, containerH: number): "above" | "below" {
  const spaceAbove = y;
  const spaceBelow = containerH - y;
  if (spaceAbove >= CARD_EST_HEIGHT + POPUP_GAP) return "above";
  if (spaceBelow >= CARD_EST_HEIGHT + POPUP_GAP) return "below";
  return spaceBelow >= spaceAbove ? "below" : "above";
}

function clampPopupX(x: number, containerW: number): number {
  const half = CARD_WIDTH / 2;
  return Math.max(half, Math.min(containerW - half, x));
}

type UFState = {
  parcelles: Array<{
    section: string;
    numero: string;
    insee: string;
    commune: string;
    surface_m2?: number;
  }>;
  geometry: GeoJSON.Geometry;
  insee: string;
  commune: string;
};

export default function ArgelesPage() {
  const navigate = useNavigate();
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cadastreDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [cadastreData, setCadastreData] = useState<GeoJSON.FeatureCollection | null>(null);
  
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [selectedParcelle, setSelectedParcelle] = useState<ParcelleInfo | null>(null);
  const [currentZoom, setCurrentZoom] = useState(5.5);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [historyPingsLoaded, setHistoryPingsLoaded] = useState(false);
  const [historyPipelines, setHistoryPipelines] = useState<HistoryPipeline[]>([]);
  const [identiteFonciereHistory, setIdentiteFonciereHistory] = useState<IdentiteFonciereHistoryRow[]>([]);
  const [selectedHistoryPipeline, setSelectedHistoryPipeline] = useState<HistoryPipeline | null>(null);
  const [selectedIdentiteProjectId, setSelectedIdentiteProjectId] = useState<string | null>(null);
  const [historyPopupPosition, setHistoryPopupPosition] = useState<{ x: number; y: number; placement: "above" | "below" } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layerVisible, setLayerVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CARTO_LAYERS.map((l) => [l.id, l.defaultVisible]))
  );
  const [rightLegendOpen, setRightLegendOpen] = useState(true);
  const [showHistoryPings, setShowHistoryPings] = useState(true);
  const [isLoadingCadastre, setIsLoadingCadastre] = useState(true);
  const [ufState, setUfState] = useState<UFState | null>(null);
  const [historySidebarTab, setHistorySidebarTab] = useState<"cua" | "cif">("cua");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [studyZoneMode, setStudyZoneMode] = useState<StudyZoneModeState | null>(null);
  const [studyZoneLoading, setStudyZoneLoading] = useState(false);
  const [studyZoneError, setStudyZoneError] = useState<string | null>(null);
  const [intersectionsReport, setIntersectionsReport] = useState<FullIntersectionsReport | null>(null);
  const [intersectionsLoading, setIntersectionsLoading] = useState(false);
  const [intersectionsError, setIntersectionsError] = useState<string | null>(null);
  const studyZoneCacheRef = useRef<Map<string, StudyZoneModeState["context"]>>(new Map());
  const studyZoneInitialFitRef = useRef(false);
  const studyZonePopupRef = useRef<maplibregl.Popup | null>(null);
  const studyZoneDetachRef = useRef<(() => void) | null>(null);
  const studyZoneActiveRef = useRef(false);

  // Mode UF actif par défaut pour permettre la sélection au clic dès l'arrivée sur la page
  const [ufBuilderMode, setUfBuilderMode] = useState(true);
  const [selectedUfParcelles, setSelectedUfParcelles] = useState<
    Array<{
      section: string;
      numero: string;
      commune: string;
      insee: string;
      geometry: GeoJSON.Geometry;
      /** Carte vs saisie manuelle (liste séparée dans SearchUniteFonciere). */
      addedVia?: "map" | "manual";
    }>
  >([]);
  
  const ufBuilderModeRef = useRef(false);
  const ufStateRef = useRef<UFState | null>(null);
  const selectedUfParcellesRef = useRef<
    Array<{
      section: string;
      numero: string;
      commune: string;
      insee: string;
      geometry: GeoJSON.Geometry;
      addedVia?: "map" | "manual";
    }>
  >([]);
  
  const showParcelleResultRef = useRef<((geojson: any, addressPoint?: [number, number], targetZoom?: number) => void) | null>(null);
  const selectParcelleByRefRef = useRef<((section: string, numero: string) => Promise<void>) | null>(null);
  const getZonageForUFRef = useRef<((insee: string, parcelles: Array<{ section: string; numero: string }>) => Promise<ZonageInfo[]>) | null>(null);
  const showCerfaParcellesRef = useRef<((parcelles: Array<{ section: string; numero: string }>, commune: string, insee: string) => Promise<void>) | null>(null);
  const isHoveringHistoryPingRef = useRef(false);

  function toggleUfParcelle(next: {
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry: GeoJSON.Geometry;
    addedVia?: "map" | "manual";
  }) {
    const normSection = normalizeUfSection(next.section);
    const normNumero = normalizeUfNumero(next.numero);
    if (!normSection || !normNumero) return;

    setSelectedUfParcelles((prev) => {
      const idx = prev.findIndex(
        (p) =>
          normalizeUfSection(p.section) === normSection &&
          normalizeUfNumero(p.numero) === normNumero
      );
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      if (prev.length >= 20) {
        alert("Maximum 20 parcelles pour une unité foncière");
        return prev;
      }
      return [
        ...prev,
        {
          ...next,
          section: normSection,
          numero: normNumero,
        },
      ];
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (user) {
          setUserId(user.id || null);
          setUserEmail(user.email || null);
        }
      } catch (e) {
        console.error("Erreur récupération session Supabase dans ArgelesPage", e);
      }
    })();
  }, []);
  
  useEffect(() => {
    ufStateRef.current = ufState;
  }, [ufState]);
  
  useEffect(() => {
    ufBuilderModeRef.current = ufBuilderMode;
  }, [ufBuilderMode]);

  useEffect(() => {
    studyZoneActiveRef.current = !!studyZoneMode?.active;
  }, [studyZoneMode]);
  
  useEffect(() => {
    selectedUfParcellesRef.current = selectedUfParcelles;
  }, [selectedUfParcelles]);

  const historyPipelinesRef = useRef<HistoryPipeline[]>([]);
  useEffect(() => {
    historyPipelinesRef.current = historyPipelines;
  }, [historyPipelines]);

  const identiteFonciereHistoryRef = useRef<IdentiteFonciereHistoryRow[]>([]);
  useEffect(() => {
    identiteFonciereHistoryRef.current = identiteFonciereHistory;
  }, [identiteFonciereHistory]);

  const clearHistorySelection = () => {
    setSelectedHistoryPipeline(null);
    setHistoryPopupPosition(null);
  };

  const handleSelectHistoryFromSlug = (slug: string) => {
    const pipeline = historyPipelinesRef.current.find((p) => p.slug === slug);
    if (!pipeline) return;

    setHistorySidebarTab("cua");
    setSelectedIdentiteProjectId(null);
    setSelectedHistoryPipeline(pipeline);

    const map = mapRef.current;
    if (map && pipeline.centroid) {
      const [lon, lat] = [pipeline.centroid.lon, pipeline.centroid.lat];

      // Centrer la carte sur le projet sélectionné (même logique que le click sur le ping)
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 16), duration: 600 });

      // Positionner la popup "map"
      const point = map.project([lon, lat]);
      const container = map.getContainer();
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const placement = getPopupPlacement(point.x, point.y, cw, ch);
      const x = clampPopupX(point.x, cw);
      setHistoryPopupPosition({ x, y: point.y, placement });
    } else {
      setHistoryPopupPosition(null);
    }
  };

  const handleSelectIdentiteProject = (projectId: string) => {
    const row = identiteFonciereHistoryRef.current.find((p) => p.project_id === projectId);
    setHistorySidebarTab("cif");
    setSelectedIdentiteProjectId(projectId);
    setSelectedHistoryPipeline(null);
    setHistoryPopupPosition(null);

    const map = mapRef.current;
    const c = row ? parseIdentiteCentroid(row.centroid as unknown) : null;
    if (map && c) {
      map.flyTo({
        center: [c.lon, c.lat],
        zoom: Math.max(map.getZoom(), 16),
        duration: 600,
      });
    }
  };

  const updateHistoryPipelineInState = (slug: string, updater: (p: HistoryPipeline) => HistoryPipeline) => {
    setHistoryPipelines((prev) => prev.map((p) => (p.slug === slug ? updater(p) : p)));
    setSelectedHistoryPipeline((prev) => (prev && prev.slug === slug ? updater(prev) : prev));
    historyPipelinesRef.current = historyPipelinesRef.current.map((p) => (p.slug === slug ? updater(p) : p));
  };

  const handleUpdateHistoryProject = async (
    slug: string,
    payload: {
      cerfa_data: {
        demandeur?: string;
        numero_cu?: string;
        adresse_terrain?: {
          numero?: string;
          voie?: string;
          code_postal?: string;
          ville?: string;
        };
      };
    }
  ) => {
    const base = (API_BASE || "http://localhost:8000").replace(/\/$/, "");
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`${base}/pipelines/${slug}${qs}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.detail || data?.error || "Erreur de mise à jour");
    }

    updateHistoryPipelineInState(slug, (p) => ({
      ...p,
      cerfa_data: {
        ...(p.cerfa_data || {}),
        ...(payload.cerfa_data || {}),
        adresse_terrain: {
          ...(p.cerfa_data?.adresse_terrain || {}),
          ...(payload.cerfa_data?.adresse_terrain || {}),
        },
      },
    }));
  };

  const handleDeleteHistoryProject = async (slug: string) => {
    const base = (API_BASE || "http://localhost:8000").replace(/\/$/, "");
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`${base}/pipelines/${slug}${qs}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.detail || data?.error || "Erreur de suppression");
    }

    setHistoryPipelines((prev) => prev.filter((p) => p.slug !== slug));
    historyPipelinesRef.current = historyPipelinesRef.current.filter((p) => p.slug !== slug);
    if (selectedHistoryPipeline?.slug === slug) {
      clearHistorySelection();
    }
  };

  const refreshHistoryPipelines = async (focusSlug?: string) => {
    const map = mapRef.current;
    if (!map || !userId) return;
    try {
      const base = API_BASE.replace(/\/$/, "");
      const res = await fetch(`${base}/pipelines/by_user?user_id=${userId}&commune_slug=argeles`);
      const j = await res.json();
      if (!j.success || !Array.isArray(j.pipelines)) {
        console.warn("⚠️ Impossible de charger l'historique des pipelines pour la carte");
        return;
      }

      const normalized = normalizeHistoryPipelines(j.pipelines);
      setHistoryPipelines(normalized);

      const pipelinesWithCentroid = normalized.filter((p) => getPipelineCentroid(p) !== null);

      const features = buildHistoryMapFeatures(normalized);

      const source = map.getSource("pipelines-history") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features });
        bringCadastreHitLayersToFront(map);
      }

      if (focusSlug) {
        const created = pipelinesWithCentroid.find((p) => p.slug === focusSlug);
        if (created) {
          const centroid = getPipelineCentroid(created);
          if (!centroid) return;
          setSelectedHistoryPipeline(created);
          const point = map.project([centroid.lon, centroid.lat]);
          const container = map.getContainer();
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const placement = getPopupPlacement(point.x, point.y, cw, ch);
          const x = clampPopupX(point.x, cw);
          setHistoryPopupPosition({ x, y: point.y, placement });
          map.flyTo({
            center: [centroid.lon, centroid.lat],
            zoom: Math.max(map.getZoom(), 16),
            duration: 600,
          });
        }
      }
    } catch (e) {
      console.error("Erreur chargement des pings d'historique sur la carte:", e);
    }
  };

  const refreshIdentiteFonciereHistory = async () => {
    if (!userId) return;
    try {
      const base = (API_BASE || "http://localhost:8000").replace(/\/$/, "");
      const res = await fetch(
        `${base}/api/identite-fonciere/history/by_user?user_id=${encodeURIComponent(userId)}&limit=100`
      );
      const j = await res.json();
      if (!j.success || !Array.isArray(j.projects)) {
        if (j?.error) console.warn("Historique CIF:", j.error);
        return;
      }
      setIdentiteFonciereHistory(j.projects as IdentiteFonciereHistoryRow[]);
    } catch (e) {
      console.error("Historique CIF:", e);
    }
  };

  const handleDeleteIdentiteProject = async (projectId: string) => {
    if (!userId) throw new Error("Connexion requise.");
    const base = (API_BASE || "http://localhost:8000").replace(/\/$/, "");
    const res = await fetch(
      `${base}/api/identite-fonciere/history/${encodeURIComponent(projectId)}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
    let data: { success?: boolean; error?: string; detail?: string } = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      const msg =
        typeof data.detail === "string" ? data.detail : data.error || `Erreur ${res.status}`;
      throw new Error(msg);
    }
    if (!data.success) {
      throw new Error(data.error || "Échec de la suppression");
    }
    if (selectedIdentiteProjectId === projectId) {
      setSelectedIdentiteProjectId(null);
    }
    await refreshIdentiteFonciereHistory();
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let hoveredFeatureId: number | null = null;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json",
      bounds: ARGELLES_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      maxZoom: 22
    });
    mapRef.current = map;

    map.on("load", async () => {
      map.setZoom(14);
      setCurrentZoom(14);

      softenIgnBaseLayers(map);

      // Charger le cadastre depuis l'API avec cache navigateur + fallback local.
      setIsLoadingCadastre(true);
      let parcellesData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
      try {
        parcellesData = await fetchCadastreGeojson();
        cadastreDataRef.current = parcellesData;
        setCadastreData(parcellesData);
      } catch (err) {
        console.error("Erreur chargement cadastre:", err);
      }

      if (!map.getSource("latresne_parcelles")) {
        map.addSource("latresne_parcelles", { 
          type: "geojson", 
          data: parcellesData,
          generateId: true
        });

        map.addLayer({
          id: "latresne_parcelles-fill",
          type: "fill",
          source: "latresne_parcelles",
          paint: {
            "fill-color": "#000000",
            "fill-opacity": 0,
          },
        });

        map.addLayer({
          id: "latresne_parcelles-fill-hover",
          type: "fill",
          source: "latresne_parcelles",
          paint: {
            "fill-color": "#F97316",
            "fill-opacity": ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0]
          }
        });

        map.addLayer({
          id: "latresne_parcelles-outline",
          type: "line",
          source: "latresne_parcelles",
          paint: {
            "line-color": "#000000",
            "line-width": 1,
            "line-opacity": 0.8,
          },
        });

        map.addLayer({
          id: "latresne_parcelles-labels",
          type: "symbol",
          source: "latresne_parcelles",
          minzoom: PARCELLE_LABEL_MIN_ZOOM,
          layout: PARCELLE_LABEL_LAYOUT,
          paint: PARCELLE_LABEL_PAINT,
        });
      }
      setIsLoadingCadastre(false);

      mountAllCartoLayers(map);
      syncCartoOnMap(
        map,
        Object.fromEntries(CARTO_LAYERS.map((l) => [l.id, l.defaultVisible])),
        {},
        bringCadastreHitLayersToFront
      );

      // Sources supplémentaires
      map.addSource("parcelle-search", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "parcelle-search-fill",
        type: "fill",
        source: "parcelle-search",
        paint: { "fill-color": "#000000", "fill-opacity": 0 }
      });

      map.addLayer({
        id: "parcelle-search-outline",
        type: "line",
        source: "parcelle-search",
        paint: { "line-color": "#000000", "line-width": 1.2 }
      });

      map.addLayer({
        id: "parcelle-target-fill",
        type: "fill",
        source: "parcelle-search",
        filter: ["==", ["get", "is_target"], true],
        paint: { "fill-color": "#FFF8DC", "fill-opacity": 0.6 }
      });

      map.addLayer({
        id: "parcelle-target",
        type: "line",
        source: "parcelle-search",
        filter: ["==", ["get", "is_target"], true],
        paint: { "line-color": "#E53E3E", "line-width": 3 }
      });

      map.addLayer({
        id: "parcelle-selected-fill",
        type: "fill",
        source: "parcelle-search",
        filter: ["==", ["get", "section"], ""],
        paint: { "fill-color": "#FFF8DC", "fill-opacity": 0.6 }
      });

      map.addLayer({
        id: "parcelle-selected",
        type: "line",
        source: "parcelle-search",
        filter: ["==", ["get", "section"], ""],
        paint: { "line-color": "#E53E3E", "line-width": 3 }
      });

      map.addLayer({
        id: "parcelle-search-labels",
        type: "symbol",
        source: "parcelle-search",
        minzoom: PARCELLE_LABEL_MIN_ZOOM,
        layout: PARCELLE_LABEL_LAYOUT,
        paint: PARCELLE_LABEL_PAINT,
      });

      map.addSource("uf-builder", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "uf-builder-fill",
        type: "fill",
        source: "uf-builder",
        paint: { "fill-color": "#F97316", "fill-opacity": 0.4 }
      });

      map.addLayer({
        id: "uf-builder-outline",
        type: "line",
        source: "uf-builder",
        paint: { "line-color": "#EA580C", "line-width": 3, "line-opacity": 0.9 }
      });

      map.addSource("uf-active", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "uf-fill",
        type: "fill",
        source: "uf-active",
        paint: {
          "fill-color": "#f59e0b",
          "fill-opacity": 0.35
        }
      });

      map.addLayer({
        id: "uf-outline",
        type: "line",
        source: "uf-active",
        paint: {
          "line-color": "#b45309",
          "line-width": 2
        }
      });

      // Hover sur l'unité foncière active : afficher la liste des parcelles
      map.on("mousemove", "uf-fill", (e) => {
        if (!ufStateRef.current) return;
        const parcelles = ufStateRef.current.parcelles || [];
        if (parcelles.length === 0) return;

        map.getCanvas().style.cursor = "pointer";

        const labels = parcelles.map((p) => `${p.section} ${p.numero}`);
        const content =
          parcelles.length === 1
            ? `UF : ${labels[0]}`
            : `UF : ${labels.join(", ")}`;

        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content,
        });
      });

      map.on("mouseleave", "uf-fill", () => {
        if (!ufStateRef.current) return;
        map.getCanvas().style.cursor = "";
        setTooltip(null);
      });

      map.addSource("cerfa-parcelles", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "cerfa-parcelles-fill",
        type: "fill",
        source: "cerfa-parcelles",
        paint: { "fill-color": "#F97316", "fill-opacity": 0.4 }
      });

      map.addLayer({
        id: "cerfa-parcelles-outline",
        type: "line",
        source: "cerfa-parcelles",
        paint: { "line-color": "#EA580C", "line-width": 3, "line-opacity": 0.9 }
      });

      map.addSource("history-pipeline-parcelles", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "history-pipeline-parcelles-fill",
        type: "fill",
        source: "history-pipeline-parcelles",
        paint: { "fill-color": "#F97316", "fill-opacity": 0.4 }
      });

      map.addLayer({
        id: "history-pipeline-parcelles-outline",
        type: "line",
        source: "history-pipeline-parcelles",
        paint: { "line-color": "#EA580C", "line-width": 3, "line-opacity": 0.9 }
      });

      map.addSource("pipelines-history", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "pipelines-history-halo",
        type: "circle",
        source: "pipelines-history",
        paint: {
          "circle-radius": 15,
          "circle-color": ["match", ["get", "pingColor"], "green", "#22c55e", "yellow", "#eab308", "red", "#ef4444", "#0f766e"],
          "circle-opacity": 0.15,
        },
      });

      map.addLayer({
        id: "pipelines-history-point",
        type: "circle",
        source: "pipelines-history",
        paint: {
          "circle-radius": 8,
          "circle-color": ["match", ["get", "pingColor"], "green", "#22c55e", "yellow", "#eab308", "red", "#ef4444", "#0f766e"],
          "circle-opacity": 1,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Hover sur pings historiques
      map.on("mousemove", "pipelines-history-halo", (e) => {
        if (!e.features?.length) return;
        isHoveringHistoryPingRef.current = true;
        map.getCanvas().style.cursor = "pointer";
        const props = e.features[0].properties as any;
        const demandeur = String(props.demandeur || "").trim();
        const numeroCu = String(props.numero_cu || "").trim();
        const section = String(props.section || "").trim();
        const numero = String(props.numero || "").trim();
        const line1 = demandeur || "Projet precedent";
        const line2 =
          section && numero
            ? `Section ${section} - Parcelle ${numero}`
            : numeroCu
              ? `CU ${numeroCu}`
              : "Parcelle non renseignee";
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content: `${line1}\n${line2}`,
        });
      });

      map.on("mouseleave", "pipelines-history-halo", () => {
        isHoveringHistoryPingRef.current = false;
        map.getCanvas().style.cursor = "";
        setTooltip(null);
      });

      map.on("click", "pipelines-history-halo", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as any;
        const slug = props.slug;
        if (!slug) return;
        const pipeline = historyPipelinesRef.current.find((p: HistoryPipeline) => p.slug === slug);
        if (pipeline) {
          setHistorySidebarTab("cua");
          setSelectedIdentiteProjectId(null);
          setSelectedHistoryPipeline(pipeline);
          const container = map.getContainer();
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const placement = getPopupPlacement(e.point.x, e.point.y, cw, ch);
          const x = clampPopupX(e.point.x, cw);
          setHistoryPopupPosition({ x, y: e.point.y, placement });
          const [lon, lat] = (feature.geometry as GeoJSON.Point).coordinates;
          map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 16), duration: 600 });
        }
      });

      map.addSource("identite-fonciere-history", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "identite-fonciere-history-halo",
        type: "circle",
        source: "identite-fonciere-history",
        paint: {
          "circle-radius": 15,
          "circle-color": "#7c3aed",
          "circle-opacity": 0.22,
        },
      });

      map.addLayer({
        id: "identite-fonciere-history-point",
        type: "circle",
        source: "identite-fonciere-history",
        paint: {
          "circle-radius": 8,
          "circle-color": "#7c3aed",
          "circle-opacity": 1,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("mousemove", "identite-fonciere-history-halo", (e) => {
        if (!e.features?.length) return;
        isHoveringHistoryPingRef.current = true;
        map.getCanvas().style.cursor = "pointer";
        const props = e.features[0].properties as Record<string, unknown>;
        const label = String(props.parcelle_label || "").trim() || "Identité foncière";
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content: `${label}\nCIF`,
        });
      });

      map.on("mouseleave", "identite-fonciere-history-halo", () => {
        isHoveringHistoryPingRef.current = false;
        map.getCanvas().style.cursor = "";
        setTooltip(null);
      });

      map.on("click", "identite-fonciere-history-halo", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as Record<string, unknown>;
        const projectId = String(props.project_id || "").trim();
        if (!projectId) return;
        setHistorySidebarTab("cif");
        setSelectedHistoryPipeline(null);
        setHistoryPopupPosition(null);
        setSelectedIdentiteProjectId(projectId);
        setRightLegendOpen(true);
        const [lon, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 16), duration: 600 });
      });

      // Hover sur cadastre avec feature-state
      map.on("mousemove", "latresne_parcelles-fill", (e) => {
        if (isHoveringHistoryPingRef.current) return;
        if (ufStateRef.current) return;
        if (studyZoneActiveRef.current) {
          map.getCanvas().style.cursor = "not-allowed";
          setTooltip({
            x: e.point.x,
            y: e.point.y,
            content: "Mode zone d'étude — quittez pour changer de parcelle",
          });
          return;
        }
        if (!e.features?.length) return;
        
        const feature = e.features[0];
        const props = feature.properties as any;

        if (hoveredFeatureId !== null) {
          map.setFeatureState(
            { source: 'latresne_parcelles', id: hoveredFeatureId },
            { hover: false }
          );
        }

        hoveredFeatureId = feature.id as number;
        map.setFeatureState(
          { source: 'latresne_parcelles', id: hoveredFeatureId },
          { hover: true }
        );

        map.getCanvas().style.cursor = "pointer";
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content: `Section ${props?.section ?? ""} – Parcelle ${props?.numero ?? ""}`
        });
      });

      map.on("mouseleave", "latresne_parcelles-fill", () => {
        if (ufStateRef.current) return;
        
        if (hoveredFeatureId !== null) {
          map.setFeatureState(
            { source: 'latresne_parcelles', id: hoveredFeatureId },
            { hover: false }
          );
        }
        hoveredFeatureId = null;
        
        map.getCanvas().style.cursor = "";
        setTooltip(null);
      });

      async function selectParcelleFromFeature(feature: GeoJSON.Feature) {
        if (studyZoneActiveRef.current) return;
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        const geometry = feature.geometry;
        if (!geometry) return;

        const normalizedSection = normalizeUfSection(props.section);
        const normalizedNumero = normalizeUfNumero(props.numero);
        const insee = String(props.insee ?? props.code_insee ?? ARGELLES_INSEE);
        const commune = String(props.commune ?? ARGELLES_COMMUNE);

        zoomMapToParcelGeometry(map, geometry as GeoJSON.Geometry);

        if (ufBuilderModeRef.current) {
          toggleUfParcelle({
            section: normalizedSection,
            numero: normalizedNumero,
            commune,
            insee,
            geometry: geometry as GeoJSON.Geometry,
            addedVia: "map",
          });
          return;
        }

        const searchSource = map.getSource("parcelle-search") as maplibregl.GeoJSONSource | undefined;
        if (searchSource) {
          searchSource.setData({
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              geometry: geometry as GeoJSON.Geometry,
              properties: {
                ...props,
                section: props.section,
                numero: props.numero,
                commune,
                insee,
                code_insee: insee,
                is_target: true,
              },
            }],
          });
        }

        const zonageData = await getZonageAtPoint(
          insee,
          String(props.section ?? ""),
          String(props.numero ?? "")
        );

        setSelectedParcelle({
          section: String(props.section ?? ""),
          numero: String(props.numero ?? ""),
          commune,
          insee,
          surface: props.contenance ? Number(props.contenance) : undefined,
          zonage: zonageData?.etiquette,
          zonages: zonageData
            ? [{
                section: String(props.section ?? ""),
                numero: String(props.numero ?? ""),
                typezone: zonageData.typezone,
                etiquette: zonageData.etiquette,
                libelle: zonageData.libelle,
                libelong: zonageData.libelong,
              }]
            : undefined,
        });
      }

      async function selectParcelleByRef(section: string, numero: string) {
        const normSection = normalizeUfSection(section);
        const normNumero = normalizeUfNumero(numero);

        const cadastre = cadastreDataRef.current;
        const fromCadastre = cadastre?.features.find((f) => {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          return (
            normalizeUfSection(p.section) === normSection &&
            normalizeUfNumero(p.numero) === normNumero
          );
        });

        if (fromCadastre) {
          await selectParcelleFromFeature(fromCadastre);
          return;
        }

        const params = new URLSearchParams({
          code_insee: ARGELLES_INSEE,
          section: normSection,
          numero: normNumero,
          commune: ARGELLES_COMMUNE,
        });
        const res = await fetch(`${API_BASE}/parcelle/et-voisins?${params}`);
        if (!res.ok) throw new Error("Parcelle introuvable");

        const data = await res.json();
        const features: GeoJSON.Feature[] = Array.isArray(data.features) ? data.features : [];
        const target =
          features.find((f) => (f.properties as Record<string, unknown>)?.is_target === true) ??
          features.find((f) => {
            const p = (f.properties ?? {}) as Record<string, unknown>;
            return (
              normalizeUfSection(p.section) === normSection &&
              normalizeUfNumero(p.numero) === normNumero
            );
          });

        if (!target) throw new Error("Parcelle introuvable");
        await selectParcelleFromFeature(target);
      }

      selectParcelleByRefRef.current = selectParcelleByRef;

      // Click sur cadastre
      map.on("click", "latresne_parcelles-fill", async (e) => {
        if (!isTopFeatureFromLayer(map, e.point, "latresne_parcelles-fill")) return;
        const feature = e.features?.[0];
        if (!feature) return;
        await selectParcelleFromFeature(feature as GeoJSON.Feature);
      });

      // Hover/click sur résultats recherche
      map.on("mousemove", "parcelle-search-fill", (e) => {
        if (studyZoneActiveRef.current) {
          map.getCanvas().style.cursor = "not-allowed";
          return;
        }
        if (!e.features?.length) return;
        const feature = e.features[0];
        const props = feature.properties as any;
        
        map.getCanvas().style.cursor = "pointer";
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content: `Section ${props.section} – Parcelle ${props.numero}`
        });
      });

      map.on("mouseleave", "parcelle-search-fill", () => {
        map.getCanvas().style.cursor = "";
        setTooltip(null);
      });

      map.on("click", "parcelle-search-fill", async (e) => {
        if (!isTopFeatureFromLayer(map, e.point, "parcelle-search-fill")) return;
        const feature = e.features?.[0];
        if (!feature) return;
        await selectParcelleFromFeature(feature as GeoJSON.Feature);
      });

      function showParcelleResult(geojson: any, addressPoint?: [number, number], targetZoom?: number) {
        if (map.getSource("address-point")) {
          if (map.getLayer("address-ping")) map.removeLayer("address-ping");
          if (map.getLayer("address-halo")) map.removeLayer("address-halo");
          map.removeSource("address-point");
        }
        
        if (!geojson?.features?.length) {
          const source = map.getSource("parcelle-search") as maplibregl.GeoJSONSource;
          if (source) source.setData({ type: "FeatureCollection", features: [] });
          return;
        }

        const source = map.getSource("parcelle-search") as maplibregl.GeoJSONSource;
        if (source) source.setData(geojson);

        if (addressPoint) {
          map.addSource("address-point", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                geometry: { type: "Point", coordinates: addressPoint },
                properties: {}
              }]
            }
          });

          map.addLayer({
            id: "address-halo",
            type: "circle",
            source: "address-point",
            paint: {
              "circle-radius": 14,
              "circle-color": "#E53E3E",
              "circle-opacity": 0.15
            }
          });

          map.addLayer({
            id: "address-ping",
            type: "circle",
            source: "address-point",
            paint: {
              "circle-radius": 6,
              "circle-color": "#E53E3E",
              "circle-opacity": 1,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF"
            }
          });
        }

        const bounds = turf.bbox(geojson);
        if (targetZoom !== undefined) {
          const center = turf.center(geojson);
          map.easeTo({
            center: center.geometry.coordinates as [number, number],
            zoom: targetZoom,
            duration: 800
          });
        } else {
          map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {
            padding: 100,
            maxZoom: 18,
            duration: 800
          });
        }
      }

      showParcelleResultRef.current = showParcelleResult;

      async function getZonageAtPoint(insee: string, section: string, numero: string) {
        try {
          const res = await fetch(`${API_BASE}/zonage-plui/${insee}/${section}/${numero}`);
          if (!res.ok) return null;
          const data = await res.json();
          if (!data.typezone || !data.etiquette) return null;
          return {
            typezone: data.typezone,
            etiquette: data.etiquette,
            libelle: data.libelle,
            libelong: data.libelong
          };
        } catch {
          return null;
        }
      }

      async function getZonageForUF(insee: string, parcelles: Array<{ section: string; numero: string }>) {
        if (import.meta.env.VITE_ENABLE_ZONAGE_PLUI_UF !== "true") {
          return [];
        }
        try {
          const res = await fetch(`${API_BASE}/zonage-plui/uf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ insee, parcelles })
          });
          if (!res.ok) return [];
          const data = await res.json();
          return data.parcelles.map((p: any) => ({
            section: p.section,
            numero: p.numero,
            typezone: p.typezone || undefined,
            etiquette: p.etiquette || undefined,
            libelle: p.libelle || undefined,
            libelong: p.libelong || undefined
          }));
        } catch {
          return [];
        }
      }
      
      getZonageForUFRef.current = getZonageForUF;

      async function showCerfaParcelles(
        parcelles: Array<{ section: string; numero: string }>,
        commune: string,
        insee: string
      ) {
        if (!cadastreDataRef.current) return;

        const features: GeoJSON.Feature[] = [];
        
        for (const parcelle of parcelles) {
          const found = cadastreDataRef.current.features.find((f: any) => 
            f.properties?.section === parcelle.section && 
            f.properties?.numero === parcelle.numero
          );
          
          if (found) {
            features.push({
              type: "Feature",
              geometry: found.geometry,
              properties: {
                section: parcelle.section,
                numero: parcelle.numero,
                commune,
                insee
              }
            });
          }
        }

        if (features.length > 0) {
          const source = map.getSource("cerfa-parcelles") as maplibregl.GeoJSONSource;
          if (source) {
            source.setData({
              type: "FeatureCollection",
              features
            });

            map.setLayoutProperty("cerfa-parcelles-fill", "visibility", "visible");
            map.setLayoutProperty("cerfa-parcelles-outline", "visibility", "visible");

            if (features.length === 1) {
              const bbox = turf.bbox(features[0].geometry);
              map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
                padding: 100,
                maxZoom: 18,
                duration: 800
              });
            } else {
              const bbox = turf.bbox({
                type: "FeatureCollection",
                features
              });
              map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
                padding: 100,
                maxZoom: 18,
                duration: 800
              });
            }
          }
        }
      }

      showCerfaParcellesRef.current = showCerfaParcelles;

      bringCadastreHitLayersToFront(map);

      map.on("zoom", () => setCurrentZoom(map.getZoom()));
      map.on("zoomend", () => {
        const zoom = map.getZoom();
        setCurrentZoom(zoom);
      });

      setMapReady(true);
    });

    return () => {
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !mapReady) return;
    const on = layerVisible.parcelles !== false;
    const vis: "visible" | "none" = on ? "visible" : "none";
    for (const id of [
      "latresne_parcelles-fill",
      "latresne_parcelles-fill-hover",
      "latresne_parcelles-outline",
      "latresne_parcelles-labels",
    ]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
  }, [layerVisible.parcelles, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !userId || historyPingsLoaded) return;

    const loadHistoryPings = async () => {
      await refreshHistoryPipelines();
      await refreshIdentiteFonciereHistory();
      setHistoryPingsLoaded(true);
    };

    loadHistoryPings();
  }, [mapReady, userId, historyPingsLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("pipelines-history") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features = buildHistoryMapFeatures(historyPipelines);

    source.setData({ type: "FeatureCollection", features });
    bringCadastreHitLayersToFront(map);
  }, [historyPipelines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("identite-fonciere-history") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features: GeoJSON.Feature[] = identiteFonciereHistory
      .map((r) => {
        const c = parseIdentiteCentroid(r.centroid as unknown);
        if (!c) return null;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [c.lon, c.lat] },
          properties: {
            project_id: r.project_id,
            parcelle_label: r.parcelle_label ?? "",
          },
        } as GeoJSON.Feature;
      })
      .filter((f): f is GeoJSON.Feature => f != null);

    source.setData({ type: "FeatureCollection", features });
  }, [identiteFonciereHistory]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    if (selectedParcelle) {
      const filter: any = [
        "all",
        ["==", ["get", "section"], selectedParcelle.section],
        ["==", ["get", "numero"], selectedParcelle.numero]
      ];
      if (map.getLayer("parcelle-selected")) {
        map.setFilter("parcelle-selected", filter);
        map.setFilter("parcelle-selected-fill", filter);
      }
    } else {
      if (map.getLayer("parcelle-selected")) {
        const emptyFilter: any = ["==", ["get", "section"], ""];
        map.setFilter("parcelle-selected", emptyFilter);
        map.setFilter("parcelle-selected-fill", emptyFilter);
      }
    }
  }, [selectedParcelle]);

  useEffect(() => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource("uf-builder") as maplibregl.GeoJSONSource;
    if (!source) return;
    
    source.setData({
      type: "FeatureCollection",
      features: selectedUfParcelles.map(p => ({
        type: "Feature",
        geometry: p.geometry,
        properties: { section: p.section, numero: p.numero }
      }))
    });
  }, [selectedUfParcelles]);

  useEffect(() => {
    if (!mapRef.current) return;
    const visibility = ufBuilderMode ? "visible" : "none";
    if (mapRef.current.getLayer("uf-builder-fill")) {
      mapRef.current.setLayoutProperty("uf-builder-fill", "visibility", visibility);
      mapRef.current.setLayoutProperty("uf-builder-outline", "visibility", visibility);
    }
  }, [ufBuilderMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const cuaVis = showHistoryPings && historySidebarTab === "cua" ? "visible" : "none";
    const cifVis = showHistoryPings && historySidebarTab === "cif" ? "visible" : "none";
    for (const id of ["pipelines-history-halo", "pipelines-history-point"] as const) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", cuaVis);
    }
    for (const id of ["identite-fonciere-history-halo", "identite-fonciere-history-point"] as const) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", cifVis);
    }
  }, [showHistoryPings, historySidebarTab]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource("uf-active") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (!ufState) {
      source.setData({
        type: "FeatureCollection",
        features: []
      });
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: ufState.geometry,
          properties: {
            insee: ufState.insee,
            commune: ufState.commune
          }
        }
      ]
    });

    const feature: GeoJSON.Feature = {
      type: "Feature",
      geometry: ufState.geometry,
      properties: {}
    };

    const bbox = turf.bbox(feature as any);

    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]]
      ],
      { padding: 60 }
    );
  }, [ufState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedHistoryPipeline?.centroid || !historyPopupPosition) return;
    const c = selectedHistoryPipeline.centroid;
    const updatePosition = () => {
      const point = map.project([c.lon, c.lat]);
      const container = map.getContainer();
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const placement = getPopupPlacement(point.x, point.y, cw, ch);
      const x = clampPopupX(point.x, cw);
      setHistoryPopupPosition(prev => prev ? { ...prev, x, y: point.y, placement } : null);
    };
    map.on("moveend", updatePosition);
    map.on("zoomend", updatePosition);
    return () => {
      map.off("moveend", updatePosition);
      map.off("zoomend", updatePosition);
    };
  }, [selectedHistoryPipeline?.centroid]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("history-pipeline-parcelles") as maplibregl.GeoJSONSource | undefined;
    if (!map || !source || !cadastreDataRef.current) return;

    if (!selectedHistoryPipeline?.cerfa_data?.parcelles?.length) {
      source.setData({ type: "FeatureCollection", features: [] });
      map.setLayoutProperty("history-pipeline-parcelles-fill", "visibility", "none");
      map.setLayoutProperty("history-pipeline-parcelles-outline", "visibility", "none");
      return;
    }

    const parcelles = selectedHistoryPipeline.cerfa_data.parcelles;
    const features: GeoJSON.Feature[] = [];

    for (const p of parcelles) {
      const found = cadastreDataRef.current.features.find((f: any) =>
        f.properties?.section === p.section && f.properties?.numero === p.numero
      );
      if (found) {
        features.push({
          type: "Feature",
          geometry: found.geometry,
          properties: { section: p.section, numero: p.numero }
        });
      }
    }

    if (features.length > 0) {
      source.setData({ type: "FeatureCollection", features });
      map.setLayoutProperty("history-pipeline-parcelles-fill", "visibility", "visible");
      map.setLayoutProperty("history-pipeline-parcelles-outline", "visibility", "visible");
    }
  }, [selectedHistoryPipeline]);

  const resumeParcelles = useMemo((): ParcelleResumeRef[] | null => {
    if (ufState?.parcelles?.length) {
      return ufState.parcelles.map((p) => ({
        section: p.section,
        numero: p.numero,
        commune: ufState.commune,
        insee: ufState.insee,
        surface_m2: p.surface_m2,
      }));
    }
    if (ufBuilderMode && selectedUfParcelles.length > 0) {
      return selectedUfParcelles.map((p) => ({
        section: p.section,
        numero: p.numero,
        commune: p.commune,
        insee: p.insee,
      }));
    }
    if (selectedParcelle?.isUF && selectedParcelle.ufParcelles?.length) {
      return selectedParcelle.ufParcelles.map((p) => ({
        section: p.section,
        numero: p.numero,
        commune: p.commune ?? selectedParcelle.commune,
        insee: p.insee ?? selectedParcelle.insee,
      }));
    }
    if (selectedParcelle && !selectedParcelle.isUF) {
      return [
        {
          section: selectedParcelle.section,
          numero: selectedParcelle.numero,
          commune: selectedParcelle.commune,
          insee: selectedParcelle.insee,
          surface_m2: selectedParcelle.surface,
        },
      ];
    }
    return null;
  }, [ufState, ufBuilderMode, selectedUfParcelles, selectedParcelle]);

  const isDraftUfResume = Boolean(
    ufBuilderMode && selectedUfParcelles.length > 0 && !ufState
  );

  const resumeParcellesKey = useMemo(() => {
    if (!resumeParcelles?.length) return "";
    return studyZoneParcellesKey(resumeParcelles);
  }, [resumeParcelles]);

  const exitStudyZone = useCallback(() => {
    studyZoneDetachRef.current?.();
    studyZoneDetachRef.current = null;
    studyZonePopupRef.current?.remove();
    studyZonePopupRef.current = null;
    const map = mapRef.current;
    if (map?.isStyleLoaded()) {
      clearStudyZoneFromMap(map);
      syncCartoOnMap(map, layerVisible, {}, bringCadastreHitLayersToFront);
    }
    setStudyZoneMode(null);
    studyZoneInitialFitRef.current = false;
    setStudyZoneError(null);
    setStudyZoneLoading(false);
    setIntersectionsReport(null);
    setIntersectionsLoading(false);
    setIntersectionsError(null);
  }, [layerVisible]);

  const enterStudyZone = useCallback(async (force = false) => {
    if (!resumeParcelles?.length || studyZoneLoading) return;
    const cacheKey = `${resumeParcellesKey}@clip${STUDY_ZONE_DISPLAY_CLIP_M}`;
    setStudyZoneLoading(true);
    setStudyZoneError(null);
    setIntersectionsLoading(true);
    setIntersectionsError(null);
    setIntersectionsReport(null);
    try {
      if (force) studyZoneCacheRef.current.delete(cacheKey);
      let context = studyZoneCacheRef.current.get(cacheKey);
      if (!context) {
        context = await fetchStudyZoneCarto("argeles", resumeParcelles);
        studyZoneCacheRef.current.set(cacheKey, context);
      }
      const bufferM = Math.min(context.context_buffer_max_m, STUDY_ZONE_BUFFER_MAX_DEFAULT);
      const visibleLayerIds = defaultVisibleLayerIds(context);
      const baseFiltered = filterStudyZoneContext(context, {
        bufferM,
        visibleLayerIds,
        visibleGroups: {},
      });
      const legends = buildStudyZoneLegends(context, baseFiltered);
      const visibleGroups = buildInitialVisibleGroups(context, legends);

      setStudyZoneMode({
        active: true,
        parcellesKey: resumeParcellesKey,
        context,
        bufferM,
        visibleLayerIds,
        visibleGroups,
        highlightFid: null,
      });
      studyZoneInitialFitRef.current = true;
    } catch (err) {
      setStudyZoneError(err instanceof Error ? err.message : "Erreur carto zone d'étude");
      setStudyZoneLoading(false);
      setIntersectionsLoading(false);
      setIntersectionsError(err instanceof Error ? err.message : "Erreur analyse SIG");
    }
  }, [resumeParcelles, resumeParcellesKey, studyZoneLoading]);

  const studyFilterOpts = useMemo((): StudyZoneFilterOptions | null => {
    if (!studyZoneMode?.active) return null;
    return {
      bufferM: studyZoneMode.bufferM,
      visibleLayerIds: studyZoneMode.visibleLayerIds,
      visibleGroups: studyZoneMode.visibleGroups,
    };
  }, [studyZoneMode]);

  const studyFiltered = useMemo(() => {
    if (!studyZoneMode?.active || !studyFilterOpts) return null;
    return filterStudyZoneContext(studyZoneMode.context, studyFilterOpts);
  }, [studyZoneMode, studyFilterOpts]);

  const studyLayerLegends = useMemo(() => {
    if (!studyZoneMode?.active || !studyFiltered) return [];
    return buildStudyZoneLegends(studyZoneMode.context, studyFiltered);
  }, [studyZoneMode, studyFiltered]);

  useEffect(() => {
    if (!studyZoneMode?.active || !studyLayerLegends.length) return;
    setStudyZoneMode((prev) => {
      if (!prev?.active) return prev;
      const merged = mergeVisibleGroupKeys(prev.visibleGroups, studyLayerLegends);
      const unchanged = Object.keys(merged).every((layerId) => {
        const before = prev.visibleGroups[layerId];
        const after = merged[layerId];
        if (!before && !after) return true;
        if (!before || !after || before.size !== after.size) return false;
        for (const k of before) if (!after.has(k)) return false;
        return true;
      });
      if (unchanged && Object.keys(prev.visibleGroups).length === Object.keys(merged).length) {
        return prev;
      }
      return { ...prev, visibleGroups: merged };
    });
  }, [studyZoneMode?.active, studyLayerLegends]);

  const studyBufferPoly = useMemo(() => {
    if (!studyZoneMode?.active) return null;
    return buildBufferPolygon(studyZoneMode.context.parcelle, studyZoneMode.bufferM);
  }, [studyZoneMode]);

  const studyLayerRows = useMemo(() => {
    if (!studyZoneMode?.active || !studyFiltered) return [];
    return studyZoneLayerSummary(studyZoneMode.context).map((row) => ({
      layerId: row.layerId,
      title: row.title,
      family: row.family,
      familyTitle: row.familyTitle,
      parcelHits: row.parcelHits,
      visibleCount: studyFiltered[row.layerId]?.length ?? 0,
    }));
  }, [studyZoneMode, studyFiltered]);

  useEffect(() => {
    if (!studyZoneMode?.active) return;
    if (resumeParcellesKey && studyZoneMode.parcellesKey !== resumeParcellesKey) {
      exitStudyZone();
    }
  }, [studyZoneMode, resumeParcellesKey, exitStudyZone]);

  useEffect(() => {
    if (!studyZoneMode?.active || studyZoneLoading) return;
    try {
      const report = buildIntersectionsReportFromCartoContext(studyZoneMode.context);
      setIntersectionsReport(report);
      setIntersectionsError(null);
    } catch (err) {
      setIntersectionsReport(null);
      setIntersectionsError(err instanceof Error ? err.message : "Erreur analyse SIG");
    } finally {
      setIntersectionsLoading(false);
    }
  }, [studyZoneMode, studyZoneLoading]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !studyZoneMode?.active || !studyFiltered) return;

    const apply = () => {
      if (studyZoneInitialFitRef.current) {
        applyStudyZoneToMap(
          map,
          studyZoneMode.context,
          studyFiltered,
          studyBufferPoly,
          studyZoneMode.visibleGroups
        );
        fitStudyZoneBounds(map, studyZoneMode.context.parcelle, studyFiltered);
        studyZoneInitialFitRef.current = false;
        setStudyZoneLoading(false);
      } else {
        updateStudyZoneOnMap(
          map,
          studyZoneMode.context,
          studyFiltered,
          studyBufferPoly,
          studyZoneMode.visibleGroups
        );
      }
      studyZoneDetachRef.current?.();
      studyZoneDetachRef.current = attachStudyZoneInteractions(
        map,
        studyZoneMode.context,
        studyZonePopupRef
      );
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [mapReady, studyZoneMode, studyFiltered, studyBufferPoly]);

  const sidebarSections: CartoToolSection[] = [
    {
      id: "search-uf",
      title: "Certificat d'Urbanisme (CUA) / Carte d'Identité Foncière (CIF)",
      defaultOpen: true,
      content: (
        <SearchUniteFonciere
          ufBuilderMode={ufBuilderMode}
          selectedUfParcelles={selectedUfParcelles}
          onUfBuilderToggle={setUfBuilderMode}
          onUfParcelleRemove={(section, numero) => {
            setSelectedUfParcelles((prev) =>
              prev.filter(
                (p) =>
                  !(
                    normalizeUfSection(p.section) === normalizeUfSection(section) &&
                    normalizeUfNumero(p.numero) === normalizeUfNumero(numero)
                  )
              )
            );
          }}
          onAddManualUfParcelleToMap={(section, numero, inseeInput) => {
            const cadastre = cadastreDataRef.current;
            if (!cadastre) return;
            const normalizedSection = normalizeUfSection(section);
            const normalizedNumero = normalizeUfNumero(numero);
            const normalizedInsee = (inseeInput || "").trim();

            if (selectedUfParcelles.length >= 20) {
              alert("Maximum 20 parcelles pour une unité foncière");
              return;
            }

            const alreadySelected = selectedUfParcelles.some(
              (p) =>
                normalizeUfSection(p.section) === normalizedSection &&
                normalizeUfNumero(p.numero) === normalizedNumero
            );
            if (alreadySelected) return;

            const found = cadastre.features.find((f: any) => {
              const sameSectionNumero =
                normalizeUfSection(f.properties?.section) === normalizedSection &&
                normalizeUfNumero(f.properties?.numero) === normalizedNumero;
              if (!sameSectionNumero) return false;
              if (!normalizedInsee) return true;
              return String(f.properties?.insee || "").trim() === normalizedInsee;
            });

            if (!found || !found.geometry) {
              alert("Parcelle introuvable dans le cadastre local");
              return;
            }

            const props: any = found.properties || {};

            setSelectedUfParcelles((prev) => [
              ...prev,
              {
                section: normalizedSection,
                numero: normalizedNumero,
                commune: props.commune || "Argeles",
                insee: normalizedInsee || props.insee || "66008",
                geometry: found.geometry as GeoJSON.Geometry,
                addedVia: "manual",
              },
            ]);
          }}
          onConfirmUF={async (parcelles, unionGeometry, commune, insee) => {
            const zonages =
              (await getZonageForUFRef.current?.(insee, parcelles)) || [];

            setSelectedParcelle({
              section: parcelles.map((p) => p.section).join("+"),
              numero: parcelles.map((p) => p.numero).join("+"),
              commune,
              insee,
              isUF: true,
              ufParcelles: parcelles,
              ufUnionGeometry: unionGeometry,
              zonages,
            });

            const parcellesWithSurface = parcelles.map((p) => {
              const found = selectedUfParcelles.find(
                (sp) => sp.section === p.section && sp.numero === p.numero
              );
              let surface_m2: number | undefined;
              if (found?.geometry) {
                try {
                  surface_m2 = turf.area(found.geometry as any);
                } catch {
                  surface_m2 = undefined;
                }
              }
              return {
                ...p,
                surface_m2,
              };
            });

            setUfState({
              parcelles: parcellesWithSurface,
              geometry: unionGeometry,
              commune,
              insee,
            });

            const source = mapRef.current?.getSource(
              "uf-builder"
            ) as maplibregl.GeoJSONSource;
            if (source)
              source.setData({
                type: "FeatureCollection",
                features: [],
              });
            setUfBuilderMode(false);
            setSelectedUfParcelles([]);
          }}
          embedded={true}
        />
      ),
    },
    ...(ufState
      ? [
          {
            id: "uf",
            title: "Unité foncière active",
            defaultOpen: true,
            content: (
              <UniteFonciereCard
                ufParcelles={ufState.parcelles}
                commune={ufState.commune}
                insee={ufState.insee}
                unionGeometry={ufState.geometry}
                userId={userId}
                userEmail={userEmail}
                onIdentitePublished={() => {
                  void refreshIdentiteFonciereHistory();
                }}
                onPipelineCreated={(newSlug) => {
                  console.log("[CUA] Redirection vers page projet (UF)", { newSlug });
                  refreshHistoryPipelines(newSlug);
                  navigate(`/argeles/cua/projects/${newSlug}`);
                }}
                onParcellesDetected={async (parcelles, commune, insee) => {
                  if (showCerfaParcellesRef.current) {
                    await showCerfaParcellesRef.current(parcelles, commune, insee);
                  }
                }}
                onClose={() => {
                  setUfState(null);
                  setSelectedParcelle(null);
                  const source = mapRef.current?.getSource("uf-active") as maplibregl.GeoJSONSource;
                  if (source) {
                    source.setData({
                      type: "FeatureCollection",
                      features: [],
                    });
                  }
                }}
                dbSchema="argeles"
                communeSlug="argeles"
                embedded={true}
              />
            ),
          } as CartoToolSection,
        ]
      : []),
    ...(selectedHistoryPipeline
      ? [
          {
            id: "suivi",
            title: "Suivi du dossier",
            defaultOpen: true,
            content: (
              <SuiviInstructionCard
                pipeline={selectedHistoryPipeline}
                onSuiviChange={async (suivi) => {
                  const base = (API_BASE || "http://localhost:8000").replace(/\/$/, "");
                  try {
                    const res = await fetch(`${base}/pipelines/${selectedHistoryPipeline.slug}/suivi`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ suivi }),
                    });
                    const data = await res.json();
                    if (data?.success) {
                      setSelectedHistoryPipeline((p) => (p ? { ...p, suivi } : null));
                      setHistoryPipelines((prev) =>
                        prev.map((p) => (p.slug === selectedHistoryPipeline.slug ? { ...p, suivi } : p))
                      );
                      historyPipelinesRef.current = historyPipelinesRef.current.map((p) =>
                        p.slug === selectedHistoryPipeline.slug ? { ...p, suivi } : p
                      );
                    }
                  } catch (e) {
                    console.error("Erreur mise à jour suivi:", e);
                  }
                }}
              />
            ),
          } as CartoToolSection,
        ]
      : []),
  ];

  return (
    <div className="cua-map-workspace">
        <CartoLeftSidebar
          isOpen={leftSidebarOpen}
          onToggle={() => setLeftSidebarOpen((v) => !v)}
          newCuTitle="Certificat d'urbanisme"
          historyInsideNewCu
          searchBlock={{
            title: "Rechercher une parcelle",
            defaultOpen: false,
            content: (
              <ParcelleSearchForm
                embedded
                onSelect={async (section, numero) => {
                  if (!selectParcelleByRefRef.current) return;
                  await selectParcelleByRefRef.current(section, numero);
                }}
              />
            ),
          }}
          toolSections={sidebarSections}
          parcelleBlock={
            resumeParcelles?.length
              ? {
                  title:
                    resumeParcelles.length > 1
                      ? `Caractéristiques parcelles (${resumeParcelles.length})`
                      : "Caractéristiques parcelle",
                  defaultOpen: true,
                  content: (
                    <>
                      <ParcelleResumePanel
                        communeSlug="argeles"
                        parcelles={resumeParcelles}
                        cadastre={cadastreData}
                        isDraftUf={isDraftUfResume}
                        studyZoneActive={!!studyZoneMode?.active}
                        studyZoneLoading={studyZoneLoading}
                        studyZoneLabel={
                          studyZoneMode?.active
                            ? studyZoneLabel(studyZoneMode.context)
                            : undefined
                        }
                        onEnterStudyZone={() => void enterStudyZone()}
                        onExitStudyZone={exitStudyZone}
                        intersectionsReport={intersectionsReport}
                        intersectionsLoading={intersectionsLoading}
                        intersectionsError={intersectionsError}
                        onRecalculateIntersections={() => void enterStudyZone(true)}
                      />
                      {studyZoneError ? (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2 mt-2">
                          {studyZoneError}
                        </p>
                      ) : null}
                    </>
                  ),
                }
              : null
          }
          history={{
            communeSlug: "argeles",
            rows: historyPipelines,
            selectedSlug: selectedHistoryPipeline?.slug ?? null,
            onSelect: handleSelectHistoryFromSlug,
            onOpenProject: (slug) => navigate(`/argeles/cua/projects/${slug}`),
            onUpdateProject: handleUpdateHistoryProject,
            onDeleteProject: handleDeleteHistoryProject,
            identiteRows: identiteFonciereHistory,
            selectedIdentiteProjectId: selectedIdentiteProjectId,
            onSelectIdentite: handleSelectIdentiteProject,
            historySidebarTab,
            onHistorySidebarTabChange: setHistorySidebarTab,
            onDeleteIdentiteProject: handleDeleteIdentiteProject,
          }}
        />

        <div className="flex-1 relative min-h-0 min-w-0">
          <div ref={containerRef} className="w-full h-full" />
        
          <MapTooltipOverlay tooltip={tooltip} />
          <MapLoadingOverlay
            isLoadingCadastre={isLoadingCadastre}
            isLoadingStudyZone={studyZoneLoading}
          />
          <UfBuilderModeBanner
            ufBuilderMode={ufBuilderMode}
            currentZoom={currentZoom}
            minZoom={PARCELLE_CLICK_ZOOM}
            selectedCount={selectedUfParcelles.length}
            maxCount={20}
          />
          {studyZoneMode?.active ? (
            <StudyZoneControls
              context={studyZoneMode.context}
              bufferM={studyZoneMode.bufferM}
              bufferMaxM={studyZoneMode.context.context_buffer_max_m}
              loading={studyZoneLoading}
              onBufferChange={(m) =>
                setStudyZoneMode((prev) => (prev?.active ? { ...prev, bufferM: m } : prev))
              }
              onExit={exitStudyZone}
            />
          ) : null}
        </div>

        <RightSidebarPatch
          isOpen={rightLegendOpen}
          onToggle={() => setRightLegendOpen((v) => !v)}
          legend={
            studyZoneMode?.active ? (
              <StudyZoneLegendPanel
                layerRows={studyLayerRows}
                layerLegends={studyLayerLegends}
                visibleLayerIds={studyZoneMode.visibleLayerIds}
                visibleGroups={studyZoneMode.visibleGroups}
                onToggleLayer={(layerId) =>
                  setStudyZoneMode((prev) => {
                    if (!prev?.active) return prev;
                    const next = new Set(prev.visibleLayerIds);
                    if (next.has(layerId)) next.delete(layerId);
                    else next.add(layerId);
                    return { ...prev, visibleLayerIds: next };
                  })
                }
                onToggleGroup={(layerId, key) =>
                  setStudyZoneMode((prev) => {
                    if (!prev?.active) return prev;
                    const set = new Set(prev.visibleGroups[layerId] ?? []);
                    if (set.has(key)) set.delete(key);
                    else set.add(key);
                    return {
                      ...prev,
                      visibleGroups: { ...prev.visibleGroups, [layerId]: set },
                    };
                  })
                }
                onToggleAllGroups={(layerId, on, keys) =>
                  setStudyZoneMode((prev) => {
                    if (!prev?.active) return prev;
                    return {
                      ...prev,
                      visibleGroups: {
                        ...prev.visibleGroups,
                        [layerId]: on ? new Set(keys) : new Set(),
                      },
                    };
                  })
                }
              />
            ) : mapReady && mapRef.current ? (
              <CartoLegendPanel
                embedded
                map={mapRef.current}
                layerVisible={layerVisible}
                onLayerVisibleChange={(layerId, on) =>
                  setLayerVisible((v) => ({ ...v, [layerId]: on }))
                }
                onAfterSync={bringCadastreHitLayersToFront}
              />
            ) : null
          }
        />
    </div>
  );
}
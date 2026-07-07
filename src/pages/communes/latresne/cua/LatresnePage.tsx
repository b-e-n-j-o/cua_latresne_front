import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as pmtiles from "pmtiles";
import * as turf from "@turf/turf";
import { useNavigate } from "react-router-dom";
import CartoLeftSidebar from "../../communs/carto/layout/CartoLeftSidebar";
import ParcelleSearchForm from "../../communs/carto/tools/ParcelleSearchForm";
import { type HistoryPipeline } from "../../communs/carto/tools/HistoryPipelineCard";
import SuiviInstructionCard from "../../communs/carto/tools/SuiviInstructionCard";
import type { ParcelleInfo } from "../../../../types/parcelle";
import type { ParcelleResumeRef } from "../../../../types/sigResume";
import supabase from "../../../../supabaseClient";
import { apiFetch } from "../../../../api/apiFetch";
import {
  HistoryPipelinePopup,
  MapLoadingOverlay,
  MapLegendHarvestOverlay,
  MapTooltipOverlay,
  UfBuilderModeBanner,
} from "../../communs/carto/map/MapOverlays";
import type { IdentiteFonciereHistoryRow } from "../../communs/carto/layout/CartoHistoryPanel";
import RightSidebarPatch from "../../communs/carto/layout/RightSidebarPatch";
import ParcelleQuickActions from "../../communs/carto/tools/ParcelleQuickActions";
import DraftUfParcelleList from "../../communs/carto/tools/DraftUfParcelleList";
import {
  buildHistoryMapFeatures,
  getPingColor,
  normalizeHistoryPipelines,
  parseIdentiteCentroid,
} from "../../communs/carto/history/historyMapUtils";
import { getCerfaParcelleRefs } from "../../communs/carto/history/cerfaParcelleRefs";
import { CARTO_LAYERS } from "./cartoLayers";
import { syncCartoOnMap } from "./cartoFilters";
import CartoLegendPanel from "./CartoLegendPanel";
import { appendCartoTooltipLine, attachCartoHoverHandlers } from "../../communs/carto/cartoTooltips";

const cartoProtocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", cartoProtocol.tile);

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033, 44.769809, -0.459991, 44.808794
];

const LATRESNE_INSEE = "33234";
const LATRESNE_COMMUNE = "Latresne";
const PARCELLE_SELECT_ZOOM = 17;

const API_BASE = import.meta.env.VITE_API_BASE;

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

function normalizeUfSection(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

function normalizeUfNumero(raw: unknown): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  return trimmed.padStart(4, "0");
}

/** Couches GeoJSON cliquables au-dessus des PMTiles (zonage, bâtiments…). */
const CADASTRE_GRID_LAYER_IDS = [
  "latresne_parcelles-fill",
  "latresne_parcelles-fill-hover",
  "latresne_parcelles-outline",
] as const;

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

/** Couches UI au-dessus du hit-test parcelles (sélection UF, pings…). */
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
  for (const id of MAP_UI_TOP_LAYER_IDS) moveLayerToTop(map, id);
}

/** Grille cadastre GeoJSON (hit-test). Visuel = PMTiles `parcelles-*` via légende. */
function applyCadastreGridVisibility(map: maplibregl.Map, visible: boolean): void {
  const vis: "visible" | "none" = visible ? "visible" : "none";
  for (const id of CADASTRE_GRID_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    try {
      map.setLayoutProperty(id, "visibility", vis);
    } catch {
      /* style en cours de chargement */
    }
  }
  // Couches interactives invisibles : contours via PMTiles
  if (visible) {
    try {
      if (map.getLayer("latresne_parcelles-fill")) {
        map.setPaintProperty("latresne_parcelles-fill", "fill-opacity", 0);
      }
      if (map.getLayer("latresne_parcelles-outline")) {
        map.setPaintProperty("latresne_parcelles-outline", "line-opacity", 0);
      }
    } catch {
      /* style en cours de chargement */
    }
  }
}

function isCadastreLayerInteractive(map: maplibregl.Map, layerId: string): boolean {
  if (!map.getLayer(layerId)) return false;
  try {
    return map.getLayoutProperty(layerId, "visibility") !== "none";
  } catch {
    return false;
  }
}

function queryCadastreHitAtPoint(
  map: maplibregl.Map,
  point: maplibregl.PointLike
): { layerId: (typeof CADASTRE_HIT_LAYER_IDS)[number]; feature: maplibregl.MapGeoJSONFeature } | null {
  const layers = CADASTRE_HIT_LAYER_IDS.filter((id) => isCadastreLayerInteractive(map, id));
  if (!layers.length) return null;
  const hits = map.queryRenderedFeatures(point, { layers: [...layers] });
  if (!hits.length) return null;
  const layerId = hits[0].layer?.id as (typeof CADASTRE_HIT_LAYER_IDS)[number] | undefined;
  if (!layerId || !CADASTRE_HIT_LAYER_IDS.includes(layerId)) return null;
  return { layerId, feature: hits[0] };
}

const PARCELLE_CLICK_ZOOM = 13;
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

export default function LatresnePage() {
  const navigate = useNavigate();
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cadastreDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [selectedParcelle, setSelectedParcelle] = useState<ParcelleInfo | null>(null);
  const [selectedParcelleGeometry, setSelectedParcelleGeometry] = useState<GeoJSON.Geometry | null>(null);
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
  const layerVisibleRef = useRef(layerVisible);
  useEffect(() => {
    layerVisibleRef.current = layerVisible;
  }, [layerVisible]);

  const handleCartoAfterSync = useCallback((map: maplibregl.Map) => {
    applyCadastreGridVisibility(map, layerVisibleRef.current.parcelles !== false);
    bringCadastreHitLayersToFront(map);
  }, []);

  const handleLayerVisibleChange = useCallback((layerId: string, on: boolean) => {
    if (layerId === "parcelles") {
      const map = mapRef.current;
      if (map) applyCadastreGridVisibility(map, on);
      if (!on) setTooltip(null);
    }
    setLayerVisible((v) => ({ ...v, [layerId]: on }));
  }, []);

  const [showHistoryPings, setShowHistoryPings] = useState(true);
  const [isLoadingCadastre, setIsLoadingCadastre] = useState(true);
  const [isLegendHarvesting, setIsLegendHarvesting] = useState(false);
  const [ufState, setUfState] = useState<UFState | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightLegendOpen, setRightLegendOpen] = useState(true);
  const [historySidebarTab, setHistorySidebarTab] = useState<"cua" | "cif">("cua");
  
  // Mode UF actif par défaut : sélection au clic sur le cadastre (comme Argelès)
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
  const showCerfaParcellesRef = useRef<((parcelles: Array<{ section: string; numero: string }>, commune: string, insee: string) => Promise<void>) | null>(null);
  const isHoveringHistoryPingRef = useRef(false);
  const cartoHoverDetachRef = useRef<(() => void) | null>(null);
  const handleSelectHistoryFromSlugRef = useRef<(slug: string) => void>(() => {});
  const handleSelectIdentiteProjectRef = useRef<(projectId: string) => void>(() => {});

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

  function removeUfParcelle(section: string, numero: string) {
    const normSection = normalizeUfSection(section);
    const normNumero = normalizeUfNumero(numero);
    if (!normSection || !normNumero) return;

    setSelectedUfParcelles((prev) =>
      prev.filter(
        (p) =>
          normalizeUfSection(p.section) !== normSection ||
          normalizeUfNumero(p.numero) !== normNumero
      )
    );
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
        console.error("Erreur récupération session Supabase dans LatresnePage", e);
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

    setLeftSidebarOpen(true);
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
    setLeftSidebarOpen(true);
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
    const res = await apiFetch(`/pipelines/${slug}`, {
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
    const res = await apiFetch(`/pipelines/${slug}`, { method: "DELETE" });
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
      const res = await apiFetch("/pipelines/by_user?commune_slug=latresne");
      const j = await res.json();
      if (!j.success || !Array.isArray(j.pipelines)) {
        console.warn("⚠️ Impossible de charger l'historique des pipelines pour la carte");
        return;
      }

      const normalized = normalizeHistoryPipelines(j.pipelines);
      historyPipelinesRef.current = normalized;
      setHistoryPipelines(normalized);

      const features = buildHistoryMapFeatures(normalized);

      const source = map.getSource("pipelines-history") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features });
        bringCadastreHitLayersToFront(map);
      }

      if (focusSlug) {
        handleSelectHistoryFromSlugRef.current(focusSlug);
      }
    } catch (e) {
      console.error("Erreur chargement des pings d'historique sur la carte:", e);
    }
  };

  const refreshIdentiteFonciereHistory = async () => {
    if (!userId) return;
    try {
      const res = await apiFetch("/api/identite-fonciere/history/by_user?limit=100");
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
    const res = await apiFetch(
      `/api/identite-fonciere/history/${encodeURIComponent(projectId)}`,
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
      bounds: LATRESNE_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      maxZoom: 22
    });
    mapRef.current = map;

    map.on("load", async () => {
      map.setZoom(14);
      setCurrentZoom(14);

      try {
        map.setPaintProperty("water", "fill-opacity", 0.45);
        map.setPaintProperty("landcover", "fill-opacity", 0.35);
        map.setPaintProperty("building", "fill-opacity", 0.25);
      } catch {}

      // Charger le cadastre depuis l'API (base), avec fallback local en dev.
      setIsLoadingCadastre(true);
      let parcellesData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
      try {
        const base = (API_BASE || "http://localhost:8000").replace(/\/$/, "");
        let response = await fetch(`${base}/latresne/parcelles/geojson`);
        if (!response.ok) {
          // Fallback local pour éviter un écran vide si backend indisponible.
          response = await fetch("/data/parcelles.geojson");
        }
        if (!response.ok) {
          throw new Error(`Chargement cadastre impossible (${response.status})`);
        }
        parcellesData = await response.json();
        cadastreDataRef.current = parcellesData;
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
            "fill-color": "#e0e0e0",
            "fill-opacity": 0.6
          }
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
            "line-color": "#666666",
            "line-width": 1.2,
            "line-opacity": 0.8
          }
        });
      }
      setIsLoadingCadastre(false);

      // PMTiles : uniquement les couches cochées (évite flash + charge réseau inutile)
      syncCartoOnMap(
        map,
        layerVisibleRef.current,
        {},
        {},
        handleCartoAfterSync
      );

      applyCadastreGridVisibility(map, layerVisibleRef.current.parcelles !== false);

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
        const slug = (feature.properties as { slug?: string })?.slug;
        if (!slug) return;
        handleSelectHistoryFromSlugRef.current(slug);
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
        setLeftSidebarOpen(true);
        const [lon, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 16), duration: 600 });
      });

      // Hover sur cadastre avec feature-state
      map.on("mousemove", "latresne_parcelles-fill", (e) => {
        if (isHoveringHistoryPingRef.current) return;
        if (ufStateRef.current) return;
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
        const parcelleLabel = `Section ${props?.section ?? ""} – Parcelle ${props?.numero ?? ""}`;
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content: appendCartoTooltipLine(
            map,
            e.point,
            CARTO_LAYERS,
            layerVisibleRef.current,
            parcelleLabel
          ),
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

      // Click parcelles : queryRenderedFeatures (PMTiles ne bloquent plus le hit-test)
      async function selectParcelleFromFeature(
        feature: GeoJSON.Feature,
        layerId?: string
      ) {
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        const geometry = feature.geometry;
        if (!geometry) return;

        const normalizedSection = normalizeUfSection(props.section);
        const normalizedNumero = normalizeUfNumero(props.numero);
        const insee =
          layerId === "parcelle-search-fill"
            ? String(props.insee ?? props.code_insee ?? LATRESNE_INSEE)
            : String(props.insee ?? LATRESNE_INSEE);
        const commune = String(props.commune || LATRESNE_COMMUNE);

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

        setSelectedParcelleGeometry(geometry as GeoJSON.Geometry);
        setLeftSidebarOpen(true);
        setSelectedParcelle({
          section: String(props.section ?? ""),
          numero: String(props.numero ?? ""),
          commune,
          insee,
          surface:
            layerId === "parcelle-search-fill" && props.contenance
              ? Number(props.contenance)
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
          code_insee: LATRESNE_INSEE,
          section: normSection,
          numero: normNumero,
          commune: LATRESNE_COMMUNE,
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
        await selectParcelleFromFeature(target, "parcelle-search-fill");
      }

      selectParcelleByRefRef.current = selectParcelleByRef;

      map.on("click", async (e) => {
        const hit = queryCadastreHitAtPoint(map, e.point);
        if (!hit) return;
        const { feature, layerId } = hit;
        await selectParcelleFromFeature(feature as GeoJSON.Feature, layerId);
      });

      map.on("click", "parcelle-search-fill", async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        await selectParcelleFromFeature(feature as GeoJSON.Feature, "parcelle-search-fill");
      });

      // Hover/click sur résultats recherche
      map.on("mousemove", "parcelle-search-fill", (e) => {
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

      cartoHoverDetachRef.current?.();
      cartoHoverDetachRef.current = attachCartoHoverHandlers(map, {
        defs: CARTO_LAYERS,
        layerVisibleRef,
        parcelleHitLayerId: "latresne_parcelles-fill",
        canShow: () =>
          !ufStateRef.current && !isHoveringHistoryPingRef.current,
        setTooltip,
      });

      map.on("zoom", () => setCurrentZoom(map.getZoom()));
      map.on("zoomend", () => {
        const zoom = map.getZoom();
        setCurrentZoom(zoom);
      });

      setMapReady(true);
    });

    return () => {
      cartoHoverDetachRef.current?.();
      cartoHoverDetachRef.current = null;
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Toggle « Cadastre » : réappliquer si l'état change hors légende
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    applyCadastreGridVisibility(map, layerVisible.parcelles !== false);
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

    const parcelles = getCerfaParcelleRefs(selectedHistoryPipeline.cerfa_data);
    if (!parcelles.length) {
      source.setData({ type: "FeatureCollection", features: [] });
      map.setLayoutProperty("history-pipeline-parcelles-fill", "visibility", "none");
      map.setLayoutProperty("history-pipeline-parcelles-outline", "visibility", "none");
      return;
    }


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

  const suiviBlock = selectedHistoryPipeline
    ? {
        title: "Suivi du dossier",
        defaultOpen: true,
        content: (
          <SuiviInstructionCard
            pipeline={selectedHistoryPipeline}
            onSuiviChange={async (suivi) => {
              try {
                const res = await apiFetch(`/pipelines/${selectedHistoryPipeline.slug}/suivi`, {
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
      }
    : null;

  useEffect(() => {
    handleSelectHistoryFromSlugRef.current = handleSelectHistoryFromSlug;
    handleSelectIdentiteProjectRef.current = handleSelectIdentiteProject;
  });

  const activeParcelles = useMemo((): ParcelleResumeRef[] | null => {
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
      return [{
        section: selectedParcelle.section,
        numero: selectedParcelle.numero,
        commune: selectedParcelle.commune,
        insee: selectedParcelle.insee,
        surface_m2: selectedParcelle.surface,
      }];
    }
    return null;
  }, [ufBuilderMode, selectedUfParcelles, selectedParcelle]);

  const isDraftUfResume =
    ufBuilderMode && selectedUfParcelles.length > 0 && !ufState;

  const draftUfSurfaceM2 = useMemo(() => {
    if (!isDraftUfResume) return null;
    let total = 0;
    for (const p of selectedUfParcelles) {
      try {
        total += turf.area({ type: "Feature", geometry: p.geometry, properties: {} });
      } catch {
        /* géométrie invalide */
      }
    }
    return total > 0 ? total : null;
  }, [isDraftUfResume, selectedUfParcelles]);

  const activeUnionGeometry = useMemo((): GeoJSON.Geometry | null => {
    if (selectedParcelle?.ufUnionGeometry) return selectedParcelle.ufUnionGeometry;
    if (ufBuilderMode && selectedUfParcelles.length > 1) {
      try {
        const feats = selectedUfParcelles.map((p) => ({
          type: "Feature" as const,
          geometry: p.geometry,
          properties: {},
        }));
        return turf.union({ type: "FeatureCollection", features: feats })?.geometry ?? selectedUfParcelles[0]?.geometry ?? null;
      } catch {
        return selectedUfParcelles[0]?.geometry ?? null;
      }
    }
    if (ufBuilderMode && selectedUfParcelles.length === 1) {
      return selectedUfParcelles[0].geometry;
    }
    return selectedParcelleGeometry;
  }, [selectedParcelle, ufBuilderMode, selectedUfParcelles, selectedParcelleGeometry]);

  return (
    <div className="cua-map-workspace">
        <CartoLeftSidebar
          isOpen={leftSidebarOpen}
          onToggle={() => setLeftSidebarOpen((v) => !v)}
          searchBlock={{
            title: "Rechercher une parcelle",
            defaultOpen: true,
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
          toolSections={[]}
          extraBlocks={suiviBlock ? [suiviBlock] : []}
          defaultHistoryOpen={false}
          parcelleBlock={
            activeParcelles?.length
              ? {
                  title: isDraftUfResume
                    ? `Unité foncière en cours (${activeParcelles.length})`
                    : activeParcelles.length > 1
                      ? `Parcelles sélectionnées (${activeParcelles.length})`
                      : "Parcelle sélectionnée",
                  defaultOpen: true,
                  content: (
                    <div className="space-y-3">
                      {isDraftUfResume ? (
                        <DraftUfParcelleList
                          parcelles={activeParcelles.map((p) => ({
                            section: p.section,
                            numero: p.numero,
                          }))}
                          ufSurface={draftUfSurfaceM2}
                          onRemove={removeUfParcelle}
                        />
                      ) : null}
                      <ParcelleQuickActions
                        communeSlug="latresne"
                        parcelles={activeParcelles}
                        unionGeometry={activeUnionGeometry}
                        showParcelleHeader={!isDraftUfResume}
                        userId={userId}
                        userEmail={userEmail}
                        onPipelineCreated={(newSlug) => {
                          refreshHistoryPipelines(newSlug);
                          navigate(`/latresne/cua/projects/${newSlug}`);
                        }}
                      />
                    </div>
                  ),
                }
              : null
          }
          history={{
            communeSlug: "latresne",
            rows: historyPipelines,
            selectedSlug: selectedHistoryPipeline?.slug ?? null,
            onSelect: handleSelectHistoryFromSlug,
            onOpenProject: (slug) => navigate(`/latresne/cua/projects/${slug}`),
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
          <MapLoadingOverlay isLoadingCadastre={isLoadingCadastre} />
          <MapLegendHarvestOverlay active={isLegendHarvesting} />
          <UfBuilderModeBanner
            ufBuilderMode={ufBuilderMode}
            currentZoom={currentZoom}
            minZoom={PARCELLE_CLICK_ZOOM}
            selectedCount={selectedUfParcelles.length}
            maxCount={20}
          />
          <HistoryPipelinePopup
            selectedHistoryPipeline={selectedHistoryPipeline}
            historyPopupPosition={historyPopupPosition}
            onClose={clearHistorySelection}
          />

        </div>

        <RightSidebarPatch
          isOpen={rightLegendOpen}
          onToggle={() => setRightLegendOpen((v) => !v)}
          legend={
            mapReady && mapRef.current ? (
              <CartoLegendPanel
                embedded
                map={mapRef.current}
                layerVisible={layerVisible}
                onLayerVisibleChange={handleLayerVisibleChange}
                onAfterSync={handleCartoAfterSync}
                onLegendHarvesting={setIsLegendHarvesting}
              />
            ) : null
          }
        />
    </div>
  );
}
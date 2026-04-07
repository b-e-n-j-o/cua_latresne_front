import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { useNavigate } from "react-router-dom";
import { SideBarLeft, type SideBarSection } from "../../components/layout/SideBarLeft";
import ParcelleSearchForm from "../../components/tools/carto/ParcelleSearchform";
import SearchUniteFonciere from "../../components/tools/carto/SearchUniteFonciere";
import { type HistoryPipeline } from "../../components/tools/carto/HistoryPipelineCard";
import SuiviInstructionCard from "../../components/tools/carto/SuiviInstructionCard";
import CerfaTool from "./cerfa/CerfaTool";
import UniteFonciereCard from "../../components/tools/carto/UniteFonciereCard";
import type { ParcelleInfo, ZonageInfo } from "../../types/parcelle";
import supabase from "../../supabaseClient";
import { MapLoadingOverlay, MapTooltipOverlay, UfBuilderModeBanner } from "./LatresneMapOverlays";
import RightHistorySidebar, { type IdentiteFonciereHistoryRow } from "./RightHistorySidebar";
import LogoutButton from "../../auth/LogoutButton";

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033, 44.769809, -0.459991, 44.808794
];

const API_BASE = import.meta.env.VITE_API_BASE;

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
  const [showHistoryPings, setShowHistoryPings] = useState(true);
  const [isLoadingCadastre, setIsLoadingCadastre] = useState(true);
  const [ufState, setUfState] = useState<UFState | null>(null);
  const [rightHistoryOpen, setRightHistoryOpen] = useState(true);
  const [historySidebarTab, setHistorySidebarTab] = useState<"cua" | "cif">("cua");
  
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
  const getZonageForUFRef = useRef<((insee: string, parcelles: Array<{ section: string; numero: string }>) => Promise<ZonageInfo[]>) | null>(null);
  const showCerfaParcellesRef = useRef<((parcelles: Array<{ section: string; numero: string }>, commune: string, insee: string) => Promise<void>) | null>(null);
  const isHoveringHistoryPingRef = useRef(false);

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
    const res = await fetch(`${base}/pipelines/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || "Erreur de mise à jour");
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
    const res = await fetch(`${base}/pipelines/${slug}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || "Erreur de suppression");
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
      const res = await fetch(`${base}/pipelines/by_user?user_id=${userId}`);
      const j = await res.json();
      if (!j.success || !Array.isArray(j.pipelines)) {
        console.warn("⚠️ Impossible de charger l'historique des pipelines pour la carte");
        return;
      }

      const pipelinesWithCentroid = j.pipelines.filter(
        (p: any) => p.centroid && typeof p.centroid.lon === "number" && typeof p.centroid.lat === "number"
      );
      setHistoryPipelines(pipelinesWithCentroid);

      const features: GeoJSON.Feature[] = pipelinesWithCentroid.map((p: any) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [p.centroid.lon, p.centroid.lat],
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
      }));

      const source = map.getSource("pipelines-history") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features });
      }

      if (focusSlug) {
        const created = pipelinesWithCentroid.find((p: any) => p.slug === focusSlug);
        if (created) {
          setSelectedHistoryPipeline(created);
          const point = map.project([created.centroid.lon, created.centroid.lat]);
          const container = map.getContainer();
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const placement = getPopupPlacement(point.x, point.y, cw, ch);
          const x = clampPopupX(point.x, cw);
          setHistoryPopupPosition({ x, y: point.y, placement });
          map.flyTo({
            center: [created.centroid.lon, created.centroid.lat],
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

      // Charger le cadastre depuis le GeoJSON local
      setIsLoadingCadastre(true);
      let parcellesData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
      try {
        const response = await fetch('/data/parcelles.geojson');
        if (response.ok) {
          parcellesData = await response.json();
          cadastreDataRef.current = parcellesData;
        }
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
        setRightHistoryOpen(true);
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

      // Click sur cadastre
      map.on("click", "latresne_parcelles-fill", async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as any;

        if (ufBuilderModeRef.current) {
          const currentSelection = selectedUfParcellesRef.current;
          const alreadySelected = currentSelection.some(
            p => p.section === props.section && p.numero === props.numero
          );
          
          if (alreadySelected) {
            setSelectedUfParcelles(prev => 
              prev.filter(p => !(p.section === props.section && p.numero === props.numero))
            );
          } else {
            if (currentSelection.length >= 20) {
              alert("Maximum 20 parcelles pour une unité foncière");
              return;
            }
            setSelectedUfParcelles(prev => [...prev, {
              section: props.section,
              numero: props.numero,
              commune: props.commune || "Latresne",
              insee: props.insee || "33234",
              geometry: feature.geometry as GeoJSON.Geometry,
              addedVia: "map",
            }]);
          }
          return;
        }

        const bbox = turf.bbox(feature.geometry as GeoJSON.Geometry);
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { 
          padding: 80, 
          duration: 900,
          easing: (t) => t * (2 - t)
        });

        const zonageData = await getZonageAtPoint(
          props.insee || "33234",
          props.section,
          props.numero
        );

        setSelectedParcelle({
          section: props.section,
          numero: props.numero,
          commune: props.commune || "Latresne",
          insee: props.insee || "33234",
          zonage: zonageData?.etiquette,
          zonages: zonageData ? [{
            section: props.section,
            numero: props.numero,
            typezone: zonageData.typezone,
            etiquette: zonageData.etiquette,
            libelle: zonageData.libelle,
            libelong: zonageData.libelong
          }] : undefined
        });
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

      map.on("click", "parcelle-search-fill", async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as any;

        if (ufBuilderModeRef.current) {
          const currentSelection = selectedUfParcellesRef.current;
          const alreadySelected = currentSelection.some(
            p => p.section === props.section && p.numero === props.numero
          );
          
          if (alreadySelected) {
            setSelectedUfParcelles(prev => 
              prev.filter(p => !(p.section === props.section && p.numero === props.numero))
            );
          } else {
            if (currentSelection.length >= 20) {
              alert("Maximum 20 parcelles pour une unité foncière");
              return;
            }
            setSelectedUfParcelles(prev => [...prev, {
              section: props.section,
              numero: props.numero,
              commune: props.commune || "Latresne",
              insee: props.insee || props.code_insee || "33234",
              geometry: feature.geometry as GeoJSON.Geometry,
              addedVia: "map",
            }]);
          }
          return;
        }

        const bbox = turf.bbox(feature.geometry as GeoJSON.Geometry);
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { 
          padding: 80, 
          duration: 1200,
          easing: (t) => t * (2 - t)
        });

        const insee = props.code_insee ?? props.insee ?? "33234";
        const zonageData = await getZonageAtPoint(insee, props.section, props.numero);

        setSelectedParcelle({
          section: props.section,
          numero: props.numero,
          commune: props.commune || "Latresne",
          insee,
          zonage: zonageData?.etiquette,
          zonages: zonageData ? [{
            section: props.section,
            numero: props.numero,
            typezone: zonageData.typezone,
            etiquette: zonageData.etiquette,
            libelle: zonageData.libelle,
            libelong: zonageData.libelong
          }] : undefined,
          surface: props.contenance ? Number(props.contenance) : undefined
        });
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

    const features: GeoJSON.Feature[] = historyPipelines
      .filter((p: any) => p.centroid && typeof p.centroid.lon === "number" && typeof p.centroid.lat === "number")
      .map((p: any) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [p.centroid.lon, p.centroid.lat],
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
      }));

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

  const sidebarSections: SideBarSection[] = [
    {
      id: "search-parcelle",
      title: "Recherche parcelle / adresse",
      defaultOpen: false,
      content: (
        <>
          <ParcelleSearchForm
            onSearch={(geojson, addressPoint, keepSelection) => {
              if (!showParcelleResultRef.current) return;
              showParcelleResultRef.current(geojson, addressPoint);
              if (!keepSelection) setSelectedParcelle(null);
            }}
            embedded={true}
          />
          <label className="flex items-center gap-2 mt-3 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showHistoryPings}
              onChange={(e) => setShowHistoryPings(e.target.checked)}
              className="rounded border-gray-300"
            />
            Afficher les pings sur la carte (CUA ou CIF selon l&apos;onglet Historique)
          </label>
        </>
      ),
    },
    {
      id: "search-uf",
      title: "Générer CUA - CIF",
      defaultOpen: true,
      content: (
        <SearchUniteFonciere
          ufBuilderMode={ufBuilderMode}
          selectedUfParcelles={selectedUfParcelles}
          onUfBuilderToggle={setUfBuilderMode}
          onUfParcelleRemove={(section, numero) => {
            setSelectedUfParcelles((prev) =>
              prev.filter((p) => !(p.section === section && p.numero === numero))
            );
          }}
          onAddManualUfParcelleToMap={(section, numero) => {
            const cadastre = cadastreDataRef.current;
            if (!cadastre) return;

            if (selectedUfParcelles.length >= 20) {
              alert("Maximum 20 parcelles pour une unité foncière");
              return;
            }

            const alreadySelected = selectedUfParcelles.some(
              (p) => p.section === section && p.numero === numero
            );
            if (alreadySelected) return;

            const found = cadastre.features.find((f: any) =>
              f.properties?.section === section && f.properties?.numero === numero
            );

            if (!found || !found.geometry) {
              alert("Parcelle introuvable dans le cadastre local");
              return;
            }

            const props: any = found.properties || {};

            setSelectedUfParcelles((prev) => [
              ...prev,
              {
                section,
                numero,
                commune: props.commune || "Latresne",
                insee: props.insee || "33234",
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
                  navigate(`/latresne/cua/projects/${newSlug}`);
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
                embedded={true}
              />
            ),
          } as SideBarSection,
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
          } as SideBarSection,
        ]
      : []),
    {
      id: "cerfa",
      title: "Certificat d'urbanisme via CERFA",
      defaultOpen: false,
      content: (
        <CerfaTool
          onPipelineCreated={(newSlug) => {
            console.log("[CUA] Redirection vers page projet", { newSlug });
            refreshHistoryPipelines(newSlug);
            navigate(`/latresne/cua/projects/${newSlug}`);
          }}
          onParcellesDetected={async (parcelles, commune, insee) => {
            if (showCerfaParcellesRef.current) {
              await showCerfaParcellesRef.current(parcelles, commune, insee);
            }
          }}
        />
      ),
    },
  ];

  return (
    <div className="relative">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto h-full px-6 flex items-center justify-between">
          <img src="/logo_kerelia_noir.png" className="h-7" alt="Kerelia" />

          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="text-xs text-[#0b131f]/60">
                <div className="font-medium">{userEmail}</div>
              </div>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="flex h-screen pt-20 overflow-hidden">
        <SideBarLeft sections={sidebarSections} />
        
        <div className="flex-1 relative">
          <div ref={containerRef} className="w-full h-full" />
        
          <MapTooltipOverlay tooltip={tooltip} />
          <MapLoadingOverlay isLoadingCadastre={isLoadingCadastre} />
          <UfBuilderModeBanner
            ufBuilderMode={ufBuilderMode}
            currentZoom={currentZoom}
            minZoom={PARCELLE_CLICK_ZOOM}
            selectedCount={selectedUfParcelles.length}
            maxCount={20}
          />
        </div>
        
        <RightHistorySidebar
          rows={historyPipelines}
          isOpen={rightHistoryOpen}
          onToggle={() => setRightHistoryOpen((v) => !v)}
          selectedSlug={selectedHistoryPipeline?.slug ?? null}
          onSelect={handleSelectHistoryFromSlug}
          onOpenProject={(slug) => navigate(`/latresne/cua/projects/${slug}`)}
          onUpdateProject={handleUpdateHistoryProject}
          onDeleteProject={handleDeleteHistoryProject}
          identiteRows={identiteFonciereHistory}
          selectedIdentiteProjectId={selectedIdentiteProjectId}
          onSelectIdentite={handleSelectIdentiteProject}
          historySidebarTab={historySidebarTab}
          onHistorySidebarTabChange={setHistorySidebarTab}
          onDeleteIdentiteProject={handleDeleteIdentiteProject}
        />
      </div>
    </div>
  );
}
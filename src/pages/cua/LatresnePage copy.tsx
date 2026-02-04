import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { SideBarLeft, type SideBarSection } from "../../components/layout/SideBarLeft";
import ParcelleSearchForm from "../../components/tools/carto/ParcelleSearchform";
import HistoryPipelineCard, { type HistoryPipeline } from "../../components/tools/carto/HistoryPipelineCard";
import SuiviInstructionCard from "../../components/tools/carto/SuiviInstructionCard";
import CerfaTool from "../../components/tools/cerfa/CerfaTool";
import type { ParcelleInfo, ZonageInfo } from "../../types/parcelle";
import supabase from "../../supabaseClient";

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033, 44.769809, -0.459991, 44.808794
];

const API_BASE = import.meta.env.VITE_API_BASE;

/** Couleur du ping selon validité 18 mois : vert >3 mois restants, jaune derniers 3 mois, rouge expiré */
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
  }>;
  geometry: GeoJSON.Geometry;
  insee: string;
  commune: string;
};

export default function LatresnePage() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [selectedParcelle, setSelectedParcelle] = useState<ParcelleInfo | null>(null);
  const [currentZoom, setCurrentZoom] = useState(5.5);
  const [userId, setUserId] = useState<string | null>(null);
  const [historyPingsLoaded, setHistoryPingsLoaded] = useState(false);
  const [historyPipelines, setHistoryPipelines] = useState<HistoryPipeline[]>([]);
  const [selectedHistoryPipeline, setSelectedHistoryPipeline] = useState<HistoryPipeline | null>(null);
  const [historyPopupPosition, setHistoryPopupPosition] = useState<{ x: number; y: number; placement: "above" | "below" } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showHistoryPings, setShowHistoryPings] = useState(true);
  const [isLoadingCadastre, setIsLoadingCadastre] = useState(true);
  const [ufState, setUfState] = useState<UFState | null>(null);
  
  const [ufBuilderMode, setUfBuilderMode] = useState(false);
  const [selectedUfParcelles, setSelectedUfParcelles] = useState<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry: GeoJSON.Geometry;
  }>>([]);
  
  const ufBuilderModeRef = useRef(false);
  const ufStateRef = useRef<UFState | null>(null);
  const selectedUfParcellesRef = useRef<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry: GeoJSON.Geometry;
  }>>([]);
  
      const showParcelleResultRef = useRef<((geojson: any, addressPoint?: [number, number], targetZoom?: number) => void) | null>(null);
  const getZonageForUFRef = useRef<((insee: string, parcelles: Array<{ section: string; numero: string }>) => Promise<ZonageInfo[]>) | null>(null);
  const showCerfaParcellesRef = useRef<((parcelles: Array<{ section: string; numero: string }>, commune: string, insee: string) => Promise<void>) | null>(null);

  // Récupérer l'utilisateur connecté pour charger l'historique des pipelines
  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (user) {
          setUserId(user.id || null);
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json",
      bounds: LATRESNE_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      maxZoom: 22
    });
    mapRef.current = map;

    map.on("load", async () => {
      // Fixer le zoom initial à 14
      map.setZoom(14);
      setCurrentZoom(14);

      // Ajuster opacité du fond
      try {
        map.setPaintProperty("water", "fill-opacity", 0.45);
        map.setPaintProperty("landcover", "fill-opacity", 0.35);
        map.setPaintProperty("building", "fill-opacity", 0.25);
      } catch {}

      // Cadastre : GeoJSON depuis l'API (avec indicateur de chargement)
      setIsLoadingCadastre(true);
      let parcellesData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
      try {
        const base = (typeof API_BASE === "string" ? API_BASE : "").replace(/\/$/, "");
        const response = await fetch(`${base}/latresne/parcelles/geojson`);
        if (response.ok) parcellesData = await response.json();
      } catch {
        // ignorer : carte s'affiche sans parcelles
      }
      if (!map.getSource("latresne_parcelles")) {
        map.addSource("latresne_parcelles", { type: "geojson", data: parcellesData });
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
        map.addLayer({
          id: "latresne_parcelles-fill",
          type: "fill",
          source: "latresne_parcelles",
          paint: {
            "fill-color": "rgba(0, 0, 0, 0.01)"
          }
        });
      }
      setIsLoadingCadastre(false);

      // Source hover surbrillance
      map.addSource("parcelle-hover", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "parcelle-hover-fill",
        type: "fill",
        source: "parcelle-hover",
        paint: {
          "fill-color": "#F97316",
          "fill-opacity": 0.35
        }
      });

      map.addLayer({
        id: "parcelle-hover-outline",
        type: "line",
        source: "parcelle-hover",
        paint: {
          "line-color": "#EA580C",
          "line-width": 2
        }
      });

      // Source résultats recherche
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

      // Source UF builder
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

      // Source UF active (une seule unité foncière métier à la fois)
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

      // Source parcelles CERFA
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

      // Source + layers pour les parcelles de l'UF du pipeline historique (highlight orange)
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

      // Source + layers pour les pings d'historique (point coloré selon validité 18 mois)
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

      // Hover + click sur pings historiques
      map.on("mousemove", "pipelines-history-halo", (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = "pointer";
        const props = e.features[0].properties as any;
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content: props.numero_cu ? `CU ${props.numero_cu}` : "Projet précédent",
        });
      });
      map.on("mouseleave", "pipelines-history-halo", () => {
        map.getCanvas().style.cursor = "";
        setTooltip(null);
      });

      // Click sur ping historique → afficher HistoryPipelineCard en popup sur la carte
      map.on("click", "pipelines-history-halo", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as any;
        const slug = props.slug;
        if (!slug) return;
        const pipeline = historyPipelinesRef.current.find((p: HistoryPipeline) => p.slug === slug);
        if (pipeline) {
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

      // Hover sur cadastre : feature directement depuis la source (pas de lookup dupliqué)
      map.on("mousemove", "latresne_parcelles-fill", (e) => {
        if (ufStateRef.current) return;
        if (!e.features?.length) return;
        const feature = e.features[0];
        const props = feature.properties as any;

        map.getCanvas().style.cursor = "pointer";

        const hoverSource = map.getSource("parcelle-hover") as maplibregl.GeoJSONSource;
        if (hoverSource) {
          hoverSource.setData({
            type: "FeatureCollection",
            features: [{ type: "Feature", geometry: feature.geometry as GeoJSON.Geometry, properties: props || {} }]
          });
        }

        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content: `Section ${props?.section ?? ""} – Parcelle ${props?.numero ?? ""}`
        });
      });

      map.on("mouseleave", "latresne_parcelles-fill", () => {
        if (ufStateRef.current) return;
        map.getCanvas().style.cursor = "";
        setTooltip(null);
        
        const hoverSource = map.getSource("parcelle-hover") as maplibregl.GeoJSONSource;
        if (hoverSource) {
          hoverSource.setData({ type: "FeatureCollection", features: [] });
        }
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
            if (currentSelection.length >= 5) {
              alert("Maximum 5 parcelles pour une unité foncière");
              return;
            }
            setSelectedUfParcelles(prev => [...prev, {
              section: props.section,
              numero: props.numero,
              commune: props.commune || "Latresne",
              insee: props.insee || "33234",
              geometry: feature.geometry as GeoJSON.Geometry
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
        
        const hoverSource = map.getSource("parcelle-hover") as maplibregl.GeoJSONSource;
        if (hoverSource) {
          hoverSource.setData({
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              geometry: feature.geometry as GeoJSON.Geometry,
              properties: {}
            }]
          });
        }
        
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          content: `Section ${props.section} – Parcelle ${props.numero}`
        });
      });

      map.on("mouseleave", "parcelle-search-fill", () => {
        map.getCanvas().style.cursor = "";
        setTooltip(null);
        
        const hoverSource = map.getSource("parcelle-hover") as maplibregl.GeoJSONSource;
        if (hoverSource) {
          hoverSource.setData({ type: "FeatureCollection", features: [] });
        }
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
            if (currentSelection.length >= 5) {
              alert("Maximum 5 parcelles pour une unité foncière");
              return;
            }
            setSelectedUfParcelles(prev => [...prev, {
              section: props.section,
              numero: props.numero,
              commune: props.commune || "Latresne",
              insee: props.insee || props.code_insee || "33234",
              geometry: feature.geometry as GeoJSON.Geometry
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

      // Fonction d'affichage résultats
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

      // Fonction zonage
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

      // Fonction pour afficher les parcelles CERFA sur la carte
      async function showCerfaParcelles(
        parcelles: Array<{ section: string; numero: string }>,
        commune: string,
        insee: string
      ) {
        console.log("🗺️ Affichage parcelles CERFA:", { parcelles, commune, insee });
        
        try {
          // Récupérer les géométries de toutes les parcelles
          const features: GeoJSON.Feature[] = [];
          
          for (const parcelle of parcelles) {
            try {
              // Utiliser la commune (comme dans ParcelleSearchForm)
              const url = `${API_BASE}/parcelle/et-voisins?commune=${encodeURIComponent(commune)}&section=${parcelle.section}&numero=${parcelle.numero}`;
              
              console.log(`📡 Récupération parcelle ${parcelle.section} ${parcelle.numero}:`, url);
              
              const res = await fetch(url);
              
              if (res.ok) {
                const data = await res.json();
                console.log(`✅ Réponse API pour ${parcelle.section} ${parcelle.numero}:`, data);
                
                if (data.features && data.features.length > 0) {
                  // Prendre la parcelle cible (celle qui correspond exactement)
                  const targetFeature = data.features.find((f: any) => 
                    f.properties?.section === parcelle.section && 
                    f.properties?.numero === parcelle.numero
                  ) || data.features[0];
                  
                  if (targetFeature && targetFeature.geometry) {
                    features.push({
                      type: "Feature",
                      geometry: targetFeature.geometry,
                      properties: {
                        section: parcelle.section,
                        numero: parcelle.numero,
                        commune,
                        insee
                      }
                    });
                    console.log(`✅ Parcelle ${parcelle.section} ${parcelle.numero} ajoutée`);
                  } else {
                    console.warn(`⚠️ Pas de géométrie trouvée pour ${parcelle.section} ${parcelle.numero}`);
                  }
                } else {
                  console.warn(`⚠️ Aucune feature retournée pour ${parcelle.section} ${parcelle.numero}`);
                }
              } else {
                console.warn(`❌ Erreur HTTP ${res.status} pour ${parcelle.section} ${parcelle.numero}`);
              }
            } catch (err) {
              console.error(`❌ Erreur récupération parcelle ${parcelle.section} ${parcelle.numero}:`, err);
            }
          }

          console.log(`📊 Total features récupérées: ${features.length}`);

          if (features.length > 0) {
            const source = map.getSource("cerfa-parcelles") as maplibregl.GeoJSONSource;
            if (source) {
              console.log("🎨 Mise à jour de la source cerfa-parcelles avec", features.length, "features");
              source.setData({
                type: "FeatureCollection",
                features
              });

              // S'assurer que les layers sont visibles
              const fillLayer = map.getLayer("cerfa-parcelles-fill");
              const outlineLayer = map.getLayer("cerfa-parcelles-outline");
              
              if (fillLayer) {
                map.setLayoutProperty("cerfa-parcelles-fill", "visibility", "visible");
                console.log("✅ Layer cerfa-parcelles-fill rendu visible");
              } else {
                console.error("❌ Layer cerfa-parcelles-fill non trouvé");
              }
              
              if (outlineLayer) {
                map.setLayoutProperty("cerfa-parcelles-outline", "visibility", "visible");
                console.log("✅ Layer cerfa-parcelles-outline rendu visible");
              } else {
                console.error("❌ Layer cerfa-parcelles-outline non trouvé");
              }

              // Ajuster la vue pour afficher toutes les parcelles
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
              console.log("✅ Vue ajustée pour afficher les parcelles CERFA");
            } else {
              console.error("❌ Source cerfa-parcelles non trouvée");
            }
          } else {
            console.warn("⚠️ Aucune feature à afficher");
          }
        } catch (err) {
          console.error("❌ Erreur affichage parcelles CERFA:", err);
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

  // Charger les pings d'historique une fois que la carte est prête et l'utilisateur connecté
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !userId || historyPingsLoaded) return;

    const loadHistoryPings = async () => {
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
            commune: p.commune,
            code_insee: p.code_insee,
            pingColor: getPingColor(p.created_at),
          },
        }));

        const source = map.getSource("pipelines-history") as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData({
            type: "FeatureCollection",
            features,
          });
          setHistoryPingsLoaded(true);
          console.log(`📍 ${features.length} pings d'historique affichés sur la carte`);
        }
      } catch (e) {
        console.error("Erreur chargement des pings d'historique sur la carte:", e);
      }
    };

    loadHistoryPings();
  }, [mapReady, userId, historyPingsLoaded]);

  // Mettre à jour filtres sélection
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

  // Mettre à jour UF builder
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

  // Visibilité UF builder
  useEffect(() => {
    if (!mapRef.current) return;
    const visibility = ufBuilderMode ? "visible" : "none";
    if (mapRef.current.getLayer("uf-builder-fill")) {
      mapRef.current.setLayoutProperty("uf-builder-fill", "visibility", visibility);
      mapRef.current.setLayoutProperty("uf-builder-outline", "visibility", visibility);
    }
  }, [ufBuilderMode]);

  // Visibilité couche pings historiques
  useEffect(() => {
    if (!mapRef.current) return;
    const visibility = showHistoryPings ? "visible" : "none";
    const halo = mapRef.current.getLayer("pipelines-history-halo");
    const point = mapRef.current.getLayer("pipelines-history-point");
    if (halo) mapRef.current.setLayoutProperty("pipelines-history-halo", "visibility", visibility);
    if (point) mapRef.current.setLayoutProperty("pipelines-history-point", "visibility", visibility);
  }, [showHistoryPings]);

  // Synchroniser la carte avec l'unité foncière métier active
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

  // Garder le popup ancré au ping quand la carte bouge (flyTo, pan, zoom)
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

  // Surligner les parcelles de l'UF du pipeline historique (section + numero)
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("history-pipeline-parcelles") as maplibregl.GeoJSONSource | undefined;
    if (!map || !source) return;

    if (!selectedHistoryPipeline?.cerfa_data?.parcelles?.length) {
      source.setData({ type: "FeatureCollection", features: [] });
      map.setLayoutProperty("history-pipeline-parcelles-fill", "visibility", "none");
      map.setLayoutProperty("history-pipeline-parcelles-outline", "visibility", "none");
      return;
    }

    const parcelles = selectedHistoryPipeline.cerfa_data.parcelles;
    const commune = selectedHistoryPipeline.cerfa_data.commune_nom || selectedHistoryPipeline.commune || "Latresne";
    const base = ((typeof API_BASE === "string" ? API_BASE : "") || "http://localhost:8000").replace(/\/$/, "");

    const fetchAndShow = async () => {
      const features: GeoJSON.Feature[] = [];
      for (const p of parcelles) {
        try {
          const res = await fetch(
            `${base}/parcelle/et-voisins?commune=${encodeURIComponent(commune)}&section=${p.section}&numero=${p.numero}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.features?.[0]?.geometry) {
              features.push({
                type: "Feature",
                geometry: data.features[0].geometry,
                properties: { section: p.section, numero: p.numero }
              });
            }
          }
        } catch {
          // ignore
        }
      }
      if (features.length > 0) {
        source.setData({ type: "FeatureCollection", features });
        map.setLayoutProperty("history-pipeline-parcelles-fill", "visibility", "visible");
        map.setLayoutProperty("history-pipeline-parcelles-outline", "visibility", "visible");
      }
    };

    fetchAndShow();
  }, [selectedHistoryPipeline]);

  const sidebarSections: SideBarSection[] = [
    {
      id: "search",
      title: "Recherche parcelle / adresse / UF",
      defaultOpen: true,
      content: (
        <>
        <ParcelleSearchForm
          onSearch={(geojson, addressPoint, keepSelection) => {
            if (!showParcelleResultRef.current) return;
            showParcelleResultRef.current(geojson, addressPoint);
            if (!keepSelection) setSelectedParcelle(null);
          }}
          ufBuilderMode={ufBuilderMode}
          selectedUfParcelles={selectedUfParcelles}
          onUfBuilderToggle={setUfBuilderMode}
          onUfParcelleRemove={(section, numero) => {
            setSelectedUfParcelles(prev => 
              prev.filter(p => !(p.section === section && p.numero === numero))
            );
          }}
          onConfirmUF={async (parcelles, unionGeometry, commune, insee) => {
            const zonages = await getZonageForUFRef.current?.(insee, parcelles) || [];
            
            setSelectedParcelle({
              section: parcelles.map(p => p.section).join("+"),
              numero: parcelles.map(p => p.numero).join("+"),
              commune,
              insee,
              isUF: true,
              ufParcelles: parcelles,
              ufUnionGeometry: unionGeometry,
              zonages
            });

            setUfState({
              parcelles,
              geometry: unionGeometry,
              commune,
              insee
            });
            
            const source = mapRef.current?.getSource("uf-builder") as maplibregl.GeoJSONSource;
            if (source) source.setData({ type: "FeatureCollection", features: [] });
            setUfBuilderMode(false);
            setSelectedUfParcelles([]);
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
          Afficher les projets précédents (pings)
        </label>
        </>
      ),
    },
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
      title: "Certificat d'urbanisme (CERFA)",
      defaultOpen: true,
      content: (
        <CerfaTool
          onParcellesDetected={async (parcelles, commune, insee) => {
            console.log("📞 Callback onParcellesDetected appelé:", { parcelles, commune, insee });
            console.log("🔍 showCerfaParcellesRef.current:", showCerfaParcellesRef.current);
            if (showCerfaParcellesRef.current) {
              await showCerfaParcellesRef.current(parcelles, commune, insee);
            } else {
              console.error("❌ showCerfaParcellesRef.current est null - la carte n'est peut-être pas encore chargée");
            }
          }}
        />
      ),
    },
  ];

  return (
    <div className="flex h-screen">
      <SideBarLeft sections={sidebarSections} />
      
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />
        
        {tooltip && (
          <div
            className="absolute z-50 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: "translate(-50%, -100%)",
              marginTop: "-8px"
            }}
          >
            {tooltip.content}
          </div>
        )}

        {isLoadingCadastre && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
              <p className="text-sm text-gray-600">Chargement du cadastre...</p>
            </div>
          </div>
        )}

        {ufBuilderMode && currentZoom >= PARCELLE_CLICK_ZOOM && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
            <span className="text-sm font-medium">Mode UF actif - Cliquez sur les parcelles ({selectedUfParcelles.length}/5)</span>
          </div>
        )}

        {/* Popup "Projet précédent" ancré au ping, position adaptative (au-dessus ou en dessous) */}
        {selectedHistoryPipeline && historyPopupPosition && (
          <div
            className="absolute z-50 pointer-events-auto"
            style={
              historyPopupPosition.placement === "above"
                ? {
                    left: historyPopupPosition.x,
                    top: historyPopupPosition.y,
                    transform: "translate(-50%, calc(-100% - 14px))",
                  }
                : {
                    left: historyPopupPosition.x,
                    top: historyPopupPosition.y + POPUP_GAP,
                    transform: "translate(-50%, 0)",
                  }
            }
          >
            <div className="relative">
              {historyPopupPosition.placement === "below" && (
                <div
                  className="absolute left-1/2 -top-2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[12px] border-b-white"
                  style={{ filter: "drop-shadow(0 -1px 2px rgba(0,0,0,0.1))" }}
                />
              )}
              <HistoryPipelineCard
                pipeline={selectedHistoryPipeline}
                onClose={() => {
                  setSelectedHistoryPipeline(null);
                  setHistoryPopupPosition(null);
                }}
                embedded={false}
                mapPopup
              />
              {historyPopupPosition.placement === "above" && (
                <div
                  className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-white"
                  style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))" }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
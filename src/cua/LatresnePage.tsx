import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { SideBarLeft, type SideBarSection } from "../components/layout/SideBarLeft";
import ParcelleSearchForm from "../components/tools/carto/ParcelleSearchform";
import ParcelleCard from "../components/tools/carto/ParcelleCard";
import UniteFonciereCard from "../components/tools/carto/UniteFonciereCard";
import CerfaTool from "../components/tools/cerfa/CerfaTool";
import registerParcellesLatresneLayer from "../carto/layers/latresne/parcelles";
import type { ParcelleInfo, ZonageInfo } from "../types/parcelle";

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033, 44.769809, -0.459991, 44.808794
];

const API_BASE = import.meta.env.VITE_API_BASE;
const PARCELLE_CLICK_ZOOM = 13;

export default function LatresnePage() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [selectedParcelle, setSelectedParcelle] = useState<ParcelleInfo | null>(null);
  const [currentZoom, setCurrentZoom] = useState(5.5);
  
  const [ufBuilderMode, setUfBuilderMode] = useState(false);
  const [selectedUfParcelles, setSelectedUfParcelles] = useState<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry: GeoJSON.Geometry;
  }>>([]);
  
  const ufBuilderModeRef = useRef(false);
  const selectedUfParcellesRef = useRef<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry: GeoJSON.Geometry;
  }>>([]);
  
  const showParcelleResultRef = useRef<((geojson: any, addressPoint?: [number, number], targetZoom?: number) => void) | null>(null);
  const showCerfaParcellesRef = useRef<((parcelles: Array<{ section: string; numero: string }>, commune: string, insee: string) => Promise<void>) | null>(null);
  const getZonageForUFRef = useRef<((insee: string, parcelles: Array<{ section: string; numero: string }>) => Promise<ZonageInfo[]>) | null>(null);
  
  useEffect(() => {
    ufBuilderModeRef.current = ufBuilderMode;
  }, [ufBuilderMode]);
  
  useEffect(() => {
    selectedUfParcellesRef.current = selectedUfParcelles;
  }, [selectedUfParcelles]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json",
      bounds: LATRESNE_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      maxZoom: 22
    });

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

      // Cadastre MBTiles
      registerParcellesLatresneLayer(map, API_BASE);

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

      // Hover sur cadastre
      map.on("mousemove", "latresne_parcelles-fill", (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as any;
        const feature = e.features[0];
        
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

      map.on("mouseleave", "latresne_parcelles-fill", () => {
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

      // Afficher les parcelles CERFA / manuelles sur la carte (fetch géométries puis affichage)
      async function showCerfaParcelles(
        parcelles: Array<{ section: string; numero: string }>,
        commune: string,
        _insee: string
      ) {
        if (!parcelles?.length || !commune?.trim()) return;
        const features: GeoJSON.Feature[] = [];
        for (const p of parcelles) {
          const section = (p.section || "").trim().toUpperCase();
          const numero = (p.numero || "").trim();
          if (!section || !numero) continue;
          try {
            const url = `${API_BASE}/parcelle/et-voisins?commune=${encodeURIComponent(commune)}&section=${section}&numero=${numero}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            const list = data?.features ?? [];
            const feature = list.find(
              (f: any) =>
                f.properties?.section === section && f.properties?.numero === numero
            ) ?? list[0];
            if (feature?.geometry) {
              features.push({
                ...feature,
                properties: {
                  ...(feature.properties || {}),
                  section,
                  numero,
                  commune,
                },
              });
            }
          } catch {
            // ignorer les erreurs par parcelle
          }
        }
        if (features.length === 0) return;
        const geojson = { type: "FeatureCollection" as const, features };
        showParcelleResult(geojson);
      }
      showCerfaParcellesRef.current = showCerfaParcelles;

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

      map.on("zoom", () => setCurrentZoom(map.getZoom()));
      map.on("zoomend", () => {
        const zoom = map.getZoom();
        setCurrentZoom(zoom);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

  const sidebarSections: SideBarSection[] = [
    {
      id: "search",
      title: "Recherche parcelle / adresse / UF",
      defaultOpen: true,
      content: (
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
            
            const source = mapRef.current?.getSource("uf-builder") as maplibregl.GeoJSONSource;
            if (source) source.setData({ type: "FeatureCollection", features: [] });
            setUfBuilderMode(false);
            setSelectedUfParcelles([]);
          }}
          embedded={true}
        />
      ),
    },
    {
      id: "parcelle",
      title: "Parcelle / Unité foncière",
      defaultOpen: true,
      content: selectedParcelle ? (
        selectedParcelle.isUF && selectedParcelle.ufParcelles ? (
          <UniteFonciereCard
            ufParcelles={selectedParcelle.ufParcelles}
            commune={selectedParcelle.commune}
            insee={selectedParcelle.insee}
            unionGeometry={selectedParcelle.ufUnionGeometry}
            zonages={selectedParcelle.zonages}
            onClose={() => setSelectedParcelle(null)}
          />
        ) : (
          <ParcelleCard
            parcelle={selectedParcelle}
            onClose={() => setSelectedParcelle(null)}
            embedded={true}
          />
        )
      ) : (
        <div className="text-xs text-gray-500 italic text-center py-4">
          Aucune parcelle sélectionnée
        </div>
      ),
    },
    {
      id: "cerfa",
      title: "Certificat d'urbanisme (CERFA)",
      defaultOpen: true,
      content: (
        <CerfaTool
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

        {ufBuilderMode && currentZoom >= PARCELLE_CLICK_ZOOM && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
            <span className="text-sm font-medium">Mode UF actif - Cliquez sur les parcelles ({selectedUfParcelles.length}/5)</span>
          </div>
        )}
      </div>
    </div>
  );
}
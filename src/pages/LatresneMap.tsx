import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import LayerSwitcherLatresne from "../components/carto/latresne/LayerSwitcherLatresne";
import ParcelleSearchForm from "../components/carto/ParcelleSearchform";
import ParcelleCard from "../components/carto/ParcelleCard";
import UniteFonciereCard from "../components/carto/UniteFonciereCard";
import registerPLULatresneLayer from "../carto/layers/latresne/plu";
import registerParcellesLatresneLayer from "../carto/layers/latresne/parcelles";
import registerBatiLatresneLayer from "../carto/layers/latresne/bati";

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033,
  44.769809,
  -0.459991,
  44.808794
];

const API_BASE = import.meta.env.VITE_API_BASE;
const MAX_ACTIVE_LAYERS = 5;

const LAYERS_ENDPOINT = `${API_BASE}/latresne/layers`;
const TILE_BASE = `${API_BASE}/latresne/tiles`;

function removeLayerAndSource(map: maplibregl.Map, layerId: string) {
  const fillId = `${layerId}-fill`;
  const outlineId = `${layerId}-outline`;

  if (map.getLayer(fillId)) map.removeLayer(fillId);
  if (map.getLayer(outlineId)) map.removeLayer(outlineId);
  if (map.getSource(layerId)) map.removeSource(layerId);
}

function hideLayer(map: maplibregl.Map, layerId: string) {
  if (map.getLayer(`${layerId}-fill`)) {
    map.setLayoutProperty(`${layerId}-fill`, "visibility", "none");
  }
  if (map.getLayer(`${layerId}-outline`)) {
    map.setLayoutProperty(`${layerId}-outline`, "visibility", "none");
  }
}

function showLayer(map: maplibregl.Map, layerId: string) {
  if (map.getLayer(`${layerId}-fill`)) {
    map.setLayoutProperty(`${layerId}-fill`, "visibility", "visible");
  }
  if (map.getLayer(`${layerId}-outline`)) {
    map.setLayoutProperty(`${layerId}-outline`, "visibility", "visible");
  }
}

interface Layer {
  id: string;
  nom: string;
  type: string;
  attribut_map?: string | null;
  minzoom: number;
  maxzoom: number;
}

/**
 * Fonction centrale de synchronisation des couches avec le zoom actuel.
 * Ne charge les couches qu'une fois le mouvement terminé (appelée sur moveend).
 * Masque les couches hors plage au lieu de les supprimer pour éviter les rechargements.
 */
function syncLayersWithZoom(
  map: maplibregl.Map,
  layers: Layer[],
  visibility: Record<string, boolean>,
  setActiveLayers: React.Dispatch<React.SetStateAction<string[]>>
) {
  const z = Math.floor(map.getZoom());

  setActiveLayers(prev => {
    let next = [...prev];

    layers.forEach(layer => {
      if (layer.id === "plu_latresne") return;
      if (!visibility[layer.id]) return;

      const inRange = z >= layer.minzoom && z <= layer.maxzoom;
      const sourceExists = !!map.getSource(layer.id);

      if (inRange) {
        if (!sourceExists) {
          // Charger
          next.push(layer.id);
          if (next.length > MAX_ACTIVE_LAYERS) {
            const toRemove = next.shift();
            if (toRemove) removeLayerAndSource(map, toRemove);
          }

          map.addSource(layer.id, {
            type: "vector",
            tiles: [`${TILE_BASE}/${layer.id}/{z}/{x}/{y}.mvt`],
            maxzoom: 22
          });

          map.addLayer({
            id: `${layer.id}-fill`,
            type: "fill",
            source: layer.id,
            "source-layer": layer.id,
            paint: {
              "fill-color": getColorByType(layer.type),
              "fill-opacity": 0.4
            }
          });

          map.addLayer({
            id: `${layer.id}-outline`,
            type: "line",
            source: layer.id,
            "source-layer": layer.id,
            paint: {
              "line-color": getOutlineByType(layer.type),
              "line-width": 1.2
            }
          });
        } else {
          // Déjà chargée → afficher
          showLayer(map, layer.id);
        }
      } else {
        // Hors plage → masquer seulement
        if (sourceExists) hideLayer(map, layer.id);
      }
    });

    return next;
  });
}

export default function LatresneMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  // activeLayers est utilisé indirectement via setActiveLayers pour gérer le LRU
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  
  // Tooltip et infos parcelle
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [selectedParcelle, setSelectedParcelle] = useState<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    isUF?: boolean;
    ufParcelles?: Array<{section: string; numero: string; commune: string; insee: string}>;
    ufUnionGeometry?: GeoJSON.Geometry;
  } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(5.5);
  const [parcellesDisplayed, setParcellesDisplayed] = useState(false);
  const [pluVisible, setPluVisible] = useState<boolean>(true);
  
  // État pour le mode UF builder
  const [ufBuilderMode, setUfBuilderMode] = useState(false);
  const [selectedUfParcelles, setSelectedUfParcelles] = useState<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry: GeoJSON.Geometry;
  }>>([]);
  
  // État pour l'UF confirmée (avec géométrie de l'union) - accessible pour les intersections
  // Stockée dans selectedParcelle.ufUnionGeometry quand isUF est true
  
  // Refs pour accéder aux états depuis les closures
  const ufBuilderModeRef = useRef(false);
  const selectedUfParcellesRef = useRef<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry: GeoJSON.Geometry;
  }>>([]);
  
  // Synchroniser les refs avec l'état
  useEffect(() => {
    ufBuilderModeRef.current = ufBuilderMode;
  }, [ufBuilderMode]);
  
  useEffect(() => {
    selectedUfParcellesRef.current = selectedUfParcelles;
  }, [selectedUfParcelles]);
  
  const PARCELLE_CLICK_ZOOM = 13;
  const showParcelleResultRef = useRef<((geojson: any, addressPoint?: [number, number], targetZoom?: number) => void) | null>(null);

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
    
    // Initialiser le zoom
    setCurrentZoom(5.5);

    map.on("load", async () => {
      console.log("Map loaded");

      // Ajuster légèrement l'opacité du fond (eau / couvert / bâtiments)
      try {
        map.setPaintProperty("water", "fill-opacity", 0.45);
        map.setPaintProperty("landcover", "fill-opacity", 0.35);
        map.setPaintProperty("building", "fill-opacity", 0.25);
      } catch {
        // Certains styles peuvent ne pas avoir exactement ces IDs : on ignore silencieusement
      }

      // 1️⃣ récupérer la liste des couches (sans les charger)
      const res = await fetch(LAYERS_ENDPOINT);
      const layersData: Layer[] = await res.json();
      setLayers(layersData);

      // Initialiser la visibilité à false par défaut
      const initialVisibility: Record<string, boolean> = {};
      layersData.forEach(layer => {
        initialVisibility[layer.id] = false;
      });
      setVisibility(initialVisibility);

      // Enregistrement des modules MBTiles (l'ordre définit le Z-Index)
      registerPLULatresneLayer(map, API_BASE);      // Fond (les zones de couleur)
      registerParcellesLatresneLayer(map, API_BASE); // Cadastre + Hover
      registerBatiLatresneLayer(map, API_BASE);     // Bâtiment (au-dessus)
      
      console.log("✅ Couches MBTiles initialisées");

      // ============================================================
      // Couches pour le mode UF Builder
      // ============================================================
      map.addSource("uf-builder", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "uf-builder-fill",
        type: "fill",
        source: "uf-builder",
        paint: {
          "fill-color": "#F59E0B", // Amber pour sélection UF
          "fill-opacity": 0.5
        }
      });

      map.addLayer({
        id: "uf-builder-outline",
        type: "line",
        source: "uf-builder",
        paint: {
          "line-color": "#D97706",
          "line-width": 2,
          "line-dasharray": [3, 2]
        }
      });

      // ============================================================
      // Fonction d'affichage des résultats de recherche de parcelle
      // ============================================================
      function showParcelleResult(geojson: any, addressPoint?: [number, number], targetZoom?: number) {
        // Nettoyage : supprimer les layers et les sources
        // Les event listeners sont automatiquement supprimés quand on supprime les layers
        
        // Nettoyage du point d'adresse
        if (map.getSource("address-point")) {
          if (map.getLayer("address-ping")) map.removeLayer("address-ping");
          if (map.getLayer("address-halo")) map.removeLayer("address-halo");
          map.removeSource("address-point");
        }
        
        // Nettoyage des parcelles
        if (map.getSource("parcelle-search")) {
          // Supprimer les layers (dans l'ordre inverse de leur création)
          if (map.getLayer("parcelle-selected")) map.removeLayer("parcelle-selected");
          if (map.getLayer("parcelle-selected-fill")) map.removeLayer("parcelle-selected-fill");
          if (map.getLayer("parcelle-target")) map.removeLayer("parcelle-target");
          if (map.getLayer("parcelle-target-fill")) map.removeLayer("parcelle-target-fill");
          if (map.getLayer("parcelle-fill")) map.removeLayer("parcelle-fill");
          
          // Supprimer la source
          map.removeSource("parcelle-search");
        }
        
        // Si pas de features dans le geojson, on nettoie donc réinitialiser l'état
        if (!geojson?.features?.length) {
          setParcellesDisplayed(false);
          return; // Ne pas continuer si on nettoie
        }

        // Source GeoJSON des parcelles (maintenant seulement la parcelle cible)
        map.addSource("parcelle-search", {
          type: "geojson",
          data: geojson
        });

        // Source point d'adresse (si recherche par adresse)
        if (addressPoint) {
          map.addSource("address-point", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: addressPoint
                  },
                  properties: {}
                }
              ]
            }
          });

          // Halo autour du point
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

          // Point central
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

        // ------------------------------------------------------------
        // 🟦 Surface de la parcelle (transparente, hoverable)
        // ------------------------------------------------------------
        map.addLayer({
          id: "parcelle-fill",
          type: "fill",
          source: "parcelle-search",
          paint: {
            "fill-color": "#000000",
            "fill-opacity": 0
          }
        });

        // ------------------------------------------------------------
        // 🔴 Contour rouge de la parcelle cible
        // ------------------------------------------------------------
        map.addLayer({
          id: "parcelle-target",
          type: "line",
          source: "parcelle-search",
          paint: {
            "line-color": "#E53E3E",
            "line-width": 3,
            "line-opacity": 1
          }
        });

        // ------------------------------------------------------------
        // 🟡 Remplissage de la parcelle sélectionnée (jaune clair)
        // ------------------------------------------------------------
        map.addLayer({
          id: "parcelle-selected-fill",
          type: "fill",
          source: "parcelle-search",
          filter: ["==", ["get", "section"], ""], // Sera mis à jour dynamiquement
          paint: {
            "fill-color": "#FFF8DC",
            "fill-opacity": 0.6
          }
        });

        // ------------------------------------------------------------
        // 🔴 Parcelle sélectionnée (contour rouge, au-dessus)
        // ------------------------------------------------------------
        map.addLayer({
          id: "parcelle-selected",
          type: "line",
          source: "parcelle-search",
          filter: ["==", ["get", "section"], ""], // Sera mis à jour dynamiquement
          paint: {
            "line-color": "#E53E3E",
            "line-width": 3,
            "line-opacity": 1
          }
        });

        // ------------------------------------------------------------
        // 🎯 Zoom sur la parcelle
        // ------------------------------------------------------------
        const bounds = turf.bbox(geojson);
        
        if (targetZoom !== undefined) {
          // Si un zoom cible est spécifié, centrer sur le centre des bounds et zoomer à ce niveau
          const center = turf.center(geojson);
          map.easeTo({
            center: center.geometry.coordinates as [number, number],
            zoom: targetZoom,
            duration: 800
          });
        } else {
          // Sinon, utiliser fitBounds comme avant
          map.fitBounds(
            [
              [bounds[0], bounds[1]],
              [bounds[2], bounds[3]]
            ],
            {
              padding: 100,
              maxZoom: 18,
              duration: 800
            }
          );
        }
        
        // Marquer que des parcelles sont maintenant affichées
        setParcellesDisplayed(true);

        // ------------------------------------------------------------
        // 🖱️ Interactions hover et click sur la parcelle
        // ------------------------------------------------------------
        // Utiliser la couche fill (transparente) pour les interactions
        // car elle couvre toute la surface, pas seulement les lignes
        
        // Hover : afficher tooltip
        map.on("mousemove", "parcelle-fill", (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties as any;
          
          map.getCanvas().style.cursor = "pointer";
          
          setTooltip({
            x: e.point.x,
            y: e.point.y,
            content: `Section ${props.section} – Parcelle ${props.numero}`
          });
        });

        map.on("mouseleave", "parcelle-fill", () => {
          map.getCanvas().style.cursor = "";
          setTooltip(null);
        });

        // Click : afficher infos détaillées + zoom (comportement normal uniquement)
        // Le mode UF builder est géré dans le handler général map.on("click")
        map.on("click", "parcelle-fill", (e) => {
          // Ignorer en mode UF builder (géré par le handler général)
          if (ufBuilderModeRef.current) return;
          
          const feature = e.features?.[0];
          if (!feature) return;
          
          const props = feature.properties as any;
          if (!props) return;

          // Comportement normal : zoom et affichage des infos
          const geom = feature.geometry as GeoJSON.Geometry;
          const bbox = turf.bbox(geom);

          map.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]]
            ],
            { padding: 80, duration: 1200, easing: (t) => t * (2 - t) }
          );

          // Afficher les infos de la parcelle
          setSelectedParcelle({
            section: props.section,
            numero: props.numero,
            commune: props.commune,
            insee: props.insee
          });
        });
      }

      // Stocker la fonction dans la ref pour qu'elle soit accessible depuis le JSX
      showParcelleResultRef.current = showParcelleResult;

      // ============================================================
      // Clic sur la carte pour récupérer la parcelle au point
      // ============================================================
      map.on("click", async (e) => {
        // Mode UF builder : accumuler les parcelles
        if (ufBuilderModeRef.current) {
          if (map.getZoom() < PARCELLE_CLICK_ZOOM) {
            alert("Veuillez zoomer davantage pour sélectionner des parcelles");
            return;
          }
          
          const { lng, lat } = e.lngLat;
          
          try {
            const res = await fetch(
              `${API_BASE}/parcelle/par-coordonnees?lon=${lng}&lat=${lat}&buffer=0`
            );
            if (!res.ok) return;
            
            const data = await res.json();
            const targetFeature = data.features.find((f: any) => f.properties.is_target);
            
            if (targetFeature) {
              const props = targetFeature.properties;
              const currentSelection = selectedUfParcellesRef.current;
              
              // Vérifier si déjà sélectionnée
              const alreadySelected = currentSelection.some(
                p => p.section === props.section && p.numero === props.numero
              );
              
              if (alreadySelected) {
                // Désélectionner
                setSelectedUfParcelles(prev => 
                  prev.filter(p => !(p.section === props.section && p.numero === props.numero))
                );
              } else {
                // Ajouter à la sélection (max 5)
                if (currentSelection.length >= 5) {
                  alert("Maximum 5 parcelles pour une unité foncière");
                  return;
                }
                
                setSelectedUfParcelles(prev => [...prev, {
                  section: props.section,
                  numero: props.numero,
                  commune: props.commune || "",
                  insee: props.insee || "",
                  geometry: targetFeature.geometry
                }]);
              }
            }
          } catch (err) {
            console.error("Erreur lors de la sélection de parcelle pour UF:", err);
          }
          return; // Ne pas déclencher le comportement normal
        }
        
        // Comportement normal (recherche de parcelle)
        if (map.getZoom() < PARCELLE_CLICK_ZOOM) return;
        
        // En mode UF builder, gérer aussi les clics sur parcelles déjà affichées
        if (ufBuilderModeRef.current) {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["parcelle-fill"]
          });
          if (features.length > 0) {
            // Clic sur parcelle affichée en mode UF - gérer la sélection
            const feature = features[0];
            const props = feature.properties as any;
            if (props) {
              const currentSelection = selectedUfParcellesRef.current;
              const alreadySelected = currentSelection.some(
                p => p.section === props.section && p.numero === props.numero
              );
              
              if (alreadySelected) {
                // Désélectionner
                setSelectedUfParcelles(prev => 
                  prev.filter(p => !(p.section === props.section && p.numero === props.numero))
                );
              } else {
                // Ajouter à la sélection (max 5)
                if (currentSelection.length >= 5) {
                  alert("Maximum 5 parcelles pour une unité foncière");
                  return;
                }
                
                setSelectedUfParcelles(prev => [...prev, {
                  section: props.section,
                  numero: props.numero,
                  commune: props.commune || "",
                  insee: props.insee || "",
                  geometry: feature.geometry as GeoJSON.Geometry
                }]);
              }
            }
            return;
          }
        } else {
          // En mode normal, ignorer si clic sur parcelles déjà affichées
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["parcelle-fill"]
          });
          if (features.length > 0) return; // Clic sur parcelle existante
        }
        
        const { lng, lat } = e.lngLat;
        
        try {
          const res = await fetch(
            `${API_BASE}/parcelle/par-coordonnees?lon=${lng}&lat=${lat}`
          );
          if (!res.ok) return;
          const data = await res.json();
          showParcelleResult(data, undefined, 17);
          setSelectedParcelle(null);
        } catch (err) {
          console.error(err);
        }
      });

      // ============================================================
      // Listener sur le zoom pour mettre à jour l'état
      // ============================================================
      map.on("zoom", () => {
        setCurrentZoom(map.getZoom());
      });
      
      map.on("zoomend", () => {
        const zoom = map.getZoom();
        setCurrentZoom(zoom);
        
        // Si on zoom en dessous du seuil, réinitialiser l'état des parcelles
        if (zoom < PARCELLE_CLICK_ZOOM) {
          setParcellesDisplayed(false);
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ============================================================
  // Synchronisation des couches après chaque mouvement (pan, zoom, easeTo, fitBounds)
  // Cela évite les rafales de requêtes pendant les animations
  // ============================================================
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMoveEnd = () => {
      syncLayersWithZoom(map, layers, visibility, setActiveLayers);
    };

    map.on("moveend", handleMoveEnd);

    return () => {
      map.off("moveend", handleMoveEnd);
    };
  }, [layers, visibility]);

  // Mettre à jour les filtres des layers de sélection quand selectedParcelle change
  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    const selectedLayer = map.getLayer("parcelle-selected");
    const selectedFillLayer = map.getLayer("parcelle-selected-fill");
    
    if (!selectedLayer || !selectedFillLayer) return;
    
    if (selectedParcelle) {
      // Filtrer pour afficher la parcelle sélectionnée
      const filter: any = [
        "all",
        ["==", ["get", "section"], selectedParcelle.section],
        ["==", ["get", "numero"], selectedParcelle.numero]
      ];
      
      map.setFilter("parcelle-selected", filter);
      map.setFilter("parcelle-selected-fill", filter);
    } else {
      // Masquer la sélection si aucune parcelle n'est sélectionnée
      const emptyFilter: any = ["==", ["get", "section"], ""];
      map.setFilter("parcelle-selected", emptyFilter);
      map.setFilter("parcelle-selected-fill", emptyFilter);
    }
  }, [selectedParcelle]);

  // Mettre à jour la couche UF builder quand la sélection change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const source = map.getSource("uf-builder") as maplibregl.GeoJSONSource;
    if (!source) return;
    
    const geojson = {
      type: "FeatureCollection" as const,
      features: selectedUfParcelles.map(p => ({
        type: "Feature" as const,
        geometry: p.geometry,
        properties: {
          section: p.section,
          numero: p.numero
        }
      }))
    };
    
    source.setData(geojson);
  }, [selectedUfParcelles]);

  // Gérer la visibilité de la couche UF builder selon le mode
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const visibility = ufBuilderMode ? "visible" : "none";
    if (map.getLayer("uf-builder-fill")) {
      map.setLayoutProperty("uf-builder-fill", "visibility", visibility);
      map.setLayoutProperty("uf-builder-outline", "visibility", visibility);
    }
  }, [ufBuilderMode]);

  const toggleLayer = (layerId: string) => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const next = !visibility[layerId];
    setVisibility(v => ({ ...v, [layerId]: next }));

    // PLU géré à part
    if (layerId === "plu_latresne") return;

    if (!next) {
      // ✅ décochage = masquage seulement
      hideLayer(map, layerId);
      return;
    }

    // ✅ recochage
    // si déjà chargée → affichage immédiat
    if (map.getSource(layerId)) {
      showLayer(map, layerId);
      return;
    }

    // sinon → sera chargée au prochain moveend
  };


  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />
      
      {mapRef.current && (
        <ParcelleSearchForm
          onSearch={(geojson, addressPoint, keepSelection = false) => {
            if (!mapRef.current || !showParcelleResultRef.current) return;
            showParcelleResultRef.current(geojson, addressPoint);
            
            // Ne pas réinitialiser selectedParcelle si keepSelection est true (cas d'une UF confirmée)
            if (!keepSelection) {
              setSelectedParcelle(null); // Réinitialiser la sélection
            }
            
            // Si c'est une UF, nettoyer la couche UF builder et réinitialiser le mode
            if (geojson?.features?.some((f: any) => f.properties?.is_target)) {
              const map = mapRef.current;
              const source = map.getSource("uf-builder") as maplibregl.GeoJSONSource;
              if (source) {
                source.setData({ type: "FeatureCollection", features: [] });
              }
              setUfBuilderMode(false);
              setSelectedUfParcelles([]);
            }
          }}
          ufBuilderMode={ufBuilderMode}
          selectedUfParcelles={selectedUfParcelles.map(p => ({
            section: p.section,
            numero: p.numero,
            commune: p.commune,
            insee: p.insee
          }))}
          onUfBuilderToggle={(active) => {
            setUfBuilderMode(active);
            if (!active) {
              // Désactiver le mode → effacer la sélection par clic
              setSelectedUfParcelles([]);
            }
          }}
          onUfParcelleRemove={(section, numero) => {
            setSelectedUfParcelles(prev => 
              prev.filter(p => !(p.section === section && p.numero === numero))
            );
          }}
          onConfirmUF={(parcelles, unionGeometry, commune, insee) => {
            // Créer une parcelle virtuelle pour l'UF avec la géométrie de l'union
            const ufParcelle = {
              section: parcelles.map(p => p.section).join("+"),
              numero: parcelles.map(p => p.numero).join("+"),
              commune,
              insee,
              isUF: true,
              ufParcelles: parcelles,
              ufUnionGeometry: unionGeometry // Géométrie de l'union pour les intersections
            };

            // Afficher la carte de l'UF
            setSelectedParcelle(ufParcelle);

            // Nettoyer la couche UF builder
            if (mapRef.current) {
              const map = mapRef.current;
              const source = map.getSource("uf-builder") as maplibregl.GeoJSONSource;
              if (source) {
                source.setData({ type: "FeatureCollection", features: [] });
              }
            }

            // Réinitialiser le mode UF builder
            setUfBuilderMode(false);
            setSelectedUfParcelles([]);
          }}
        />
      )}

      {/* Toggle dédié PLU (MBTiles, hors LayerSwitcher) */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-40">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={pluVisible}
            onChange={() => {
              if (!mapRef.current) return;
              const map = mapRef.current;
              const next = !pluVisible;
              setPluVisible(next);

              const visibility = next ? "visible" : "none";
              if (map.getLayer("plu_latresne-fill")) {
                map.setLayoutProperty("plu_latresne-fill", "visibility", visibility);
                map.setLayoutProperty("plu_latresne-outline", "visibility", visibility);
                if (map.getLayer("plu_latresne-labels")) {
                  map.setLayoutProperty("plu_latresne-labels", "visibility", visibility);
                }
              }
            }}
            className="w-4 h-4"
          />
          Zonage PLU
        </label>
      </div>

      {layers.length > 0 && (
        <LayerSwitcherLatresne 
          map={mapRef.current}
          layers={layers}
          visibility={visibility}
          onToggle={toggleLayer}
        />
      )}


      {/* Message informatif pour les clics parcelles (dès zoom >= 13) */}
      {currentZoom >= PARCELLE_CLICK_ZOOM && !parcellesDisplayed && !ufBuilderMode && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-black text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
          <span className="text-sm font-medium">Cliquer sur la carte pour afficher les parcelles</span>
        </div>
      )}

      {/* Message informatif pour le mode UF builder */}
      {ufBuilderMode && currentZoom >= PARCELLE_CLICK_ZOOM && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
          <span className="text-sm font-medium">Mode UF actif - Cliquez sur les parcelles pour les ajouter</span>
        </div>
      )}

      {/* Tooltip au survol des parcelles */}
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

      {/* Panneau latéral avec infos parcelle ou unité foncière */}
      {selectedParcelle && (
        selectedParcelle.isUF && selectedParcelle.ufParcelles ? (
          <UniteFonciereCard
            ufParcelles={selectedParcelle.ufParcelles}
            commune={selectedParcelle.commune}
            insee={selectedParcelle.insee}
            unionGeometry={selectedParcelle.ufUnionGeometry}
            onClose={() => setSelectedParcelle(null)}
          />
        ) : (
          <ParcelleCard
            parcelle={selectedParcelle}
            onClose={() => setSelectedParcelle(null)}
          />
        )
      )}
    </div>
  );
}

function getColorByType(type: string): string {
  const colors: Record<string, string> = {
    "Servitudes": "#F6AD55",
    "Prescriptions": "#E53E3E",
    "Informations": "#4299E1",
    "Zonage PLU": "#48BB78",
    "carte": "#805AD5"
  };
  return colors[type] || "#999";
}

function getOutlineByType(type: string): string {
  const colors: Record<string, string> = {
    "Servitudes": "#DD6B20",
    "Prescriptions": "#C53030",
    "Informations": "#2B6CB0",
    "Zonage PLU": "#38A169",
    "carte": "#6B46C1"
  };
  return colors[type] || "#666";
}

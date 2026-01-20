import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import LayerSwitcher from "../components/carto/LayerSwitcher";
import ParcelleSearchForm from "../components/carto/ParcelleSearchform";
import ParcelleCard from "../components/carto/ParcelleCard";
import UniteFonciereCard from "../components/carto/UniteFonciereCard";
import { PLUConsultation } from "../components/carto/PLUConsultation";
import type { ParcelleInfo, ZonageInfo } from "../types/parcelle";

// BBOX précise pour Bordeaux Métropole (minLon, minLat, maxLon, maxLat)
const BORDEAUX_METROPOLE_BOUNDS: [number, number, number, number] = [
  -0.80, 44.70,
  -0.30, 45.03
];

export default function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isReady, setIsReady] = useState(false);
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);
  
  // Tooltip et infos parcelle
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [selectedParcelle, setSelectedParcelle] = useState<ParcelleInfo | null>(null);
  
  const [currentInsee, setCurrentInsee] = useState<string | null>(null);
  const [currentCommune, setCurrentCommune] = useState<string | null>(null);
  const [currentZones, setCurrentZones] = useState<string[]>([]);
  
  // État pour le zoom et l'affichage du message informatif
  const [currentZoom, setCurrentZoom] = useState(5.5);
  const [parcellesDisplayed, setParcellesDisplayed] = useState(false);
  
  // Ref pour éviter les appels multiples lors de l'affichage auto
  const autoFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAutoFetchCenterRef = useRef<[number, number] | null>(null);

  // Cache des communes par département (ici utilisé pour la Gironde uniquement)
  const communesCacheRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const activeDepartementRef = useRef<string | null>(null);
  // Référence pour la commune dont les parcelles sont actuellement chargées
  const activeParcellesInseeRef = useRef<string | null>(null);
  // Référence pour la commune actuellement survolée (pour le highlight au hover)
  const hoveredCommuneIdRef = useRef<string | number | null>(null);
  
  // Référence pour la fonction d'affichage des résultats de recherche de parcelle
  const showParcelleResultRef = useRef<((geojson: any, addressPoint?: [number, number], targetZoom?: number) => void) | null>(null);
  
  // Référence pour la fonction de récupération des zonages UF
  const getZonageForUFRef = useRef<((insee: string, parcelles: Array<{ section: string; numero: string }>) => Promise<ZonageInfo[]>) | null>(null);
  
  // État pour le mode UF builder
  const [ufBuilderMode, setUfBuilderMode] = useState(false);
  const [selectedUfParcelles, setSelectedUfParcelles] = useState<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry?: GeoJSON.Geometry;
  }>>([]);
  const ufBuilderModeRef = useRef(false);
  const selectedUfParcellesRef = useRef<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry?: GeoJSON.Geometry;
  }>>([]);
  
  useEffect(() => {
    ufBuilderModeRef.current = ufBuilderMode;
  }, [ufBuilderMode]);
  
  useEffect(() => {
    selectedUfParcellesRef.current = selectedUfParcelles;
  }, [selectedUfParcelles]);

  // Seuil : au-delà, on active les clics parcelles (désactive les clics communes)
  const PARCELLE_CLICK_ZOOM = 13;
  // Seuil : au-delà, affichage automatique des parcelles au centre de l'écran
  const PARCELLE_AUTO_ZOOM = 17;

  // Délai minimum pour le chargement
  useEffect(() => {
    const timer = setTimeout(() => setMinDelayDone(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return; // évite double init en dev

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Fond IGN Plan vecteur (officiel, cohérent avec les données admin / PLU)
      style: "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json",
      bounds: BORDEAUX_METROPOLE_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      maxZoom: 22, // autorise l'overzoom (réutilisation de la dernière tuile z18)
      attributionControl: false,
    });

    mapRef.current = map;
    
    // Initialiser le zoom à partir de la carte (après fitBounds)
    setCurrentZoom(map.getZoom());

    // Carte prête (tuiles + rendu)
    map.on("idle", () => setIsReady(true));

    map.on("load", async () => {
      // Ajuster légèrement l'opacité du fond (eau / couvert / bâtiments)
      try {
        map.setPaintProperty("water", "fill-opacity", 0.45);
        map.setPaintProperty("landcover", "fill-opacity", 0.35);
        map.setPaintProperty("building", "fill-opacity", 0.25);
      } catch {
        // Certains styles peuvent ne pas avoir exactement ces IDs : on ignore silencieusement
      }

      // ============================================================
      // 1) Source GeoJSON Communes (chargée pour la Gironde uniquement)
      // ============================================================
      map.addSource("communes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // ============================================================
      // 2) Layers Communes (chargées à la demande)
      // ============================================================
      map.addLayer({
        id: "communes-fill",
        type: "fill",
        source: "communes",
        minzoom: 8,
        paint: {
          "fill-color": "#E2E8F0",
          // Opacité pilotée par le feature-state "hover"
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.4, // surbrillance au survol
            0    // sinon invisible
          ],
        },
      });

      map.addLayer({
        id: "communes-outline",
        type: "line",
        source: "communes",
        minzoom: 8,
        paint: {
          "line-color": "#2D3748",
          "line-width": 1,
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 9, 1],
        },
      });

      // ============================================================
      // 3) Couches Vector Tiles (endpoint générique /tiles/{layer}/...)
      //    -> certaines couches peuvent être pré-enregistrées ici si besoin
      //    -> dans ce projet, leur activation est pilotée par le LayerSwitcher
      // ============================================================
      const apiBase = import.meta.env.VITE_API_BASE;

      // ============================================================
      // 3 bis) Source + layers de surbrillance au survol des parcelles
      // ============================================================
      map.addSource("parcelle-hover", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "parcelle-hover-fill",
        type: "fill",
        source: "parcelle-hover",
        paint: {
          "fill-color": "#F97316", // orange
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "parcelle-hover-outline",
        type: "line",
        source: "parcelle-hover",
        paint: {
          "line-color": "#EA580C",
          "line-width": 2,
        },
      });

      // ============================================================
      // 3 ter) Source + layers pour les parcelles sélectionnées pour l'UF (orange)
      // ============================================================
      map.addSource("uf-builder", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Remplissage orange pour les parcelles sélectionnées pour l'UF
      map.addLayer({
        id: "uf-builder-fill",
        type: "fill",
        source: "uf-builder",
        paint: {
          "fill-color": "#F97316", // orange
          "fill-opacity": 0.4,
        },
      });

      // Contour orange pour les parcelles sélectionnées pour l'UF
      map.addLayer({
        id: "uf-builder-outline",
        type: "line",
        source: "uf-builder",
        paint: {
          "line-color": "#EA580C",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });

      // ============================================================
      // 5.5) Fonction utilitaire : charger les parcelles MBTiles d'une commune
      // ============================================================
      function loadParcellesForInsee(insee: string) {
        // Éviter les reloads inutiles si la même commune est déjà chargée
        if (activeParcellesInseeRef.current === insee) return;
        activeParcellesInseeRef.current = insee;
        
        // Mettre à jour currentInsee pour avoir une référence pour les parcelles
        setCurrentInsee(insee);

        // Si une source existe déjà, on la remplace proprement
        if (map.getSource("parcelles-bm")) {
          // Supprimer les layers (cela supprime automatiquement les event listeners attachés)
          if (map.getLayer("parcelles-bm-fill")) map.removeLayer("parcelles-bm-fill");
          if (map.getLayer("parcelles-bm-outline")) map.removeLayer("parcelles-bm-outline");
          
          // Supprimer la source
          map.removeSource("parcelles-bm");
        }

        map.addSource("parcelles-bm", {
          type: "vector",
          tiles: [
            `${apiBase}/tiles/parcelles/${insee}/{z}/{x}/{y}.mvt`
          ],
          minzoom: 14,
          maxzoom: 19
        });

        // Surface invisible pour interactions
        map.addLayer({
          id: "parcelles-bm-fill",
          type: "fill",
          source: "parcelles-bm",
          "source-layer": "parcelles",
          minzoom: 14,
          paint: {
            "fill-color": "#000",
            "fill-opacity": 0
          }
        });

        // Contours visibles
        map.addLayer({
          id: "parcelles-bm-outline",
          type: "line",
          source: "parcelles-bm",
          "source-layer": "parcelles",
          minzoom: 14,
          paint: {
            "line-color": "#111827",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              14, 0.3,
              17, 1.2,
              19, 2
            ],
            "line-opacity": 0.9
          }
        });

        // Hover (tooltip) sur parcelles BM
        map.on("mousemove", "parcelles-bm-fill", (e) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const props = feature.properties as any;

          map.getCanvas().style.cursor = "pointer";

          // Mettre à jour la surbrillance orange
          const hoverSource = map.getSource("parcelle-hover") as maplibregl.GeoJSONSource | undefined;
          if (hoverSource) {
            hoverSource.setData({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: feature.geometry as GeoJSON.Geometry,
                  properties: {},
                },
              ],
            });
          }

          setTooltip({
            x: e.point.x,
            y: e.point.y,
            content: `Section ${props.section} – Parcelle ${props.numero}`
          });
        });

        map.on("mouseleave", "parcelles-bm-fill", () => {
          map.getCanvas().style.cursor = "";
          setTooltip(null);

          // Nettoyer la surbrillance orange
          const hoverSource = map.getSource("parcelle-hover") as maplibregl.GeoJSONSource | undefined;
          if (hoverSource) {
            hoverSource.setData({ type: "FeatureCollection", features: [] });
          }
        });

        // Click sur parcelle BM → sélection directe ou ajout à UF
        map.on("click", "parcelles-bm-fill", async (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties as any;
          if (!props) return;

          // Mode UF builder : ajouter à la sélection
          if (ufBuilderModeRef.current) {
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
              
              // Utiliser code_insee des props, sinon activeParcellesInseeRef (commune chargée), sinon currentInsee
              const inseeCode = props.code_insee || activeParcellesInseeRef.current || currentInsee || "";
              if (!inseeCode) {
                console.error("Code INSEE non disponible pour la parcelle", {
                  props: props,
                  activeParcellesInseeRef: activeParcellesInseeRef.current,
                  currentInsee: currentInsee,
                  allProps: Object.keys(props)
                });
                alert("Impossible de récupérer le code INSEE de la parcelle. Veuillez d'abord sélectionner une commune.");
                return;
              }
              
              console.log("✅ Sélection parcelle UF:", {
                section: props.section,
                numero: props.numero,
                insee: inseeCode,
                commune: props.commune || currentCommune || "",
                source: props.code_insee ? "props.code_insee" : activeParcellesInseeRef.current ? "activeParcellesInseeRef" : "currentInsee"
              });
              
              setSelectedUfParcelles(prev => [...prev, {
                section: props.section,
                numero: props.numero,
                commune: props.commune || currentCommune || "",
                insee: inseeCode,
                geometry: feature.geometry as GeoJSON.Geometry // Stocker la géométrie pour l'affichage
              }]);
            }
            return;
          }

          // Comportement normal : sélection de parcelle
          const bbox = turf.bbox(feature.geometry as GeoJSON.Geometry);
          map.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]]
            ],
            { padding: 80, duration: 900 }
          );

          console.log("🧩 Props parcelle MBTiles (BM):", props);

          // Récupérer la contenance via l'endpoint /parcelle/geometrie
          let contenance: number | undefined = undefined;
          try {
            const geometrieRes = await fetch(
              `${apiBase}/parcelle/geometrie?code_insee=${props.code_insee}&section=${props.section}&numero=${props.numero}`
            );
            if (geometrieRes.ok) {
              const geometrieData = await geometrieRes.json();
              contenance = geometrieData.properties?.contenance;
              console.log("✅ Contenance récupérée:", contenance, "m²");
            }
          } catch (err) {
            console.warn("⚠️ Erreur récupération contenance:", err);
          }

          const zonageData = await getZonageAtPoint(
            props.code_insee,
            props.section,
            props.numero
          );

          setSelectedParcelle({
            section: props.section,
            numero: props.numero,
            commune: props.commune,
            insee: props.code_insee,
            zonage: zonageData?.etiquette,
            typezone: zonageData?.typezone,
            surface: contenance
          });
        });
      }

      // ============================================================
      // 6) Fonction d'affichage des résultats de recherche de parcelle
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
          if (map.getLayer("parcelle-outline")) map.removeLayer("parcelle-outline");
          if (map.getLayer("parcelle-fill")) map.removeLayer("parcelle-fill");
          
          // Supprimer la source
          map.removeSource("parcelle-search");
        }
        
        // Si pas de features dans le geojson, on nettoie donc réinitialiser l'état
        if (!geojson?.features?.length) {
          setParcellesDisplayed(false);
          return; // Ne pas continuer si on nettoie
        }

        // Source GeoJSON des parcelles
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
        // 🟦 Surface de TOUTES les parcelles (transparente, hoverable)
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
        // ⚫ Contours de TOUTES les parcelles (noir)
        // ------------------------------------------------------------
        map.addLayer({
          id: "parcelle-outline",
          type: "line",
          source: "parcelle-search",
          paint: {
            "line-color": "#000000",
            "line-width": 1.2,
            "line-opacity": 0.9
          }
        });

        // ------------------------------------------------------------
        // 🟡 Remplissage de la parcelle cible (jaune clair)
        // ------------------------------------------------------------
        map.addLayer({
          id: "parcelle-target-fill",
          type: "fill",
          source: "parcelle-search",
          filter: ["==", ["get", "is_target"], true],
          paint: {
            "fill-color": "#FFF8DC",
            "fill-opacity": 0.6
          }
        });

        // ------------------------------------------------------------
        // 🔴 Parcelle cible (contour rouge, au-dessus)
        // ------------------------------------------------------------
        map.addLayer({
          id: "parcelle-target",
          type: "line",
          source: "parcelle-search",
          filter: ["==", ["get", "is_target"], true],
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
        // 🎯 Zoom sur la zone
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
        // 🖱️ Interactions hover et click sur les parcelles
        // ------------------------------------------------------------
        // Utiliser la couche fill (transparente) pour les interactions
        // car elle couvre toute la surface, pas seulement les lignes
        
        // Hover : afficher tooltip
        map.on("mousemove", "parcelle-fill", (e) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const props = feature.properties as any;
          
          map.getCanvas().style.cursor = "pointer";

          // Mettre à jour la surbrillance orange
          const hoverSource = map.getSource("parcelle-hover") as maplibregl.GeoJSONSource | undefined;
          if (hoverSource) {
            hoverSource.setData({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: feature.geometry as GeoJSON.Geometry,
                  properties: {},
                },
              ],
            });
          }
          
          setTooltip({
            x: e.point.x,
            y: e.point.y,
            content: `Section ${props.section} – Parcelle ${props.numero}`
          });
        });

        map.on("mouseleave", "parcelle-fill", () => {
          map.getCanvas().style.cursor = "";
          setTooltip(null);

          // Nettoyer la surbrillance orange
          const hoverSource = map.getSource("parcelle-hover") as maplibregl.GeoJSONSource | undefined;
          if (hoverSource) {
            hoverSource.setData({ type: "FeatureCollection", features: [] });
          }
        });

        // Click : afficher infos détaillées + zoom (ou ajout à UF en mode builder)
        map.on("click", "parcelle-fill", async (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          
          const props = feature.properties as any;
          if (!props) return;

          // Mode UF builder : ajouter à la sélection
          if (ufBuilderModeRef.current) {
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
              
              // Utiliser code_insee ou insee des props, sinon activeParcellesInseeRef, sinon currentInsee
              const inseeCode = props.code_insee ?? props.insee ?? activeParcellesInseeRef.current ?? currentInsee ?? "";
              if (!inseeCode) {
                console.warn("Code INSEE non disponible pour la parcelle", props);
                console.warn("activeParcellesInseeRef:", activeParcellesInseeRef.current);
                console.warn("currentInsee:", currentInsee);
                alert("Impossible de récupérer le code INSEE de la parcelle. Veuillez d'abord sélectionner une commune.");
                return;
              }
              
              console.log("Sélection parcelle UF (via recherche):", {
                section: props.section,
                numero: props.numero,
                insee: inseeCode,
                commune: props.commune || currentCommune || ""
              });
              
              setSelectedUfParcelles(prev => [...prev, {
                section: props.section,
                numero: props.numero,
                commune: props.commune || currentCommune || "",
                insee: inseeCode,
                geometry: feature.geometry as GeoJSON.Geometry // Stocker la géométrie pour l'affichage
              }]);
            }
            return; // Ne pas déclencher le comportement normal
          }

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

          console.log("🧩 Props parcelle (recherche/par-coordonnées):", props);

          const insee = props.code_insee ?? props.insee;
          const zonageData = await getZonageAtPoint(
            insee,
            props.section,
            props.numero
          );

          // Afficher les infos de la parcelle
          setSelectedParcelle({
            section: props.section,
            numero: props.numero,
            commune: props.commune,
            insee,
            zonage: zonageData?.etiquette,
            typezone: zonageData?.typezone,
            surface: props.contenance ? Number(props.contenance) : undefined
          });
        });
      }

      // Stocker la fonction dans la ref pour qu'elle soit accessible depuis le JSX
      showParcelleResultRef.current = showParcelleResult;

      // ============================================================
      // 4) Fonction centrale : charger les communes d'un département
      //    (ici, on utilisera "33" pour la Gironde, sans passer par les départements)
      // ============================================================
      async function loadCommunesForDepartement(depInsee: string) {
        if (activeDepartementRef.current === depInsee) return;

        const cache = communesCacheRef.current;
        const source = map.getSource("communes") as maplibregl.GeoJSONSource | undefined;
        if (!source) return;

        if (cache.has(depInsee)) {
          source.setData(cache.get(depInsee)!);
          activeDepartementRef.current = depInsee;
          return;
        }

        const res = await fetch(`${apiBase}/communes?departement=${depInsee}`);
        const geojson = await res.json();

        // Ajout d'un id stable aux communes pour pouvoir utiliser feature-state (hover)
        const communesWithId = {
          ...geojson,
          features: geojson.features.map((f: any, idx: number) => ({
            ...f,
            id: f.id ?? f.properties?.insee ?? idx,
          })),
        };

        // FIFO cache (max 15)
        if (cache.size >= 15) {
          const firstKey = cache.keys().next().value;
          if (firstKey) cache.delete(firstKey);
        }

        cache.set(depInsee, communesWithId);
        source.setData(communesWithId);
        activeDepartementRef.current = depInsee;
      }

      // ============================================================
      // 5) Navigation communale (clic uniquement)
      // ============================================================

      // Clic sur commune : uniquement si zoom < seuil
      map.on("click", "communes-fill", (e) => {
        if (map.getZoom() >= PARCELLE_CLICK_ZOOM) return; // Ignorer si trop zoomé
        
        const feature = e.features?.[0];
        if (!feature) return;

        const props = feature.properties;
        const insee = props?.insee;
        
        setCurrentInsee(insee || null);
        setCurrentCommune(props?.nom || null);

        // Charger les parcelles MBTiles pour cette commune
        if (insee) {
          loadParcellesForInsee(insee);
        }

        const geom = feature.geometry as GeoJSON.Geometry;
        const bbox = turf.bbox(geom);
        const center: [number, number] = [
          (bbox[0] + bbox[2]) / 2,
          (bbox[1] + bbox[3]) / 2
        ];

        // Zoomer directement à z=14 sur la commune cliquée
        map.easeTo({
          center,
          zoom: 14,
          duration: 1200,
          easing: (t) => t * (2 - t)
        });
      });

      // UX curseur + surbrillance pour communes
      map.on("mouseenter", "communes-fill", () => {
        // Curseur main quand on est sur une commune (tant qu'on est en mode "communes")
        if (map.getZoom() < PARCELLE_CLICK_ZOOM) {
          map.getCanvas().style.cursor = "pointer";
        }
      });
      map.on("mousemove", "communes-fill", (e) => {
        // Désactiver la surbrillance quand on est déjà en zoom "parcelles"
        if (map.getZoom() >= PARCELLE_CLICK_ZOOM) {
          if (hoveredCommuneIdRef.current !== null) {
            map.setFeatureState(
              { source: "communes", id: hoveredCommuneIdRef.current },
              { hover: false }
            );
            hoveredCommuneIdRef.current = null;
          }
          return;
        }

        const feature = e.features?.[0];
        if (!feature) return;

        const props = feature.properties as any;
        const insee = props?.insee as string | undefined;

        // Ne pas mettre en surbrillance la commune dont le cadastre est déjà chargé
        if (insee && activeParcellesInseeRef.current === insee) {
          if (hoveredCommuneIdRef.current !== null) {
            map.setFeatureState(
              { source: "communes", id: hoveredCommuneIdRef.current },
              { hover: false }
            );
            hoveredCommuneIdRef.current = null;
          }
          return;
        }

        // On utilise l'id de la feature pour le feature-state "hover"
        const id = feature.id as string | number | undefined;
        if (id === undefined || id === null) return;

        // Réinitialiser l'ancienne commune survolée
        if (hoveredCommuneIdRef.current !== null && hoveredCommuneIdRef.current !== id) {
          map.setFeatureState(
            { source: "communes", id: hoveredCommuneIdRef.current },
            { hover: false }
          );
        }

        // Activer le hover sur la commune courante
        hoveredCommuneIdRef.current = id;
        map.setFeatureState(
          { source: "communes", id },
          { hover: true }
        );
      });
      map.on("mouseleave", "communes-fill", () => {
        map.getCanvas().style.cursor = "";

        // Nettoyer la surbrillance au hover
        if (hoveredCommuneIdRef.current !== null) {
          map.setFeatureState(
            { source: "communes", id: hoveredCommuneIdRef.current },
            { hover: false }
          );
          hoveredCommuneIdRef.current = null;
        }
      });

      // ============================================================
      // 6) Handler moveend : uniquement pour l'auto-fetch des parcelles
      // ============================================================
      map.on("moveend", async () => {
        const zoom = map.getZoom();

        // Auto-fetch parcelles si zoom > 16
        if (zoom >= PARCELLE_AUTO_ZOOM) {
          if (autoFetchTimeoutRef.current) {
            clearTimeout(autoFetchTimeoutRef.current);
          }
          autoFetchTimeoutRef.current = setTimeout(() => {
            autoFetchParcellesAtCenter();
          }, 500);
        }
      });

      // ============================================================
      // 7) Clic sur la carte pour récupérer la parcelle au point
      // ============================================================
      async function getInseeFromCoordinates(lon: number, lat: number) {
        try {
          const res = await fetch(
            `https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}`
          );
          const data = await res.json();
          const feature = data.features?.[0];
          
          if (feature?.properties) {
            return {
              insee: feature.properties.citycode,
              commune: feature.properties.city
            };
          }
        } catch (err) {
          console.error("Erreur reverse geocoding:", err);
        }
        return null;
      }

      async function fetchParcelleParPoint(lon: number, lat: number) {
        try {
          // 1. Récupérer commune + zonage
          const communeInfo = await getInseeFromCoordinates(lon, lat);
          if (communeInfo) {
            setCurrentInsee(communeInfo.insee);
            setCurrentCommune(communeInfo.commune);
            
            // Récupérer le zonage PLU/PLUI
            const zonageRes = await fetch(
              `${apiBase}/api/plu/zonage/${communeInfo.insee}?lon=${lon}&lat=${lat}`
            );
            const zonageData = await zonageRes.json();
            
            if (zonageData.zones?.length > 0) {
              console.log("Zonage détecté:", zonageData.zones);
              setCurrentZones(zonageData.zones);
            } else {
              setCurrentZones([]);
            }
          }
          
          // 2. Récupérer parcelle
          const res = await fetch(
            `${apiBase}/parcelle/par-coordonnees?lon=${lon}&lat=${lat}`
          );
          if (!res.ok) return;
          
          const data = await res.json();
          showParcelleResult(data, undefined, PARCELLE_AUTO_ZOOM);
          
          const firstFeature = data.features?.[0];
          if (firstFeature) {
            const zonageData = await getZonageAtPoint(
              firstFeature.properties?.code_insee,
              firstFeature.properties?.section,
              firstFeature.properties?.numero
            );
            
            setSelectedParcelle({
              section: firstFeature.properties?.section,
              numero: firstFeature.properties?.numero,
              commune: firstFeature.properties?.commune,
              insee: firstFeature.properties?.code_insee,
              zonage: zonageData?.etiquette,
              typezone: zonageData?.typezone,
              surface: firstFeature.properties?.contenance ? Number(firstFeature.properties.contenance) : undefined
            });
          }
        } catch (err) {
          console.error(err);
        }
      }

      async function getZonageAtPoint(
        insee: string,
        section: string,
        numero: string
      ): Promise<{ typezone: string; etiquette: string } | null> {
        try {
          const res = await fetch(
            `${apiBase}/zonage-plui/${insee}/${section}/${numero}`
          );
          
          if (!res.ok) {
            console.warn("Zonage non trouvé");
            return null;
          }
          
          const data = await res.json();
          
          if (!data.typezone || !data.etiquette) {
            return null;
          }
          
          return {
            typezone: data.typezone,
            etiquette: data.etiquette
          };
        } catch (err) {
          console.error("Erreur récupération zonage:", err);
          return null;
        }
      }
      
      async function getZonageForUF(
        insee: string,
        parcelles: Array<{ section: string; numero: string }>
      ): Promise<ZonageInfo[]> {
        try {
          const res = await fetch(
            `${apiBase}/zonage-plui/uf`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                insee,
                parcelles: parcelles.map(p => ({
                  section: p.section,
                  numero: p.numero
                }))
              })
            }
          );
          
          if (!res.ok) {
            console.warn("Erreur récupération zonages UF");
            return [];
          }
          
          const data = await res.json();
          
          // Transformer les résultats en format ZonageInfo
          return data.parcelles.map((p: any) => ({
            section: p.section,
            numero: p.numero,
            typezone: p.typezone || undefined,
            etiquette: p.etiquette || undefined,
            libelle: p.libelle || undefined,
            libelong: p.libelong || undefined
          }));
        } catch (err) {
          console.error("Erreur récupération zonages UF:", err);
          return [];
        }
      }
      
      // Stocker la fonction dans la ref
      getZonageForUFRef.current = getZonageForUF;

      // Clic global pour parcelles : uniquement si zoom >= seuil
      map.on("click", async (e) => {
        // Mode UF builder : accumuler les parcelles
        if (ufBuilderModeRef.current) {
          if (map.getZoom() < PARCELLE_CLICK_ZOOM) {
            alert("Veuillez zoomer davantage pour sélectionner des parcelles");
            return;
          }
          
          // Vérifier si clic sur parcelle BM - laisser le handler spécifique gérer
          const featuresBM = map.queryRenderedFeatures(e.point, {
            layers: ["parcelles-bm-fill"]
          });
          
          if (featuresBM.length > 0) {
            // Le handler spécifique "parcelles-bm-fill" va gérer la sélection
            return;
          }
          
          // Vérifier si clic sur parcelles déjà affichées via recherche - laisser le handler spécifique gérer
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["parcelle-fill"]
          });
          
          if (features.length > 0) {
            // Le handler spécifique "parcelle-fill" va gérer la sélection
            return;
          }
          
          // Sinon, chercher la parcelle au point (cas fallback : aucune parcelle affichée)
          const { lng, lat } = e.lngLat;
          try {
            const res = await fetch(
              `${apiBase}/parcelle/par-coordonnees?lon=${lng}&lat=${lat}&buffer=0`
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
                
                // Utiliser code_insee des props, sinon activeParcellesInseeRef, sinon currentInsee
                const inseeCode = props.code_insee || activeParcellesInseeRef.current || currentInsee || "";
                if (!inseeCode) {
                  console.warn("Code INSEE non disponible pour la parcelle", props);
                  console.warn("activeParcellesInseeRef:", activeParcellesInseeRef.current);
                  console.warn("currentInsee:", currentInsee);
                  alert("Impossible de récupérer le code INSEE de la parcelle. Veuillez d'abord sélectionner une commune.");
                  return;
                }
                
                console.log("Sélection parcelle UF (fallback API):", {
                  section: props.section,
                  numero: props.numero,
                  insee: inseeCode,
                  commune: props.commune || currentCommune || ""
                });
                
                setSelectedUfParcelles(prev => [...prev, {
                  section: props.section,
                  numero: props.numero,
                  commune: props.commune || currentCommune || "",
                  insee: inseeCode,
                  geometry: targetFeature.geometry as GeoJSON.Geometry // Stocker la géométrie pour l'affichage
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
        
        // Ignorer si clic sur parcelle BM (géré par le handler spécifique)
        const featuresBM = map.queryRenderedFeatures(e.point, {
          layers: ["parcelles-bm-fill"]
        });
        if (featuresBM.length > 0) return; // Clic sur parcelle BM
        
        // Ignorer si clic sur UI (parcelles déjà affichées via recherche)
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["parcelle-fill"]
        });
        if (features.length > 0) return; // Clic sur parcelle existante
        
        // Pour les zones hors BM, utiliser l'ancienne méthode
        const { lng, lat } = e.lngLat;
        await fetchParcelleParPoint(lng, lat);
      });

      // ============================================================
      // 8) Affichage automatique des parcelles au centre si zoom > 16
      // ============================================================
      async function autoFetchParcellesAtCenter() {
        const zoom = map.getZoom();
        console.log("Auto-fetch check, zoom:", zoom);
        if (zoom < PARCELLE_AUTO_ZOOM) return;
        
        // Vérifier si des parcelles BM sont déjà visibles à l'écran
        const visibleParcellesBM = map.queryRenderedFeatures(undefined, {
          layers: ["parcelles-bm-fill"]
        });
        
        // Vérifier si des parcelles de recherche sont déjà visibles
        const visibleParcelles = map.queryRenderedFeatures(undefined, {
          layers: ["parcelle-fill"]
        });
        
        if (visibleParcellesBM.length > 0 || visibleParcelles.length > 0) {
          console.log("Parcelles déjà visibles, skip");
          return; // Skip si parcelles déjà affichées
        }
        
        const center = map.getCenter();
        const centerKey: [number, number] = [center.lng, center.lat];
        
        // Vérifier si le centre a changé significativement (éviter les appels inutiles)
        const lastCenter = lastAutoFetchCenterRef.current;
        if (lastCenter) {
          const distance = turf.distance(
            turf.point([lastCenter[0], lastCenter[1]]),
            turf.point([centerKey[0], centerKey[1]]),
            { units: "meters" }
          );
          // Si le centre n'a pas bougé de plus de 10m, ne pas refaire l'appel
          if (distance < 10) {
            console.log("Centre n'a pas changé significativement, skip");
            return;
          }
        }
        
        // Vérifier si on est dans Bordeaux Métropole (parcelles BM disponibles)
        const centerFeatures = map.queryRenderedFeatures(undefined, {
          layers: ["parcelles-bm-fill"]
        });
        
        if (centerFeatures.length === 0) {
          // Hors BM : utiliser l'ancienne méthode API
          console.log("Fetching parcelles at (API):", centerKey);
          lastAutoFetchCenterRef.current = centerKey;
          await fetchParcelleParPoint(centerKey[0], centerKey[1]);
        } else {
          // Dans BM : les parcelles sont déjà visibles via vector tiles
          console.log("Parcelles BM déjà disponibles via vector tiles");
          lastAutoFetchCenterRef.current = centerKey;
        }
      }

      // ============================================================
      // 9) Listener sur le zoom pour mettre à jour l'état
      // ============================================================
      map.on("zoom", () => {
        setCurrentZoom(map.getZoom());
      });
      
      map.on("zoomend", async () => {
        const zoom = map.getZoom();
        setCurrentZoom(zoom);
        
        // Si on zoom en dessous du seuil, réinitialiser l'état des parcelles
        if (zoom < PARCELLE_CLICK_ZOOM) {
          setParcellesDisplayed(false);
          lastAutoFetchCenterRef.current = null;
        }
        
        // Si on est au-dessus du seuil auto, afficher les parcelles au centre
        if (zoom >= PARCELLE_AUTO_ZOOM) {
          // Debounce pour éviter trop d'appels
          if (autoFetchTimeoutRef.current) {
            clearTimeout(autoFetchTimeoutRef.current);
          }
          autoFetchTimeoutRef.current = setTimeout(() => {
            autoFetchParcellesAtCenter();
          }, 300); // Attendre 300ms après la fin du zoom
        }
      });
      // Charger directement les communes de la Gironde (33) au démarrage,
      // sans passer par la couche des départements
      await loadCommunesForDepartement("33");
    });

    return () => {
      // Nettoyer le timeout si présent
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current);
        autoFetchTimeoutRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fade-out du loader
  useEffect(() => {
    if (isReady && minDelayDone) {
      const timer = setTimeout(() => setLoaderVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isReady, minDelayDone]);

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

  // Mettre à jour la couche UF builder quand les parcelles sélectionnées changent
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const source = map.getSource("uf-builder") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    
    // Filtrer les parcelles qui ont une géométrie
    const parcellesAvecGeometrie = selectedUfParcelles.filter(p => p.geometry);
    
    const geojson = {
      type: "FeatureCollection" as const,
      features: parcellesAvecGeometrie.map(p => ({
        type: "Feature" as const,
        geometry: p.geometry!,
        properties: {
          section: p.section,
          numero: p.numero
        }
      }))
    };
    
    source.setData(geojson);
  }, [selectedUfParcelles]);

  // Gérer la visibilité des layers UF builder selon le mode
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const fillLayer = map.getLayer("uf-builder-fill");
    const outlineLayer = map.getLayer("uf-builder-outline");
    
    if (!fillLayer || !outlineLayer) return;
    
    // Afficher les layers uniquement si le mode UF builder est actif
    if (ufBuilderMode) {
      map.setLayoutProperty("uf-builder-fill", "visibility", "visible");
      map.setLayoutProperty("uf-builder-outline", "visibility", "visible");
    } else {
      map.setLayoutProperty("uf-builder-fill", "visibility", "none");
      map.setLayoutProperty("uf-builder-outline", "visibility", "none");
    }
  }, [ufBuilderMode]);

  const shouldFadeOut = isReady && minDelayDone;

  return (
    <div className="relative w-full h-full" style={{ width: "100%", height: "100vh" }}>
      {loaderVisible && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${
            shouldFadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ width: "100vw", height: "100vh" }}
        >
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-black rounded-full animate-spin"></div>
          </div>
          <div className="text-black text-sm">Chargement des données territoriales…</div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" style={{ width: "100%", height: "100vh" }} />

      {mapRef.current && (
        <ParcelleSearchForm
          onSearch={(geojson, addressPoint) => {
            if (!mapRef.current || !showParcelleResultRef.current) return;
            showParcelleResultRef.current(geojson, addressPoint);
            setSelectedParcelle(null); // Réinitialiser la sélection
          }}
          ufBuilderMode={ufBuilderMode}
          selectedUfParcelles={selectedUfParcelles}
          onUfBuilderToggle={(active) => {
            setUfBuilderMode(active);
            if (!active) {
              setSelectedUfParcelles([]);
            }
          }}
          onUfParcelleRemove={(section, numero) => {
            setSelectedUfParcelles(prev =>
              prev.filter(p => !(p.section === section && p.numero === numero))
            );
          }}
          onConfirmUF={async (parcelles, unionGeometry, commune, insee) => {
            // Vérifier que toutes les parcelles ont le même code INSEE
            const inseeCodes = parcelles
              .map(p => p.insee)
              .filter(insee => insee && insee.trim() !== "");
            
            if (inseeCodes.length === 0) {
              alert("Impossible de créer l'unité foncière : aucune parcelle n'a de code INSEE.");
              return;
            }
            
            const uniqueInsee = [...new Set(inseeCodes)];
            if (uniqueInsee.length > 1) {
              alert("Impossible de créer l'unité foncière : les parcelles appartiennent à des communes différentes.");
              return;
            }
            
            // Utiliser le code INSEE des parcelles (ou celui passé en paramètre)
            const finalInsee = uniqueInsee[0] || insee;
            
            if (!finalInsee) {
              alert("Impossible de créer l'unité foncière : code INSEE manquant.");
              return;
            }
            
            // Récupérer les zonages pour toutes les parcelles
            if (!getZonageForUFRef.current) {
              console.error("getZonageForUF non disponible");
              return;
            }
            
            console.log("Récupération zonages UF pour:", {
              insee: finalInsee,
              parcelles: parcelles.map(p => `${p.section} ${p.numero}`)
            });
            
            const zonages = await getZonageForUFRef.current(finalInsee, parcelles);
            
            setSelectedParcelle({
              section: parcelles.map(p => p.section).join("+"),
              numero: parcelles.map(p => p.numero).join("+"),
              commune,
              insee: finalInsee,
              isUF: true,
              ufParcelles: parcelles,
              ufUnionGeometry: unionGeometry,
              zonages: zonages
            });
          }}
        />
      )}

      {mapRef.current && <LayerSwitcher map={mapRef.current} />}
      
      {/* Message informatif pour le mode UF builder */}
      {ufBuilderMode && currentZoom >= PARCELLE_CLICK_ZOOM && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
          <span className="text-sm font-medium">Mode UF actif - Cliquez sur les parcelles pour les ajouter ({selectedUfParcelles.length}/5)</span>
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

      <PLUConsultation
        inseeCode={currentInsee}
        communeName={currentCommune}
        zones={currentZones}
        visible={currentZoom >= 14}
      />
    </div>
  );
}

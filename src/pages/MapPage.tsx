import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import LayerSwitcher from "../components/carto/LayerSwitcher";
import ParcelleSearchForm from "../components/carto/ParcelleSearchform";
import ParcelleCard from "../components/carto/ParcelleCard";
import { PLUConsultation } from "../components/carto/PLUConsultation";
import registerPluiBordeauxLayer from "../carto/layers/pluiBordeaux";

export default function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isReady, setIsReady] = useState(false);
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);
  
  // Tooltip et infos parcelle
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [selectedParcelle, setSelectedParcelle] = useState<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
  } | null>(null);
  
  const [currentInsee, setCurrentInsee] = useState<string | null>(null);
  const [currentCommune, setCurrentCommune] = useState<string | null>(null);
  const [currentZones, setCurrentZones] = useState<string[]>([]);
  
  // État pour le zoom et l'affichage du message informatif
  const [currentZoom, setCurrentZoom] = useState(5.5);
  const [parcellesDisplayed, setParcellesDisplayed] = useState(false);
  
  // Ref pour éviter les appels multiples lors de l'affichage auto
  const autoFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAutoFetchCenterRef = useRef<[number, number] | null>(null);

  // Cache des communes par département
  const communesCacheRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const activeDepartementRef = useRef<string | null>(null);
  
  // Référence pour la fonction d'affichage des résultats de recherche de parcelle
  const showParcelleResultRef = useRef<((geojson: any, addressPoint?: [number, number], targetZoom?: number) => void) | null>(null);

  // Zoom à partir duquel on considère que l'utilisateur est "dans" un département
  const COMMUNES_ZOOM_THRESHOLD = 8.5;
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
      center: [2.5, 46.5],
      zoom: 5.5,
      maxZoom: 22, // autorise l'overzoom (réutilisation de la dernière tuile z18)
      attributionControl: false,
    });

    mapRef.current = map;
    
    // Initialiser le zoom
    setCurrentZoom(5.5);

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
      // 1) Charger uniquement les départements
      // ============================================================
      const resDeps = await fetch(`${import.meta.env.VITE_API_BASE}/departements`);
      const depsData = await resDeps.json();

      // On s'assure que chaque département a un id stable pour feature-state
      const depsWithId = {
        ...depsData,
        features: depsData.features.map((f: any, idx: number) => ({
          ...f,
          id: f.id ?? f.properties?.insee ?? idx,
        })),
      };

      // ============================================================
      // 2) Sources GeoJSON (deps + communes à la demande)
      // ============================================================
      map.addSource("departements", { type: "geojson", data: depsWithId });

      map.addSource("communes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // ============================================================
      // 3) Layers Départements
      // ============================================================
      map.addLayer({
        id: "departements-fill",
        type: "fill",
        source: "departements",
        paint: {
          "fill-color": "#CBD5E0",
          "fill-opacity": 0,
        },
      });

      map.addLayer({
        id: "deps-layer",
        type: "line",
        source: "departements",
        paint: {
          "line-color": "#4A5568",
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.5, 9, 1.5, 12, 0.8, 15, 0.5],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 1, 9, 1, 12, 0.4, 15, 0.2],
        },
      });

      // ============================================================
      // 4) Layers Communes (chargées à la demande)
      // ============================================================
      map.addLayer({
        id: "communes-fill",
        type: "fill",
        source: "communes",
        minzoom: 8,
        paint: {
          "fill-color": "#E2E8F0",
          "fill-opacity": 0,
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
      // 5) Couches Vector Tiles (endpoint générique /tiles/{layer}/...)
      //    -> certaines couches peuvent être pré-enregistrées ici si besoin
      //    -> dans ce projet, leur activation est pilotée par le LayerSwitcher
      // ============================================================
      const apiBase = import.meta.env.VITE_API_BASE;

      // Enregistrer la couche PLUI Bordeaux
      registerPluiBordeauxLayer(map, apiBase);

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

        // Click : afficher infos détaillées + zoom
        map.on("click", "parcelle-fill", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          
          const props = feature.properties as any;
          if (!props) return;

          // Zoom sur la parcelle
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
      // 7) Fonction centrale : charger les communes d'un département
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
      // 8) Navigation hiérarchique (clic uniquement)
      // ============================================================
      
      // Clic sur département : zoom + charger communes
      map.on("click", "departements-fill", async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const depInsee = feature.properties?.insee;
        if (!depInsee) return;

        const geom = feature.geometry as GeoJSON.Geometry;
        const bbox = turf.bbox(geom);

        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 60, duration: 1200, easing: (t) => t * (2 - t) }
        );

        await loadCommunesForDepartement(depInsee);
      });

      // Clic sur commune : uniquement si zoom < seuil
      map.on("click", "communes-fill", (e) => {
        if (map.getZoom() >= PARCELLE_CLICK_ZOOM) return; // Ignorer si trop zoomé
        
        const feature = e.features?.[0];
        if (!feature) return;

        const props = feature.properties;
        setCurrentInsee(props?.insee || null);
        setCurrentCommune(props?.nom || null);

        const geom = feature.geometry as GeoJSON.Geometry;
        const bbox = turf.bbox(geom);

        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 80, duration: 1200, easing: (t) => t * (2 - t) }
        );
      });

      // UX curseur pour départements et communes
      map.on("mouseenter", "departements-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "departements-fill", () => (map.getCanvas().style.cursor = ""));
      // Curseur pour communes : pointer uniquement si on est en dessous du seuil
      map.on("mouseenter", "communes-fill", () => {
        if (map.getZoom() < PARCELLE_CLICK_ZOOM) {
          map.getCanvas().style.cursor = "pointer";
        }
      });
      map.on("mouseleave", "communes-fill", () => (map.getCanvas().style.cursor = ""));

      // ============================================================
      // 9) Handler unifié pour moveend (communes + parcelles auto)
      // ============================================================
      map.on("moveend", async () => {
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        
        // 1. Charger communes si zoom approprié
        if (zoom >= COMMUNES_ZOOM_THRESHOLD) {
          const bboxPoly = turf.bboxPolygon([
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
          ]);

          const features = map.queryRenderedFeatures(undefined, { layers: ["departements-fill"] });
          if (features.length) {
            let bestDep: { insee: string; area: number } | null = null;

            for (const f of features) {
              const depInsee = (f.properties as any)?.insee;
              if (!depInsee) continue;

              const intersection = turf.intersect(bboxPoly, f.geometry as any);
              if (!intersection) continue;

              const area = turf.area(intersection);
              if (!bestDep || area > bestDep.area) bestDep = { insee: depInsee, area };
            }

            if (bestDep) await loadCommunesForDepartement(bestDep.insee);
          }
        }
        
        // 2. Auto-fetch parcelles si zoom > 16
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
      // 10) Clic sur la carte pour récupérer la parcelle au point
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
          setSelectedParcelle(null);
        } catch (err) {
          console.error(err);
        }
      }

      // Clic global pour parcelles : uniquement si zoom >= seuil
      map.on("click", async (e) => {
        if (map.getZoom() < PARCELLE_CLICK_ZOOM) return;
        
        // Ignorer si clic sur UI (parcelles déjà affichées)
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["parcelle-fill"]
        });
        if (features.length > 0) return; // Clic sur parcelle existante
        
        const { lng, lat } = e.lngLat;
        await fetchParcelleParPoint(lng, lat);
      });

      // ============================================================
      // 11) Affichage automatique des parcelles au centre si zoom > 16
      // ============================================================
      async function autoFetchParcellesAtCenter() {
        const zoom = map.getZoom();
        console.log("Auto-fetch check, zoom:", zoom);
        if (zoom < PARCELLE_AUTO_ZOOM) return;
        
        // Vérifier si des parcelles sont déjà visibles à l'écran
        const visibleParcelles = map.queryRenderedFeatures(undefined, {
          layers: ["parcelle-fill"]
        });
        
        if (visibleParcelles.length > 0) {
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
        
        console.log("Fetching parcelles at:", centerKey);
        lastAutoFetchCenterRef.current = centerKey;
        await fetchParcelleParPoint(centerKey[0], centerKey[1]);
      }

      // ============================================================
      // 12) Listener sur le zoom pour mettre à jour l'état
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
        />
      )}

      {mapRef.current && <LayerSwitcher map={mapRef.current} />}

      {/* Message informatif pour les clics parcelles (dès zoom >= 15) */}
      {currentZoom >= PARCELLE_CLICK_ZOOM && !parcellesDisplayed && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-black text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
          <span className="text-sm font-medium">Cliquer sur la carte pour afficher les parcelles</span>
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

      {/* Panneau latéral avec infos parcelle */}
      {selectedParcelle && (
        <ParcelleCard
          parcelle={selectedParcelle}
          onClose={() => setSelectedParcelle(null)}
        />
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

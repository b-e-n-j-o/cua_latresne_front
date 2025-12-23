// src/pages/MapPage.tsx
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import LayerSwitcher from "../components/carto/LayerSwitcher";

export default function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);

  // Cache des communes par département
  const communesCacheRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const activeDepartementRef = useRef<string | null>(null);
  
  // Zoom à partir duquel on considère que l'utilisateur est "dans" un département
  const COMMUNES_ZOOM_THRESHOLD = 8.5;

  // Délai minimum pour le chargement
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinDelayDone(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [2.5, 46.5], // Centre géographique de la France
      zoom: 5.5, // Vue de la France entière
      // Désactiver les contrôles par défaut
      attributionControl: false,
    });

    mapRef.current = map;

    // Écouter l'événement "idle" pour savoir quand la carte est prête
    map.on("idle", () => {
      setIsReady(true);
    });

    map.on("load", async () => {
      // 1. Charger uniquement les départements
      const resDeps = await fetch(`${import.meta.env.VITE_API_BASE}/departements`);
      const depsData = await resDeps.json();

      // 2. Ajouter les sources
      map.addSource("departements", { type: "geojson", data: depsData });
      
      // Source communes vide (chargée à la demande)
      map.addSource("communes", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      });

      // 3. Layer Départements (Visible de loin, reste visible avec opacité réduite)
      // Layer fill pour les clics (reste actif pour les interactions)
      map.addLayer({
        id: "departements-fill",
        type: "fill",
        source: "departements",
        // Pas de maxzoom - reste toujours actif pour les clics
        paint: {
          "fill-color": "transparent",
          "fill-opacity": 0
        }
      });

      // Layer line pour l'affichage (opacité réduite progressivement au zoom)
      map.addLayer({
        id: "deps-layer",
        type: "line",
        source: "departements",
        // Pas de maxzoom - reste visible mais avec opacité réduite
        paint: {
          "line-color": "#4A5568",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 1.5,    // Épaisseur normale à zoom 5
            9, 1.5,    // Épaisseur normale jusqu'à zoom 9
            12, 0.8,   // Épaisseur réduite à zoom 12
            15, 0.5    // Très fine à zoom 15
          ],
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 1,      // Pleinement visible à zoom 5
            9, 1,      // Pleinement visible jusqu'à zoom 9
            12, 0.4,   // Opacité réduite à zoom 12
            15, 0.2    // Très transparent à zoom 15
          ]
        }
      });

      // 4. Layer Communes (Apparaît en zoomant)
      // Layer fill transparent pour les clics
      map.addLayer({
        id: "communes-fill",
        type: "fill",
        source: "communes",
        minzoom: 8,
        paint: {
          "fill-color": "transparent",
          "fill-opacity": 0
        }
      });

      // Layer line pour l'affichage
      map.addLayer({
        id: "communes-outline",
        type: "line",
        source: "communes",
        minzoom: 8, // Apparaît un peu avant la disparition des départements
        paint: {
          "line-color": "#2D3748",
          "line-width": 1,
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 9, 1] // Fondu progressif
        }
      });

      // Source vector tiles PLUI
      map.addSource("plui", {
        type: "vector",
        tiles: [
          `${import.meta.env.VITE_API_BASE}/tiles/plui/{z}/{x}/{y}.mvt`
        ],
        maxzoom: 18,
        // ⚠️ Pas de minzoom sur la source - laissé aux layers uniquement
      });

      map.addLayer({
        id: "plui-fill",
        type: "fill",
        source: "plui",
        "source-layer": "plu",
        minzoom: 12, // seuil logique
        paint: {
          // Couleurs basées sur libelle (identique pour PLU et PLUi)
          "fill-color": [
            "match",
            ["get", "libelle"],
            // Zones urbaines
            "U", "#FF4F3B",      // Urbain - Rouge
            "UA", "#FF6F61",     // Urbain A - Rouge clair
            "UB", "#FF8A80",     // Urbain B - Rouge très clair
            // Zones à urbaniser
            "AU", "#FFA726",     // À urbaniser - Orange
            // Zones agricoles
            "A", "#66BB6A",      // Agricole - Vert
            // Zones naturelles
            "N", "#42A5F5",      // Naturel - Bleu
            // Fallback
            "#CCCCCC"            // Autre - Gris
          ],
          // Fondu PROGRESSIF lié au zoom
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 0,     // invisible à 12
            13, 0.5    // pleinement visible à 13
          ],
          // Fondu à l'arrivée des tuiles
          "fill-opacity-transition": {
            duration: 300,
            delay: 0
          }
        },
      });
      
      map.addLayer({
        id: "plui-outline",
        type: "line",
        source: "plui",
        "source-layer": "plu",
        minzoom: 12,
        paint: {
          "line-color": "#333",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 0.2,
            14, 0.6
          ],
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 0,
            13, 0.8
          ],
          "line-opacity-transition": {
            duration: 250,
            delay: 0
          }
        },
      });

      // Layer labels PLUI (zonage)
      map.addLayer({
        id: "plui-labels",
        type: "symbol",
        source: "plui",
        "source-layer": "plu",
        minzoom: 13,
        layout: {
          "text-field": ["get", "libelle"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 10,   // Taille 10 à zoom 13
            15, 14,   // Taille 14 à zoom 15
            18, 18    // Taille 18 à zoom 18
          ],
          "text-anchor": "center",
          "text-allow-overlap": false,
          "text-ignore-placement": false
        },
        paint: {
          "text-color": "#1a1a1a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
          "text-halo-blur": 1,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 0,     // invisible à 13
            13.5, 0.8  // visible à 13.5
          ]
        }
      });

      // ============================================================
      // 🎯 Fonction centrale : charger les communes d'un département
      // ============================================================
      
      async function loadCommunesForDepartement(depInsee: string, map: maplibregl.Map) {
        // déjà actif → rien à faire
        if (activeDepartementRef.current === depInsee) return;

        // cache hit
        const cache = communesCacheRef.current;
        if (cache.has(depInsee)) {
          const source = map.getSource("communes") as maplibregl.GeoJSONSource;
          if (source) {
            source.setData(cache.get(depInsee)!);
          }
          activeDepartementRef.current = depInsee;
          return;
        }

        // fetch
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/communes?departement=${depInsee}`
        );
        const geojson = await res.json();

        // Limitation FIFO du cache (max 15 départements)
        if (cache.size > 15) {
          const firstKey = cache.keys().next().value;
          if (firstKey) {
            cache.delete(firstKey); // Supprime le plus ancien (FIFO)
          }
        }

        cache.set(depInsee, geojson);
        const source = map.getSource("communes") as maplibregl.GeoJSONSource;
        if (source) {
          source.setData(geojson);
        }
        activeDepartementRef.current = depInsee;
      }

      // ============================================================
      // 🎯 Navigation hiérarchique : Zoom fluide au clic
      // ============================================================

      // Zoom au clic sur un département
      map.on("click", "departements-fill", async (e) => {
        if (!e.features?.[0]) return;

        const feature = e.features[0];
        const depInsee = feature.properties?.insee;
        if (!depInsee) return;

        const geom = feature.geometry as GeoJSON.Geometry;
        const bbox = turf.bbox(geom);

        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]]
          ],
          {
            padding: 60,
            duration: 1200,
            easing: (t) => t * (2 - t) // easeOutQuad
          }
        );

        // Charger les communes du département
        await loadCommunesForDepartement(depInsee, map);
      });

      // Zoom au clic sur une commune
      map.on("click", "communes-fill", (e) => {
        if (!e.features || !e.features[0]) return;

        const feature = e.features[0];
        const geom = feature.geometry as GeoJSON.Geometry;
        const bbox = turf.bbox(geom);

        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]]
          ],
          {
            padding: 80,
            duration: 1200,
            easing: (t) => t * (2 - t)
          }
        );

        // Pas de filtre sur les layers PLUI : les tuiles MVT se chargent automatiquement
        // pour la zone visible après le zoom
      });

      // ============================================================
      // 🎨 Curseur interactif (UX)
      // ============================================================

      // Curseur pour les départements
      map.on("mouseenter", "departements-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "departements-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // Curseur pour les communes
      map.on("mouseenter", "communes-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "communes-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // ============================================================
      // 🎯 Détection automatique du département dominant au zoom
      // ============================================================
      
      map.on("moveend", async () => {
        const zoom = map.getZoom();
        if (zoom < COMMUNES_ZOOM_THRESHOLD) return;

        const bounds = map.getBounds();
        const bboxPoly = turf.bboxPolygon([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth()
        ]);

        // Requête des départements visibles
        const features = map.queryRenderedFeatures(undefined, {
          layers: ["departements-fill"]
        });

        if (!features.length) return;

        let bestDep: { insee: string; area: number } | null = null;

        for (const f of features) {
          const depInsee = f.properties?.insee;
          if (!depInsee) continue;

          const intersection = turf.intersect(
            bboxPoly,
            f.geometry as GeoJSON.Geometry
          );

          if (!intersection) continue;

          const area = turf.area(intersection);

          if (!bestDep || area > bestDep.area) {
            bestDep = { insee: depInsee, area };
          }
        }

        if (bestDep) {
          await loadCommunesForDepartement(bestDep.insee, map);
        }
      });
    });

    return () => map.remove();
  }, []);

  // Gérer le fade-out du loader
  useEffect(() => {
    if (isReady && minDelayDone) {
      // Attendre la fin de la transition avant de retirer du DOM
      const timer = setTimeout(() => {
        setLoaderVisible(false);
      }, 500); // Durée de la transition

      return () => clearTimeout(timer);
    }
  }, [isReady, minDelayDone]);

  const shouldFadeOut = isReady && minDelayDone;

  return (
    <div className="relative w-full h-full" style={{ width: "100%", height: "100vh" }}>
      {/* Loader - prend toute la page avec fade-out */}
      {loaderVisible && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${
            shouldFadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ width: "100vw", height: "100vh" }}
        >
          {/* Spinner noir */}
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-black rounded-full animate-spin"></div>
          </div>
          
          {/* Texte noir */}
          <div className="text-black text-sm">
            Chargement des données territoriales…
          </div>
        </div>
      )}

      {/* Carte */}
      <div ref={containerRef} className="w-full h-full" style={{ width: "100%", height: "100vh" }} />

      {/* Layer switcher (une fois la map initialisée) */}
      {mapRef.current && <LayerSwitcher map={mapRef.current} />}
    </div>
  );
}

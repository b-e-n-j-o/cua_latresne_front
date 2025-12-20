// src/pages/MapPage.tsx
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";

export default function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);

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
      // 1. Charger les deux sources en parallèle
      const [resDeps, resComs] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE}/departements`),
        fetch(`${import.meta.env.VITE_API_BASE}/communes`)
      ]);

      const depsData = await resDeps.json();
      const comsData = await resComs.json();

      // 2. Ajouter les sources
      map.addSource("departements", { type: "geojson", data: depsData });
      map.addSource("communes", { type: "geojson", data: comsData });

      // 3. Layer Départements (Visible de loin)
      // Layer fill pour les clics
      map.addLayer({
        id: "departements-fill",
        type: "fill",
        source: "departements",
        maxzoom: 9,
        paint: {
          "fill-color": "transparent",
          "fill-opacity": 0
        }
      });

      // Layer line pour l'affichage
      map.addLayer({
        id: "deps-layer",
        type: "line",
        source: "departements",
        maxzoom: 9, // Disparaît quand on zoome assez
        paint: { "line-color": "#4A5568", "line-width": 1.5 }
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
      // 🎯 Navigation hiérarchique : Zoom fluide au clic
      // ============================================================

      // Zoom au clic sur un département
      map.on("click", "departements-fill", (e) => {
        if (!e.features || !e.features[0]) return;

        const geom = e.features[0].geometry as GeoJSON.Geometry;
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
      });

      // Zoom au clic sur une commune
      map.on("click", "communes-fill", (e) => {
        if (!e.features || !e.features[0]) return;

        const feature = e.features[0];
        const geom = feature.geometry as GeoJSON.Geometry;
        const bbox = turf.bbox(geom);
        
        // Récupérer l'insee de la commune cliquée
        const insee = feature.properties?.insee;

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

        // Filtrer les layers PLU/PLUi par commune (optionnel mais recommandé)
        if (insee) {
          map.setFilter("plui-fill", ["==", ["get", "insee"], insee]);
          map.setFilter("plui-outline", ["==", ["get", "insee"], insee]);
          map.setFilter("plui-labels", ["==", ["get", "insee"], insee]);
        }
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
    </div>
  );
}

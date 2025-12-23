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
      attributionControl: false,
    });

    mapRef.current = map;

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
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.25,
            0
          ],
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
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.25,
            0
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
      // 5) Couches Vector Tiles (endpoint générique /tiles/{layer}/...)
      //    -> certaines couches peuvent être pré-enregistrées ici si besoin
      //    -> dans ce projet, leur activation est pilotée par le LayerSwitcher
      // ============================================================
      const apiBase = import.meta.env.VITE_API_BASE;

      // ============================================================
      // 6) Fonction centrale : charger les communes d'un département
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
      // 7) Navigation hiérarchique
      //    + mise en évidence visuelle au survol
      // ============================================================
      let hoveredDepartementId: string | number | null = null;
      let hoveredCommuneId: string | number | null = null;

      map.on("mousemove", "departements-fill", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        if (hoveredDepartementId != null) {
          map.setFeatureState(
            { source: "departements", id: hoveredDepartementId },
            { hover: false }
          );
        }

        hoveredDepartementId = feature.id as string | number | null;
        if (hoveredDepartementId != null) {
          map.setFeatureState(
            { source: "departements", id: hoveredDepartementId },
            { hover: true }
          );
        }
      });

      map.on("mouseleave", "departements-fill", () => {
        if (hoveredDepartementId != null) {
          map.setFeatureState(
            { source: "departements", id: hoveredDepartementId },
            { hover: false }
          );
        }
        hoveredDepartementId = null;
      });

      map.on("mousemove", "communes-fill", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        if (hoveredCommuneId != null) {
          map.setFeatureState(
            { source: "communes", id: hoveredCommuneId },
            { hover: false }
          );
        }

        hoveredCommuneId = feature.id as string | number | null;
        if (hoveredCommuneId != null) {
          map.setFeatureState(
            { source: "communes", id: hoveredCommuneId },
            { hover: true }
          );
        }
      });

      map.on("mouseleave", "communes-fill", () => {
        if (hoveredCommuneId != null) {
          map.setFeatureState(
            { source: "communes", id: hoveredCommuneId },
            { hover: false }
          );
        }
        hoveredCommuneId = null;
      });
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

      map.on("click", "communes-fill", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

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

      // UX curseur
      map.on("mouseenter", "departements-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "departements-fill", () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", "communes-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "communes-fill", () => (map.getCanvas().style.cursor = ""));

      // ============================================================
      // 8) Détection automatique du département dominant au zoom
      // ============================================================
      map.on("moveend", async () => {
        const zoom = map.getZoom();
        if (zoom < COMMUNES_ZOOM_THRESHOLD) return;

        const bounds = map.getBounds();
        const bboxPoly = turf.bboxPolygon([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ]);

        // features visibles (viewport)
        const features = map.queryRenderedFeatures(undefined, { layers: ["departements-fill"] });
        if (!features.length) return;

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
      });
    });

    return () => {
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

      {mapRef.current && <LayerSwitcher map={mapRef.current} />}
    </div>
  );
}

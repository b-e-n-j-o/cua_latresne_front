import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./PluMapPanel.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ZoneFeature = {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: {
    code_zone:             string;
    libelle:               string | null;
    libelong:              string | null;
    typezone:              string | null;
    pct_parcelle_couverte: number | null;
    color:                 string;
  };
};

type ParcelleFeature = {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: {
    section?:    string | null;
    numero?:     string | null;
    idu?:        string | null;
    contenance?: number | null;
  };
};

export type MapData = {
  parcelle: ParcelleFeature;
  zones:    { type: "FeatureCollection"; features: ZoneFeature[] };
};

type Props = {
  sessionId:  string | null;
  mapData:    MapData | null;          // données déjà chargées (push depuis chat)
  apiBase:    string;
  isVisible:  boolean;
  onClose:    () => void;
};

// ---------------------------------------------------------------------------
// Couleurs fixes pour la cohérence avec le backend
// ---------------------------------------------------------------------------
const PARCELLE_OUTLINE = "#FFD600";
const PARCELLE_FILL    = "rgba(255, 214, 0, 0.08)";
const MAP_BUFFER_M     = 100;
const ZONE_FILL_OPACITY = 0.48;

const LAYER_IDS = [
  "plu-zones-fill",
  "plu-zones-outline",
  "plu-zones-label",
  "parcelle-fill",
  "parcelle-outline",
] as const;

const SOURCE_IDS = ["plu-zones", "parcelle"] as const;

function geometryHasArea(geom: GeoJSON.Geometry | null | undefined): boolean {
  if (!geom) return false;
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
    return true;
  }
  if (geom.type === "GeometryCollection") {
    return geom.geometries.some(geometryHasArea);
  }
  return false;
}

/** MapLibre attend des propriétés plates ; on force la couleur pour le style data-driven. */
function enrichZoneFeatures(features: ZoneFeature[]): GeoJSON.Feature[] {
  return features
    .filter((f) => geometryHasArea(f.geometry))
    .map((f) => ({
      type: "Feature" as const,
      geometry: f.geometry,
      properties: {
        ...f.properties,
        color: f.properties.color || "#9CA3AF",
      },
    }));
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export default function PluMapPanel({ sessionId, mapData: propMapData, apiBase, isVisible, onClose }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const popupRef        = useRef<maplibregl.Popup | null>(null);
  const zoneHandlersRef = useRef<{
    onZoneClick?: (e: maplibregl.MapLayerMouseEvent) => void;
    onEnter?: () => void;
    onLeave?: () => void;
  }>({});

  const [mapData, setMapData]   = useState<MapData | null>(propMapData);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set());

  // Sync données depuis prop (push depuis PluChat quand le LLM appelle get_map_data)
  useEffect(() => {
    if (propMapData) {
      setMapData(propMapData);
      setError(null);
    }
  }, [propMapData]);

  // Fetch depuis l'API si on a un sessionId mais pas encore de données
  const fetchMapData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/api/plu/argeles/session/${sessionId}/map?buffer_m=${MAP_BUFFER_M}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MapData = await res.json();
      setMapData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [sessionId, apiBase]);

  useEffect(() => {
    if (isVisible && sessionId) {
      void fetchMapData();
    }
  }, [isVisible, sessionId, fetchMapData]);

  // Init zones visibles depuis les données
  useEffect(() => {
    if (!mapData) return;
    const codes = new Set(mapData.zones.features.map((f) => f.properties.code_zone));
    setVisibleZones(codes);
  }, [mapData]);

  // ---------------------------------------------------------------------------
  // Init MapLibre
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isVisible || !mapContainerRef.current) return;
    if (mapRef.current) return; // déjà initialisée

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "esri-satellite": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "© Esri, Maxar, Earthstar Geographics",
          },
        },
        layers: [{ id: "background", type: "raster", source: "esri-satellite" }],
      },
      center: [3.027, 42.547],
      zoom: 14,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    mapRef.current.on("load", () => {
      // Les sources/couches sont ajoutées via updateMapLayers
    });

    return () => {
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [isVisible]);

  // ---------------------------------------------------------------------------
  // Mise à jour des couches quand mapData ou visibleZones changent
  // ---------------------------------------------------------------------------
  const updateMapLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapData || !map.isStyleLoaded()) return;

    const h = zoneHandlersRef.current;
    if (h.onZoneClick) map.off("click", "plu-zones-fill", h.onZoneClick);
    if (h.onEnter) map.off("mouseenter", "plu-zones-fill", h.onEnter);
    if (h.onLeave) map.off("mouseleave", "plu-zones-fill", h.onLeave);

    LAYER_IDS.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    SOURCE_IDS.forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });

    const visibleFeatures = enrichZoneFeatures(
      mapData.zones.features.filter((f) => visibleZones.has(f.properties.code_zone)),
    );

    if (visibleFeatures.length > 0) {
      map.addSource("plu-zones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: visibleFeatures },
      });

      map.addLayer({
        id: "plu-zones-fill",
        type: "fill",
        source: "plu-zones",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#9CA3AF"],
          "fill-opacity": ZONE_FILL_OPACITY,
        },
      });

      map.addLayer({
        id: "plu-zones-outline",
        type: "line",
        source: "plu-zones",
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#9CA3AF"],
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "plu-zones-label",
        type: "symbol",
        source: "plu-zones",
        layout: {
          "text-field": ["get", "code_zone"],
          "text-size": 12,
          "text-anchor": "center",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1.5,
        },
      });

      const onZoneClick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const p = f.properties as ZoneFeature["properties"];
        const color = typeof p.color === "string" ? p.color : "#9CA3AF";
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="plu-map-popup">
              <div class="plu-map-popup__zone" style="background:${color}">${p.code_zone}</div>
              <div class="plu-map-popup__title">${p.libelong ?? p.libelle ?? p.code_zone}</div>
              ${p.pct_parcelle_couverte != null
                ? `<div class="plu-map-popup__pct">${p.pct_parcelle_couverte} % de la parcelle</div>`
                : ""}
              ${p.typezone ? `<div class="plu-map-popup__type">Type : ${p.typezone}</div>` : ""}
            </div>
          `)
          .addTo(map);
      };
      const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
      const onLeave = () => { map.getCanvas().style.cursor = ""; };

      zoneHandlersRef.current = { onZoneClick, onEnter, onLeave };
      map.on("click", "plu-zones-fill", onZoneClick);
      map.on("mouseenter", "plu-zones-fill", onEnter);
      map.on("mouseleave", "plu-zones-fill", onLeave);
    }

    map.addSource("parcelle", {
      type: "geojson",
      data: mapData.parcelle,
    });

    map.addLayer({
      id: "parcelle-fill",
      type: "fill",
      source: "parcelle",
      paint: { "fill-color": PARCELLE_FILL },
    });

    map.addLayer({
      id: "parcelle-outline",
      type: "line",
      source: "parcelle",
      paint: {
        "line-color": PARCELLE_OUTLINE,
        "line-width": 2.5,
      },
    });

    const coords: number[][] = [];
    const collectCoords = (input: unknown): void => {
      if (!input) return;
      if (Array.isArray(input) && typeof input[0] === "number") {
        coords.push(input as number[]);
        return;
      }
      if (Array.isArray(input)) {
        input.forEach(collectCoords);
        return;
      }
      if (typeof input === "object" && input !== null) {
        const g = input as GeoJSON.Geometry;
        if ("coordinates" in g && g.coordinates) collectCoords(g.coordinates);
        if ("geometries" in g && g.geometries) g.geometries.forEach(collectCoords);
      }
    };
    collectCoords(mapData.parcelle.geometry);
    visibleFeatures.forEach((f) => collectCoords(f.geometry));

    if (coords.length > 0) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 48, maxZoom: 18, duration: 800 },
      );
    }

    map.triggerRepaint();
  }, [mapData, visibleZones]);

  // Déclencher updateMapLayers quand la carte est prête ou quand les données arrivent
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      updateMapLayers();
    } else {
      map.once("load", updateMapLayers);
    }
  }, [updateMapLayers]);

  // Redimensionner MapLibre quand le panneau devient visible ou change de taille
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVisible) return;

    const resize = () => map.resize();
    const t = window.setTimeout(resize, 320);

    const ro = new ResizeObserver(() => resize());
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [isVisible, mapData]);

  // ---------------------------------------------------------------------------
  // Toggle d'une zone dans la légende
  // ---------------------------------------------------------------------------
  const toggleZone = (code: string) => {
    setVisibleZones((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const zones = mapData?.zones.features ?? [];

  return (
    <aside className={`plu-map-panel${isVisible ? " plu-map-panel--visible" : ""}`}>
      {/* Header */}
      <div className="plu-map-panel__header">
        <span className="plu-map-panel__title">Carte PLU</span>
        <button
          type="button"
          className="plu-map-panel__close"
          onClick={onClose}
          aria-label="Fermer la carte"
        >
          ✕
        </button>
      </div>

      {/* Légende / toggle zones */}
      {zones.length > 0 && (
        <div className="plu-map-panel__legend">
          <div className="plu-map-panel__legend-title">Zonage PLU</div>
          {zones.map((f) => {
            const p  = f.properties;
            const on = visibleZones.has(p.code_zone);
            return (
              <button
                key={p.code_zone}
                type="button"
                className={`plu-map-panel__legend-item${on ? "" : " plu-map-panel__legend-item--off"}`}
                onClick={() => toggleZone(p.code_zone)}
                title={p.libelong ?? p.libelle ?? p.code_zone}
              >
                <span
                  className="plu-map-panel__legend-dot"
                  style={{ background: p.color, opacity: on ? 1 : 0.35 }}
                />
                <span className="plu-map-panel__legend-code">{p.code_zone}</span>
                {p.pct_parcelle_couverte != null && (
                  <span className="plu-map-panel__legend-pct">{p.pct_parcelle_couverte} %</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Carte */}
      <div className="plu-map-panel__map-wrap">
        {loading && (
          <div className="plu-map-panel__overlay">
            <span className="plu-map-panel__spinner" />
            <span>Chargement de la carte…</span>
          </div>
        )}
        {error && (
          <div className="plu-map-panel__overlay plu-map-panel__overlay--error">
            {error}
          </div>
        )}
        <div ref={mapContainerRef} className="plu-map-panel__map" />
      </div>
    </aside>
  );
}
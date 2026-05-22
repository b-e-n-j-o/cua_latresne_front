import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./PluMapPanel.css";
import { applyMapLayers, type LayerHandlers } from "./map/applyLayers";
import { MAP_BUFFER_M } from "./map/colors";
import { useMapVisibility } from "./map/hooks/useMapVisibility";
import MapLegend from "./map/legend/MapLegend";
import type { MapData } from "./map/types";

export type { MapData } from "./map/types";

type Props = {
  sessionId: string | null;
  mapData: MapData | null;
  /** Racine API PLU commune, ex. https://api…/api/plu/latresne */
  apiRoot: string;
  isVisible: boolean;
  onClose: () => void;
};

export default function PluMapPanel({
  sessionId,
  mapData: propMapData,
  apiRoot,
  isVisible,
  onClose,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const handlersRef = useRef<LayerHandlers>({
    zone: {},
    parcel: {},
    presc: {},
    serv: {},
    info: {},
  });

  const [mapData, setMapData] = useState<MapData | null>(propMapData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibility = useMapVisibility(mapData);

  useEffect(() => {
    if (propMapData) {
      setMapData(propMapData);
      setError(null);
    }
  }, [propMapData]);

  const fetchMapData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiRoot}/session/${sessionId}/map?buffer_m=${MAP_BUFFER_M}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MapData = await res.json();
      setMapData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [sessionId, apiRoot]);

  useEffect(() => {
    if (isVisible && sessionId) void fetchMapData();
  }, [isVisible, sessionId, fetchMapData]);

  useEffect(() => {
    if (!isVisible || !mapContainerRef.current || mapRef.current) return;

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

    return () => {
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [isVisible]);

  const updateMapLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapData || !map.isStyleLoaded()) return;

    handlersRef.current = applyMapLayers({
      map,
      mapData,
      popupRef,
      visibleZones: visibility.visibleZones,
      visibleServitudes: visibility.visibleServitudes,
      servitudeColors: visibility.servitudeColors,
      visiblePrescriptions: visibility.visiblePrescriptions,
      prescriptionColors: visibility.prescriptionColors,
      visibleInformations: visibility.visibleInformations,
      informationColors: visibility.informationColors,
      visibleExtra: visibility.visibleExtra,
      handlers: handlersRef.current,
    });
  }, [
    mapData,
    visibility.visibleZones,
    visibility.visibleServitudes,
    visibility.servitudeColors,
    visibility.visiblePrescriptions,
    visibility.prescriptionColors,
    visibility.visibleInformations,
    visibility.informationColors,
    visibility.visibleExtra,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) updateMapLayers();
    else map.once("load", updateMapLayers);
  }, [updateMapLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVisible) return;
    const resize = () => map.resize();
    const t = window.setTimeout(resize, 320);
    const ro = new ResizeObserver(resize);
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [isVisible, mapData]);

  return (
    <aside className={`plu-map-panel${isVisible ? " plu-map-panel--visible" : ""}`}>
      <div className="plu-map-panel__header">
        <span className="plu-map-panel__title">Carte PLU</span>
        <div className="plu-map-panel__header-actions">
          {visibility.hasLegendContent && (
            <button
              type="button"
              className="plu-map-panel__legend-toggle"
              onClick={() => visibility.setLegendOpen((v) => !v)}
              aria-expanded={visibility.legendOpen}
              aria-label={visibility.legendOpen ? "Masquer la légende" : "Afficher la légende"}
            >
              {visibility.legendOpen ? "Masquer légende" : "Légende"}
            </button>
          )}
          <button
            type="button"
            className="plu-map-panel__close"
            onClick={onClose}
            aria-label="Fermer la carte"
          >
            ✕
          </button>
        </div>
      </div>

      {visibility.legendOpen && mapData && visibility.hasLegendContent && (
        <MapLegend mapData={mapData} visibility={visibility} />
      )}

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

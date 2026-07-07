import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as pmtiles from "pmtiles";
import CartoLegendPanel from "./CartoLegendPanel";
import { CARTO_LAYERS } from "./cartoLayers";
import { syncCartoOnMap } from "./cartoFilters";
import { attachCartoHoverHandlers } from "../../../../components/carto/cartoTooltips";

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const STYLE_URL =
  "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json";

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033, 44.769809, -0.459991, 44.808794,
];

export default function LatresneTilesPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const cartoHoverDetachRef = useRef<(() => void) | null>(null);
  const layerVisibleRef = useRef<Record<string, boolean>>({});
  const [mapReady, setMapReady] = useState(false);

  const [layerVisible, setLayerVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CARTO_LAYERS.map((l) => [l.id, l.defaultVisible]))
  );
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  useEffect(() => {
    layerVisibleRef.current = layerVisible;
  }, [layerVisible]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      bounds: LATRESNE_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      maxBounds: [
        [LATRESNE_BOUNDS[0] - 0.05, LATRESNE_BOUNDS[1] - 0.05],
        [LATRESNE_BOUNDS[2] + 0.05, LATRESNE_BOUNDS[3] + 0.05],
      ],
      maxZoom: 19,
      renderWorldCopies: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      syncCartoOnMap(
        map,
        Object.fromEntries(CARTO_LAYERS.map((l) => [l.id, l.defaultVisible])),
        {}
      );
      layerVisibleRef.current = Object.fromEntries(
        CARTO_LAYERS.map((l) => [l.id, l.defaultVisible])
      );
      cartoHoverDetachRef.current = attachCartoHoverHandlers(map, {
        defs: CARTO_LAYERS,
        layerVisibleRef,
        canShow: () => true,
        setTooltip,
      });
      setMapReady(true);
    });

    return () => {
      cartoHoverDetachRef.current?.();
      cartoHoverDetachRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !mapReady) return;

    syncCartoOnMap(map, layerVisible, {});
  }, [layerVisible, mapReady]);

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="w-full h-full" />

      {mapReady && mapRef.current && (
        <CartoLegendPanel
          map={mapRef.current}
          layerVisible={layerVisible}
          onLayerVisibleChange={(layerId, on) =>
            setLayerVisible((v) => ({ ...v, [layerId]: on }))
          }
        />
      )}

      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 px-2 py-1 rounded bg-[#0b131f] text-white text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12, maxWidth: 240 }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

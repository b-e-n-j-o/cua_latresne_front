import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as pmtiles from "pmtiles";
import CartoLegendPanel from "./CartoLegendPanel";
import { CARTO_LAYERS } from "./cartoLayers";
import { syncCartoOnMap } from "./cartoFilters";
import type { CartoLayerDef } from "./cartoLayers";

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const STYLE_URL =
  "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json";

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033, 44.769809, -0.459991, 44.808794,
];

function fillLayerId(def: CartoLayerDef): string | undefined {
  return def.layers.find((l) => l.type === "fill")?.id;
}

function bindCartoLayerTooltip(
  map: maplibregl.Map,
  def: CartoLayerDef,
  setTooltip: (t: { x: number; y: number; text: string } | null) => void
): void {
  const layerId = fillLayerId(def);
  if (!layerId || !map.getLayer(layerId)) return;

  map.on("mousemove", layerId, (e) => {
    const f = e.features?.[0];
    if (!f) return;
    map.getCanvas().style.cursor = "pointer";
    const p = f.properties as Record<string, unknown>;

    let text: string;
    if (def.id === "zonage") {
      const code = p.zonage_reglement ?? p.typezone ?? "Zone";
      const lib = p.libelle ? ` — ${p.libelle}` : "";
      text = `${code}${lib}`;
    } else if (def.tooltipField) {
      const raw = p[def.tooltipField];
      text =
        raw != null && String(raw).trim()
          ? String(raw).trim().toUpperCase()
          : def.title.toUpperCase();
    } else {
      text = def.title;
    }

    setTooltip({ x: e.point.x, y: e.point.y, text });
  });
  map.on("mouseleave", layerId, () => {
    map.getCanvas().style.cursor = "";
    setTooltip(null);
  });
}

export default function LatresneTilesPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const tooltipBoundRef = useRef(new Set<string>());
  const [mapReady, setMapReady] = useState(false);

  const [layerVisible, setLayerVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CARTO_LAYERS.map((l) => [l.id, l.defaultVisible]))
  );
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

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
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      tooltipBoundRef.current.clear();
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !mapReady) return;

    syncCartoOnMap(map, layerVisible, {});

    for (const def of CARTO_LAYERS) {
      if (!layerVisible[def.id] || tooltipBoundRef.current.has(def.id)) continue;
      if (!fillLayerId(def) || !map.getLayer(fillLayerId(def)!)) continue;
      bindCartoLayerTooltip(map, def, setTooltip);
      tooltipBoundRef.current.add(def.id);
    }
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
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

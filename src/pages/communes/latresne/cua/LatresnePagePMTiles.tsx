import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as pmtiles from "pmtiles";
import {
  CARTO_LAYERS,
  findBeforeSymbolsLayer,
  ZONAGE_LEGEND,
} from "./cartoLayers";

// Protocole PMTiles enregistré une seule fois
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// Fond de carte (mets ici ton style IGN v2 ou OSM)
const STYLE_URL =
  "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json";

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033, 44.769809, -0.459991, 44.808794,
];

function syncLayerVisibility(
  map: maplibregl.Map,
  visible: Record<string, boolean>
) {
  if (!map.isStyleLoaded()) return;
  for (const def of CARTO_LAYERS) {
    const vis = visible[def.id] ? "visible" : "none";
    for (const sub of def.layers) {
      if (map.getLayer(sub.id)) map.setLayoutProperty(sub.id, "visibility", vis);
    }
  }
}

export default function LatresneTilesPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Visibilité par couche du catalogue
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
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
      // Sous les étiquettes IGN, au-dessus des aplats (sinon le fill peut être masqué)
      const beforeId = findBeforeSymbolsLayer(map);

      for (const def of CARTO_LAYERS) {
        if (!map.getSource(def.id)) {
          map.addSource(def.id, {
            type: "vector",
            url: `pmtiles://${def.pmtilesUrl}`,
          });
        }
        for (const sub of def.layers) {
          if (map.getLayer(sub.id)) continue;
          map.addLayer(
            {
              ...sub,
              source: def.id,
              "source-layer": def.sourceLayer,
            } as maplibregl.LayerSpecification,
            beforeId
          );
        }
      }

      syncLayerVisibility(map, visible);

      const fillLayerId = (def: (typeof CARTO_LAYERS)[number]) =>
        def.layers.find((l) => l.type === "fill")?.id;

      for (const def of CARTO_LAYERS) {
        const layerId = fillLayerId(def);
        if (!layerId) continue;

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
            text = raw != null && String(raw).trim()
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
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => syncLayerVisibility(map, visible);
    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [visible]);

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="w-full h-full" />

      {/* Toggles générés depuis le catalogue */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-lg shadow-md p-3 text-sm space-y-2">
        {CARTO_LAYERS.map((l) => (
          <label key={l.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={visible[l.id]}
              onChange={(e) => setVisible((v) => ({ ...v, [l.id]: e.target.checked }))}
            />
            {l.title}
          </label>
        ))}
      </div>

      {/* Légende zonage */}
      {visible["zonage"] && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg shadow-md p-3 text-xs space-y-1">
          {ZONAGE_LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: l.color }}
              />
              {l.label}
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
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
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { filiationApi } from "./filiationApi";
import { formatRef, moisAnnee } from "./libelles";
import type { IsoDate } from "./types";

const STYLE_IGN: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://data.geopf.fr/annexes/ressources/vectorTiles/fonts/{fontstack}/{range}.pbf",
  sources: {
    plan: {
      type: "raster",
      tiles: [
        "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
      ],
      tileSize: 256,
      attribution: "© IGN",
    },
  },
  layers: [{ id: "plan", type: "raster", source: "plan" }],
};
const MIN_ZOOM_CADASTRE = 13;
const LABEL_MIN_ZOOM = 17;
const SWAP_TIMEOUT_MS = 4000;

const C_SOUS_CIBLE = "#2563eb";
const C_SURVOL = "#F97316";
const C = {
  trait: "#475569",
  sousCible: C_SOUS_CIBLE,
  survol: C_SURVOL,
  cible: "#E53E3E",
};

type Slot = "a" | "b";
const SLOTS: Slot[] = ["a", "b"];
const src = (s: Slot) => `cadastre-${s}`;
const ids = (s: Slot) => ({ fill: `cad-${s}-fill`, line: `cad-${s}-line`, label: `cad-${s}-label` });

type Expr = maplibregl.ExpressionSpecification;
const isSous: Expr = ["boolean", ["feature-state", "sousCible"], false];
const isHover: Expr = ["boolean", ["feature-state", "hover"], false];
const FILL_OPACITY_ACTIVE: Expr = ["case", isSous, 0.35, isHover, 0.28, 0.08];
const FILL_COLOR: Expr = ["case", isSous, C_SOUS_CIBLE, isHover, C_SURVOL, "#000000"];

export interface SelectionCarte {
  versionId: number;
  idu: string;
  validTo: IsoDate | null;
}

interface Props {
  commune: string;
  bounds: [number, number, number, number];
  date: IsoDate;
  /** Dernier millésime chargé : casse le cache navigateur des tuiles après une ingestion. */
  cacheVersion: string;
  cible: GeoJSON.Geometry | null;
  sousCible: number[];
  survol: GeoJSON.Geometry[];
  onSelect: (sel: SelectionCarte, e: { shift: boolean }) => void;
}

function setRole(map: maplibregl.Map, s: Slot, role: "active" | "loading" | "off") {
  const l = ids(s);
  const vis = role === "off" ? "none" : "visible";
  for (const id of Object.values(l)) map.setLayoutProperty(id, "visibility", vis);
  const on = role === "active";
  // Opacité 0 et non visibility:none pendant le chargement : sinon les tuiles ne se chargent pas.
  map.setPaintProperty(l.fill, "fill-opacity", on ? FILL_OPACITY_ACTIVE : 0);
  map.setPaintProperty(l.line, "line-opacity", on ? 0.9 : 0);
  map.setPaintProperty(l.label, "text-opacity", on ? 1 : 0);
}

function addCadastreSlot(map: maplibregl.Map, s: Slot, url: string) {
  map.addSource(src(s), {
    type: "vector",
    tiles: [url],
    minzoom: MIN_ZOOM_CADASTRE,
    maxzoom: 16, // sur-zoom au-delà : précision suffisante pour du parcellaire, 4× moins de requêtes
    promoteId: "version_id",
  });
  const l = ids(s);
  map.addLayer({
    id: l.fill, type: "fill", source: src(s), "source-layer": "cadastre",
    paint: { "fill-color": FILL_COLOR, "fill-opacity": 0 },
  });
  map.addLayer({
    id: l.line, type: "line", source: src(s), "source-layer": "cadastre",
    paint: {
      "line-color": C.trait,
      "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.6, 16, 1.2, 18, 2],
      "line-opacity": 0,
    },
  });
  map.addLayer({
    id: l.label, type: "symbol", source: src(s), "source-layer": "cadastre", minzoom: LABEL_MIN_ZOOM,
    layout: {
      "text-field": ["to-string", ["to-number", ["get", "numero"]]],
      "text-size": 11,
      "text-font": ["Source Sans Pro Regular"],
      "text-padding": 2,
    },
    paint: { "text-color": "#1e293b", "text-halo-color": "#ffffff", "text-halo-width": 1.4, "text-opacity": 0 },
  });
}

const fc = (geoms: GeoJSON.Geometry[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: geoms.map((g) => ({ type: "Feature", geometry: g, properties: {} })),
});

export default function CadastreTemporelMap({
  commune, bounds, date, cacheVersion, cible, sousCible, survol, onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeRef = useRef<Slot>("a");
  const urlRef = useRef<Record<Slot, string>>({ a: "", b: "" });
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [ready, setReady] = useState(false);
  const [swapTick, setSwapTick] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // --- Initialisation (une fois) ------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_IGN,
      bounds,
      fitBoundsOptions: { padding: 40 },
      maxZoom: 20,
    });
    mapRef.current = map;
    let hovered: number | null = null;

    map.on("load", () => {
      map.resize();
      const url = filiationApi.tileUrl(commune, date, cacheVersion);
      for (const s of SLOTS) addCadastreSlot(map, s, url);
      urlRef.current = { a: url, b: url };
      setRole(map, "a", "active");
      setRole(map, "b", "off");

      map.addSource("survol", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "survol-fill", type: "fill", source: "survol", paint: { "fill-color": C.survol, "fill-opacity": 0.3 } });
      map.addLayer({ id: "survol-line", type: "line", source: "survol", paint: { "line-color": C.survol, "line-width": 2 } });
      map.addSource("cible", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "cible-line", type: "line", source: "cible", paint: { "line-color": C.cible, "line-width": 3 } });

      setZoom(map.getZoom());
      setReady(true);
    });

    map.on("zoom", () => setZoom(map.getZoom()));

    const clearHover = () => {
      if (hovered !== null) {
        map.setFeatureState({ source: src(activeRef.current), sourceLayer: "cadastre", id: hovered }, { hover: false });
        hovered = null;
      }
    };

    // Les couches du tampon caché restent interrogeables : on ne requête que la couche active.
    map.on("mousemove", (e) => {
      if (!map.getLayer(ids(activeRef.current).fill)) return;
      const f = map.queryRenderedFeatures(e.point, { layers: [ids(activeRef.current).fill] })[0];
      if (!f) {
        clearHover();
        map.getCanvas().style.cursor = "";
        setTooltip(null);
        return;
      }
      const id = f.id as number;
      if (id !== hovered) {
        clearHover();
        hovered = id;
        map.setFeatureState({ source: src(activeRef.current), sourceLayer: "cadastre", id }, { hover: true });
      }
      const p = f.properties as { idu: string; valid_from: string };
      map.getCanvas().style.cursor = "pointer";
      setTooltip({ x: e.point.x, y: e.point.y, text: `${formatRef(p.idu)}, depuis ${moisAnnee(p.valid_from)}` });
    });

    map.on("mouseout", () => {
      clearHover();
      setTooltip(null);
    });

    map.on("click", (e) => {
      if (!map.getLayer(ids(activeRef.current).fill)) return;
      const f = map.queryRenderedFeatures(e.point, { layers: [ids(activeRef.current).fill] })[0];
      if (!f) return;
      const p = f.properties as { idu: string; valid_to?: string | null };
      onSelectRef.current(
        { versionId: f.id as number, idu: p.idu, validTo: p.valid_to || null },
        { shift: e.originalEvent.shiftKey },
      );
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      setReady(false);
      map.remove();
      mapRef.current = null;
    };
    // Carte créée une seule fois par commune ; date et cible sont gérées par les effets dédiés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commune]);

  // --- Changement de date en double tampon ----------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const url = filiationApi.tileUrl(commune, date, cacheVersion);
    const active = activeRef.current;
    if (urlRef.current[active] === url) return;

    const hidden: Slot = active === "a" ? "b" : "a";
    setRole(map, hidden, "loading");
    (map.getSource(src(hidden)) as maplibregl.VectorTileSource).setTiles([url]);
    urlRef.current[hidden] = url;

    let done = false;
    const swap = () => {
      if (done) return;
      done = true;
      map.off("sourcedata", onData);
      clearTimeout(timer);
      setRole(map, hidden, "active");
      setRole(map, active, "off");
      activeRef.current = hidden;
      setSwapTick((t) => t + 1);
    };
    const onData = (e: maplibregl.MapSourceDataEvent) => {
      if (e.sourceId === src(hidden) && map.isSourceLoaded(src(hidden))) swap();
    };
    map.on("sourcedata", onData);
    const timer = setTimeout(swap, SWAP_TIMEOUT_MS); // filet : réseau lent ou aucune tuile à charger
    if (map.getZoom() < MIN_ZOOM_CADASTRE) swap();

    // Date rechangée avant chargement : seule la dernière demande sera honorée.
    return () => {
      done = true;
      map.off("sourcedata", onData);
      clearTimeout(timer);
    };
  }, [date, cacheVersion, commune, ready]);

  // --- Surlignage « sous la cible » (aucune requête : vient de historique_uf) ------
  const prevSousCible = useRef<number[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const s of SLOTS) {
      for (const id of prevSousCible.current) map.removeFeatureState({ source: src(s), sourceLayer: "cadastre", id }, "sousCible");
      for (const id of sousCible) map.setFeatureState({ source: src(s), sourceLayer: "cadastre", id }, { sousCible: true });
    }
    prevSousCible.current = sousCible;
  }, [sousCible, ready, swapTick]);

  // --- Cible : contour fixe + cadrage à chaque nouvelle cible ---------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("cible") as maplibregl.GeoJSONSource).setData(fc(cible ? [cible] : []));
    if (cible) {
      const [x1, y1, x2, y2] = turf.bbox(cible);
      map.fitBounds([[x1, y1], [x2, y2]], { padding: 80, maxZoom: 18, duration: 700 });
    }
  }, [cible, ready]);

  // --- Survol depuis le panneau -----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("survol") as maplibregl.GeoJSONSource).setData(fc(survol));
  }, [survol, ready]);

  return (
    <div className="relative h-full w-full min-h-0">
      <div ref={containerRef} className="h-full w-full" />
      {ready && zoom < MIN_ZOOM_CADASTRE ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-700 shadow">
          Zoomez pour voir le cadastre
        </div>
      ) : null}
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 rounded bg-slate-900/90 px-2 py-1 text-xs text-white"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </div>
  );
}

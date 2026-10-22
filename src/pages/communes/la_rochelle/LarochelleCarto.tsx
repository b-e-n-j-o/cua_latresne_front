/**
 * LaRochelleCarto — Visualisation PLUi / SUP / réseaux / cadastre de la CdA de La Rochelle.
 *
 * Tout est piloté par `legende_carto.json` (généré par pmtiles/legende_carto.py) :
 * sources PMTiles, groupes et familles de légende, couleurs, filtres, zooms, visibilité par défaut.
 * Ajouter / reclasser une famille = régénérer le JSON, aucune modification du rendu ici.
 *
 * La colonne de gauche ajoute la recherche cadastrale, la sélection d'une unité foncière
 * (parcelles non nécessairement contiguës) et une ébauche de carte d'identité foncière.
 *
 * Dépendances : maplibre-gl, pmtiles (déjà dans le projet).
 * Usage :  <LaRochelleCarto baseUrl={import.meta.env.VITE_PMTILES_LR_BASE} />
 *   baseUrl = URL publique du dossier contenant les .pmtiles et legende_carto.json
 */
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import * as pmtiles from "pmtiles";
import RightSidebarPatch from "../communs/carto/layout/RightSidebarPatch";
import "../communs/carto/legend/cartoLegendShell.css";
import "../communs/carto/layout/CartoLeftSidebar.css";
import type { Groupe, Item, LegendeCarto, ParcelleSel, RapportCroisement, Style } from "./cartoTypes";
import ParcellePanel from "./ParcellePanel";
import { analyserSelection } from "./analyserParcelles";
import { empriseGeometrie, lireParcelleCliquee, MAX_PARCELLES } from "./parcellesLr";

// ---------------------------------------------------------------------------
// Constantes de rendu
// ---------------------------------------------------------------------------
const HIT_PARCELLES = "lr-parcelles-hit";
const IGN_STYLE = "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json";
const FONT = ["Noto Sans Regular"];
const FILL_OPACITY: Record<Style, number> = {
  zonage: 0.32, defaut: 0.32, sup: 0.12, cadastre: 0, limites: 0, etiquettes: 0,
};

/** Rang d'empilement : les aplats en dessous, puis contours, lignes, points, cadastre, limites, étiquettes. */
const RANG = { zonageFill: 0, zonageLine: 1, fill: 2, supFill: 3, outline: 4, lin: 5, pct: 6, cadastre: 7, limites: 8, labels: 9 };

let protocolRegistered = false;
function registerPmtiles() {
  if (protocolRegistered) return;
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolRegistered = true;
}

function colorExpr(item: Item): maplibregl.ExpressionSpecification | string {
  if (!item.couleur_par) return item.couleur;
  const pairs = Object.entries(item.couleur_par.valeurs).flat();
  return ["match", ["get", item.couleur_par.champ], ...pairs, item.couleur_par.defaut] as unknown as maplibregl.ExpressionSpecification;
}

type LayerDef = { rang: number; spec: maplibregl.LayerSpecification };

/** Couches MapLibre d'une entrée de légende (une ou plusieurs par couche de tuiles). */
function buildLayers(item: Item, fillOpacity: number): LayerDef[] {
  const out: LayerDef[] = [];
  const vis = item.visible ? "visible" : "none";
  const color = colorExpr(item);
  item.couches.forEach((c) => {
    const base = {
      source: c.source,
      "source-layer": c.source_layer,
      minzoom: c.minzoom,
      ...(c.filter ? { filter: c.filter } : {}),
    };
    const id = `${item.id}::${c.source_layer}`;

    if (item.style === "etiquettes" || (item.style === "limites" && c.geom === "pct")) {
      const isCommune = item.style === "limites";
      out.push({
        rang: RANG.labels,
        spec: {
          id: `${id}::label`, type: "symbol", ...base,
          ...(isCommune ? { maxzoom: 14 } : {}),
          layout: {
            visibility: vis, "text-field": ["get", item.champ_etiquette ?? "libelle"], "text-font": FONT,
            "text-size": isCommune ? 13 : 11, "text-allow-overlap": false, "text-padding": 4,
          },
          paint: {
            "text-color": isCommune ? item.couleur : "#2B2B2B",
            "text-halo-color": "#FFFFFF", "text-halo-width": 1.4,
          },
        } as maplibregl.LayerSpecification,
      });
      return;
    }

    if (c.geom === "surf") {
      if (item.style === "cadastre") {
        out.push({
          rang: RANG.cadastre,
          spec: {
            id: `${id}::line`, type: "line", ...base, layout: { visibility: vis },
            paint: {
              "line-color": item.couleur,
              "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.25, 17, 1],
              "line-opacity": 0.75,
              ...(item.id === "subdivisions_fiscales" ? { "line-dasharray": [2, 2] } : {}),
            },
          } as maplibregl.LayerSpecification,
        });
        if (item.champ_etiquette) {
          out.push({
            rang: RANG.labels,
            spec: {
              id: `${id}::label`, type: "symbol", ...base, minzoom: 16.5,
              layout: {
                visibility: vis, "text-field": ["get", item.champ_etiquette], "text-font": FONT,
                "text-size": 10, "text-allow-overlap": false,
              },
              paint: { "text-color": "#3A3A3A", "text-halo-color": "#FFFFFF", "text-halo-width": 1.2 },
            } as maplibregl.LayerSpecification,
          });
        }
        return;
      }
      if (item.style === "limites") {
        out.push({
          rang: RANG.limites,
          spec: {
            id: `${id}::line`, type: "line", ...base, layout: { visibility: vis },
            paint: {
              "line-color": item.couleur,
              "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 15, 2.5],
              "line-opacity": 0.8,
            },
          } as maplibregl.LayerSpecification,
        });
        return;
      }
      const isZonage = item.style === "zonage";
      const isSup = item.style === "sup";
      out.push({
        rang: isZonage ? RANG.zonageFill : isSup ? RANG.supFill : RANG.fill,
        spec: {
          id: `${id}::fill`, type: "fill", ...base, layout: { visibility: vis },
          paint: { "fill-color": color, "fill-opacity": FILL_OPACITY[item.style] * fillOpacity },
        } as maplibregl.LayerSpecification,
      });
      out.push({
        rang: isZonage ? RANG.zonageLine : RANG.outline,
        spec: {
          id: `${id}::outline`, type: "line", ...base, layout: { visibility: vis },
          paint: isZonage
            ? { "line-color": "#6B6B6B", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 16, 1.2], "line-opacity": 0.7 }
            : {
                "line-color": color, "line-opacity": 0.9,
                "line-width": isSup ? 1.6 : ["interpolate", ["linear"], ["zoom"], 12, 0.8, 16, 1.6],
                ...(isSup ? { "line-dasharray": [3, 2] } : {}),
              },
        } as maplibregl.LayerSpecification,
      });
      return;
    }

    if (c.geom === "lin") {
      out.push({
        rang: RANG.lin,
        spec: {
          id: `${id}::line`, type: "line", ...base, layout: { visibility: vis, "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": color,
            "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 17, 3],
            "line-opacity": 0.9,
          },
        } as maplibregl.LayerSpecification,
      });
      return;
    }

    out.push({
      rang: RANG.pct,
      spec: {
        id: `${id}::circle`, type: "circle", ...base, layout: { visibility: vis },
        paint: {
          "circle-color": color,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2.5, 17, 5.5],
          "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 1,
        },
      } as maplibregl.LayerSpecification,
    });
  });
  return out;
}

function softenIgnBaseLayers(map: maplibregl.Map) {
  for (const [id, prop, v] of [
    ["water", "fill-opacity", 0.45],
    ["landcover", "fill-opacity", 0.35],
    ["building", "fill-opacity", 0.25],
  ] as const) {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, prop, v); } catch { /* style en cours */ }
    }
  }
}

function firstSymbolLayerId(map: maplibregl.Map): string | undefined {
  return map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;
}

const GEOJSON_VIDE: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function boiteAutour(point: { x: number; y: number }, marge = 4): [[number, number], [number, number]] {
  return [
    [point.x - marge, point.y - marge],
    [point.x + marge, point.y + marge],
  ];
}

function coucheParcelles(legende: LegendeCarto) {
  for (const g of legende.groupes) {
    const item = g.items.find((i) => i.id === "parcelles");
    const couche = item?.couches.find((c) => c.geom === "surf");
    if (couche) return couche;
  }
  return null;
}

function selectionGeojson(parcelles: ParcelleSel[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: parcelles.map((p) => ({
      type: "Feature" as const,
      geometry: p.geometry,
      properties: { cle: p.cle },
    })),
  };
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------
export default function LaRochelleCarto({
  baseUrl,
  styleUrl = IGN_STYLE,
  height = "100vh",
}: {
  baseUrl: string;
  styleUrl?: string | maplibregl.StyleSpecification;
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [legende, setLegende] = useState<LegendeCarto | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({ zonage: true });
  const [zoom, setZoom] = useState(11);
  const [opacite, setOpacite] = useState(1);
  const [loading, setLoading] = useState(true);
  const [panneau, setPanneau] = useState(true);
  const [panneauParcelles, setPanneauParcelles] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [parcelles, setParcelles] = useState<ParcelleSel[]>([]);
  const [rapport, setRapport] = useState<RapportCroisement | null>(null);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [analyseErreur, setAnalyseErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const root = baseUrl.replace(/\/$/, "");
  const parcellesRef = useRef<ParcelleSel[]>([]);
  const clickTimer = useRef<number | null>(null);
  const basculerRef = useRef<(feature: maplibregl.MapGeoJSONFeature) => void>(() => {});
  parcellesRef.current = parcelles;

  basculerRef.current = (feature) => {
    const map = mapRef.current;
    if (!map) return;
    const parcelle = lireParcelleCliquee(map, feature);
    if (!parcelle) return;
    const prev = parcellesRef.current;
    if (prev.some((p) => p.cle === parcelle.cle)) {
      setMessage(null);
      setParcelles(prev.filter((p) => p.cle !== parcelle.cle));
      return;
    }
    if (prev.length >= MAX_PARCELLES) {
      setMessage(`${MAX_PARCELLES} parcelles maximum pour une unité foncière.`);
      return;
    }
    setMessage(null);
    setParcelles([...prev, parcelle]);
    if (map.getZoom() < 15.5) {
      map.fitBounds(empriseGeometrie(parcelle.geometry), { padding: 80, maxZoom: 17, duration: 450 });
    }
  };

  const ajouterDepuisRecherche = (parcelle: ParcelleSel) => {
    const prev = parcellesRef.current;
    if (!prev.some((p) => p.cle === parcelle.cle)) {
      if (prev.length >= MAX_PARCELLES) {
        setMessage(`${MAX_PARCELLES} parcelles maximum pour une unité foncière.`);
        return;
      }
      setParcelles([...prev, parcelle]);
    }
    setMessage(null);
    mapRef.current?.fitBounds(empriseGeometrie(parcelle.geometry), { padding: 80, maxZoom: 17, duration: 700 });
  };

  const cadrerParcelle = (parcelle: ParcelleSel) => {
    mapRef.current?.fitBounds(empriseGeometrie(parcelle.geometry), { padding: 80, maxZoom: 17, duration: 600 });
  };

  // 1. Légende
  useEffect(() => {
    fetch(`${root}/legende_carto.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`legende_carto.json : HTTP ${r.status}`))))
      .then((d: LegendeCarto) => {
        setLegende(d);
        setVisible(Object.fromEntries(d.groupes.flatMap((g) => g.items.map((i) => [i.id, i.visible]))));
      })
      .catch((e) => setErreur(String(e.message ?? e)));
  }, [root]);

  // 2. Carte
  useEffect(() => {
    if (!legende || !containerRef.current || mapRef.current) return;
    registerPmtiles();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      bounds: legende.bounds,
      fitBoundsOptions: { padding: 30 },
      maxZoom: 20,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("zoom", () => setZoom(map.getZoom()));
    map.on("idle", () => setLoading(false));
    map.on("dataloading", () => setLoading(true));

    map.on("load", () => {
      softenIgnBaseLayers(map);
      for (const [name, file] of Object.entries(legende.sources)) {
        if (!map.getSource(name)) {
          map.addSource(name, {
            type: "vector",
            url: `pmtiles://${root}/${file}`,
            attribution: "© IGN, DGFiP · GPU · CdA de La Rochelle",
          });
        }
      }
      const defs = legende.groupes.flatMap((g) => g.items.flatMap((it) => buildLayers(it, 1)));
      defs.sort((a, b) => a.rang - b.rang);
      const beforeId = firstSymbolLayerId(map);
      for (const d of defs) {
        if (map.getLayer(d.spec.id)) continue;
        // aplats et lignes sous les toponymes IGN ; nos étiquettes par-dessus tout
        map.addLayer(d.spec, d.rang < RANG.labels ? beforeId : undefined);
      }

      const parcelle = coucheParcelles(legende);
      if (parcelle && !map.getLayer(HIT_PARCELLES)) {
        map.addLayer({
          id: HIT_PARCELLES,
          type: "fill",
          source: parcelle.source,
          "source-layer": parcelle.source_layer,
          minzoom: parcelle.minzoom,
          paint: { "fill-color": "#1f2937", "fill-opacity": 0.012 },
        });
      }
      if (!map.getSource("lr-selection")) {
        map.addSource("lr-selection", { type: "geojson", data: selectionGeojson(parcellesRef.current) });
        map.addLayer({
          id: "lr-selection-fill",
          type: "fill",
          source: "lr-selection",
          paint: { "fill-color": "#d97706", "fill-opacity": 0.35 },
        });
        map.addLayer({
          id: "lr-selection-line",
          type: "line",
          source: "lr-selection",
          paint: { "line-color": "#c2410c", "line-width": 2.4 },
        });
      }
      if (!map.getSource("lr-hover")) {
        map.addSource("lr-hover", { type: "geojson", data: GEOJSON_VIDE });
        map.addLayer({
          id: "lr-hover-fill",
          type: "fill",
          source: "lr-hover",
          paint: { "fill-color": "#2563eb", "fill-opacity": 0.18 },
        });
      }

      const couchesClic = [HIT_PARCELLES, parcelle ? `parcelles::${parcelle.source_layer}::line` : ""]
        .filter((id) => !!id && !!map.getLayer(id));
      let hoverCle = "";
      map.on("mousemove", (e) => {
        const hits = couchesClic.length
          ? map.queryRenderedFeatures(boiteAutour(e.point), { layers: couchesClic })
          : [];
        map.getCanvas().style.cursor = hits.length ? "pointer" : "";
        const feature = hits[0];
        const cle = feature ? `${feature.id ?? ""}:${(feature.properties as { idu?: string } | null)?.idu ?? ""}` : "";
        if (cle === hoverCle) return;
        hoverCle = cle;
        const src = map.getSource("lr-hover") as maplibregl.GeoJSONSource | undefined;
        const geom = feature?.geometry;
        if (!src) return;
        src.setData(
          geom
            ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: geom, properties: {} }] }
            : GEOJSON_VIDE,
        );
      });
      map.on("mouseout", () => {
        hoverCle = "";
        map.getCanvas().style.cursor = "";
        (map.getSource("lr-hover") as maplibregl.GeoJSONSource | undefined)?.setData(GEOJSON_VIDE);
      });
      map.on("click", (e) => {
        if (!couchesClic.length) return;
        const point: [number, number] = [e.point.x, e.point.y];
        if (clickTimer.current) window.clearTimeout(clickTimer.current);
        clickTimer.current = window.setTimeout(() => {
          clickTimer.current = null;
          const hits = map.queryRenderedFeatures(
            [[point[0] - 5, point[1] - 5], [point[0] + 5, point[1] + 5]],
            { layers: couchesClic },
          );
          if (hits[0]) basculerRef.current(hits[0]);
        }, 220);
      });
      map.on("dblclick", () => {
        if (clickTimer.current) window.clearTimeout(clickTimer.current);
        clickTimer.current = null;
      });

      setZoom(map.getZoom());
      setMapReady(true);
    });
    return () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [legende, root, styleUrl]);

  // 3. Visibilité / opacité
  const layerIdsByItem = useMemo(() => {
    const m: Record<string, { id: string; style: Style }[]> = {};
    legende?.groupes.forEach((g) =>
      g.items.forEach((it) => {
        m[it.id] = buildLayers(it, 1).map((d) => ({ id: d.spec.id, style: it.style }));
      }),
    );
    return m;
  }, [legende]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const [itemId, layers] of Object.entries(layerIdsByItem)) {
      const v = visible[itemId] ? "visible" : "none";
      for (const { id, style } of layers) {
        if (!map.getLayer(id)) continue;
        map.setLayoutProperty(id, "visibility", v);
        if (id.endsWith("::fill")) map.setPaintProperty(id, "fill-opacity", FILL_OPACITY[style] * opacite);
      }
    }
  }, [visible, opacite, layerIdsByItem]);

  const toggleItem = (id: string) => setVisible((s) => ({ ...s, [id]: !s[id] }));
  const toggleGroupe = (g: Groupe) => {
    const allOn = g.items.every((i) => visible[i.id]);
    setVisible((s) => ({ ...s, ...Object.fromEntries(g.items.map((i) => [i.id, !allOn])) }));
  };
  const toutMasquer = () =>
    setVisible((s) => Object.fromEntries(Object.keys(s).map((k) => [k, ["parcelles", "communes"].includes(k)])));

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const src = map.getSource("lr-selection") as maplibregl.GeoJSONSource | undefined;
    src?.setData(selectionGeojson(parcelles));
  }, [parcelles, mapReady]);

  useEffect(() => {
    if (!mapReady || !legende) return;
    const map = mapRef.current;
    if (!parcelles.length || !map) {
      setRapport(null);
      setAnalyseEnCours(false);
      setAnalyseErreur(null);
      return;
    }
    let actif = true;
    setRapport(null);
    setAnalyseEnCours(true);
    setAnalyseErreur(null);
    const timer = window.setTimeout(() => {
      void analyserSelection(map, legende, parcelles, () => actif)
        .then((resultat) => {
          if (!actif) return;
          setRapport(resultat);
          setAnalyseEnCours(false);
        })
        .catch((err: unknown) => {
          if (!actif) return;
          setAnalyseErreur(err instanceof Error ? err.message : "Analyse impossible.");
          setAnalyseEnCours(false);
        });
    }, 400);
    return () => {
      actif = false;
      window.clearTimeout(timer);
    };
  }, [parcelles, legende, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const timer = window.setTimeout(() => map.resize(), 50);
    return () => window.clearTimeout(timer);
  }, [panneauParcelles, panneau, mapReady]);

  // -------------------------------------------------------------------------
  return (
    <div className="cua-map-workspace" style={{ height }}>
      {legende && panneauParcelles ? (
        <ParcellePanel
          parcelles={parcelles}
          rapport={rapport}
          analyseEnCours={analyseEnCours}
          analyseErreur={analyseErreur}
          message={message}
          onAjouter={ajouterDepuisRecherche}
          onRetirer={(cle) => setParcelles((prev) => prev.filter((p) => p.cle !== cle))}
          onVider={() => setParcelles([])}
          onCadrer={cadrerParcelle}
          onFermer={() => setPanneauParcelles(false)}
        />
      ) : legende ? (
        <button
          type="button"
          className="carto-left-sidebar__expand"
          onClick={() => setPanneauParcelles(true)}
          aria-label="Afficher le panneau parcelles"
          title="Parcelles"
        >
          <ChevronRight size={18} />
        </button>
      ) : null}
      <div className="relative min-h-0 min-w-0 flex-1">
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {erreur && <div style={styles.erreur}>Légende introuvable : {erreur}</div>}
      {loading && legende && <div style={styles.loading}>Chargement des tuiles…</div>}

      {legende && (
        <RightSidebarPatch
          isOpen={panneau}
          onToggle={() => setPanneau((p) => !p)}
          legend={
            <div className="carto-legend-shell">
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[#0b131f]/55">
                <span>Zoom {zoom.toFixed(1)}</span>
                <button type="button" className="underline" onClick={toutMasquer}>Tout masquer</button>
              </div>
              <label className="mb-2 flex items-center gap-2 text-[11px] text-[#0b131f]/65">
                Opacité
                <input
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.1}
                  value={opacite}
                  onChange={(e) => setOpacite(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-[#2e6e62]"
                />
              </label>
              {legende.groupes.map((g) => {
                const nbOn = g.items.filter((i) => visible[i.id]).length;
                const open = ouverts[g.code] ?? false;
                const groupeOn = nbOn > 0;
                return (
                  <div key={g.code} className="carto-legend-shell__category">
                    <div className="carto-legend-shell__row">
                      <button
                        type="button"
                        className="carto-legend-shell__caret"
                        onClick={() => setOuverts((o) => ({ ...o, [g.code]: !open }))}
                        aria-label={open ? "Replier" : "Déplier"}
                      >
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                      <button
                        type="button"
                        className="carto-legend-shell__row-main"
                        onClick={() => toggleGroupe(g)}
                        title="Afficher / masquer la catégorie"
                      >
                        <span
                          className={`carto-legend-shell__label carto-legend-shell__label--category${groupeOn ? "" : " carto-legend-shell__label--off"}`}
                        >
                          {g.label}
                        </span>
                        <span className="carto-legend-shell__class-count">{nbOn}/{g.items.length}</span>
                        {groupeOn ? (
                          <Eye size={11} className="carto-legend-shell__row-eye" />
                        ) : (
                          <EyeOff size={11} className="carto-legend-shell__row-eye" />
                        )}
                      </button>
                    </div>
                    {open ? (
                      <div className="carto-legend-shell__children">
                        {g.items.map((it) => {
                          const minz = Math.min(...it.couches.map((c) => c.minzoom));
                          const horsZoom = zoom < minz;
                          const on = !!visible[it.id];
                          return (
                            <div key={it.id} className="carto-legend-shell__layer" style={{ opacity: horsZoom ? 0.5 : 1 }}>
                              <button
                                type="button"
                                className="carto-legend-shell__row-main w-full"
                                onClick={() => toggleItem(it.id)}
                                title="Afficher / masquer la couche"
                              >
                                <Pastille item={it} />
                                <span className={`carto-legend-shell__label${on ? "" : " carto-legend-shell__label--off"}`}>
                                  {it.label}
                                </span>
                                {horsZoom ? <span className="carto-legend-shell__class-count">dès z{minz}</span> : null}
                                {it.nb !== undefined ? (
                                  <span className="carto-legend-shell__class-count">{it.nb.toLocaleString("fr-FR")}</span>
                                ) : null}
                                {on ? (
                                  <Eye size={11} className="carto-legend-shell__row-eye" />
                                ) : (
                                  <EyeOff size={11} className="carto-legend-shell__row-eye" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          }
        />
      )}
      </div>
    </div>
  );
}

/** Pastille de légende selon la géométrie dominante de l'entrée. */
function Pastille({ item }: { item: Item }) {
  const geoms = new Set(item.couches.map((c) => c.geom));
  const c = item.couleur_par ? Object.values(item.couleur_par.valeurs)[0] : item.couleur;
  const base: React.CSSProperties = {
    width: 11, height: 11, flex: "0 0 auto", borderRadius: 2,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
  if (item.style === "etiquettes") return <span style={{ ...base, fontSize: 9, fontWeight: 700 }}>Ab</span>;
  if (item.style === "cadastre" || item.style === "limites")
    return <span style={{ ...base, border: `1.5px solid ${c}`, background: "transparent" }} />;
  if (geoms.has("surf"))
    return (
      <span style={{
        ...base, background: `${c}66`,
        border: `1.5px ${item.style === "sup" ? "dashed" : "solid"} ${c}`,
      }} />
    );
  if (geoms.has("lin")) return <span style={{ ...base, height: 3, background: c }} />;
  return <span style={{ ...base, borderRadius: "50%", background: c, border: "1px solid rgba(11,19,31,0.12)" }} />;
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 2, fontSize: 12,
    background: "rgba(255,255,255,0.58)", backdropFilter: "blur(16px)", borderRadius: 8,
    padding: "4px 10px", boxShadow: "0 1px 6px rgba(11,19,31,.12)", color: "#0b131f",
  },
  erreur: {
    position: "absolute", top: 12, left: 60, zIndex: 3, background: "#fee2e2", color: "#991b1b",
    padding: "8px 12px", borderRadius: 6, fontSize: 13,
  },
};
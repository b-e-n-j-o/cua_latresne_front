/**
 * LaRochelleCarto — Visualisation PLUi / SUP / réseaux / cadastre de la CdA de La Rochelle.
 *
 * Tout est piloté par `legende_carto.json` (généré par pmtiles/legende_carto.py) :
 * sources PMTiles, groupes et familles de légende, couleurs, filtres, zooms, visibilité par défaut.
 * Ajouter / reclasser une famille = régénérer le JSON, aucune modification ici.
 *
 * Dépendances : maplibre-gl, pmtiles (déjà dans le projet).
 * Usage :  <LaRochelleCarto baseUrl={import.meta.env.VITE_PMTILES_LR_BASE} />
 *   baseUrl = URL publique du dossier contenant les .pmtiles et legende_carto.json
 */
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as pmtiles from "pmtiles";

// ---------------------------------------------------------------------------
// Types du JSON de légende
// ---------------------------------------------------------------------------
type Geom = "surf" | "lin" | "pct";
type Style = "zonage" | "defaut" | "sup" | "cadastre" | "limites" | "etiquettes";

interface Couche {
  source: string;
  source_layer: string;
  geom: Geom;
  minzoom: number;
  filter?: maplibregl.FilterSpecification;
}
interface Item {
  id: string;
  label: string;
  couleur: string;
  visible: boolean;
  style: Style;
  nb?: number;
  champ_etiquette?: string;
  couleur_par?: { champ: string; valeurs: Record<string, string>; defaut: string };
  couches: Couche[];
}
interface Groupe {
  code: string;
  label: string;
  items: Item[];
}
interface LegendeCarto {
  titre: string;
  bounds: [number, number, number, number];
  sources: Record<string, string>;
  groupes: Groupe[];
}

// ---------------------------------------------------------------------------
// Constantes de rendu
// ---------------------------------------------------------------------------
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
  const root = baseUrl.replace(/\/$/, "");

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
      setZoom(map.getZoom());
    });
    return () => {
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

  // -------------------------------------------------------------------------
  return (
    <div style={{ position: "relative", width: "100%", height, fontFamily: "system-ui, sans-serif" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {erreur && <div style={styles.erreur}>Légende introuvable : {erreur}</div>}
      {loading && legende && <div style={styles.loading}>Chargement des tuiles…</div>}

      {legende && (
        <aside style={{ ...styles.panel, transform: panneau ? "none" : "translateX(calc(100% + 12px))" }}>
          <header style={styles.header}>
            <div>
              <div style={styles.titre}>{legende.titre}</div>
              <div style={styles.sousTitre}>Zoom {zoom.toFixed(1)}</div>
            </div>
            <button style={styles.lien} onClick={toutMasquer} title="Ne garder que cadastre et limites">
              Tout masquer
            </button>
          </header>

          <label style={styles.opacite}>
            Opacité des aplats
            <input type="range" min={0.2} max={2} step={0.1} value={opacite}
              onChange={(e) => setOpacite(Number(e.target.value))} style={{ flex: 1 }} />
          </label>

          <div style={styles.scroll}>
            {legende.groupes.map((g) => {
              const nbOn = g.items.filter((i) => visible[i.id]).length;
              const open = ouverts[g.code] ?? false;
              return (
                <section key={g.code} style={styles.groupe}>
                  <div style={styles.groupeHead}>
                    <input type="checkbox" checked={nbOn === g.items.length}
                      ref={(el) => { if (el) el.indeterminate = nbOn > 0 && nbOn < g.items.length; }}
                      onChange={() => toggleGroupe(g)} />
                    <button style={styles.groupeBtn} onClick={() => setOuverts((o) => ({ ...o, [g.code]: !open }))}>
                      <span>{g.label}</span>
                      <span style={styles.compteur}>{nbOn}/{g.items.length} {open ? "▾" : "▸"}</span>
                    </button>
                  </div>
                  {open && (
                    <ul style={styles.liste}>
                      {g.items.map((it) => {
                        const minz = Math.min(...it.couches.map((c) => c.minzoom));
                        const horsZoom = zoom < minz;
                        return (
                          <li key={it.id}>
                            <label style={{ ...styles.item, opacity: horsZoom ? 0.5 : 1 }}>
                              <input type="checkbox" checked={!!visible[it.id]} onChange={() => toggleItem(it.id)} />
                              <Pastille item={it} />
                              <span style={{ flex: 1 }}>{it.label}</span>
                              {horsZoom && <span style={styles.badge}>dès z{minz}</span>}
                              {it.nb !== undefined && <span style={styles.nb}>{it.nb.toLocaleString("fr-FR")}</span>}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </aside>
      )}

      {legende && (
        <button style={styles.toggle} onClick={() => setPanneau((p) => !p)}>
          {panneau ? "Masquer la légende" : "Légende"}
        </button>
      )}
    </div>
  );
}

/** Pastille de légende selon la géométrie dominante de l'entrée. */
function Pastille({ item }: { item: Item }) {
  const geoms = new Set(item.couches.map((c) => c.geom));
  const c = item.couleur_par ? Object.values(item.couleur_par.valeurs)[0] : item.couleur;
  if (item.style === "etiquettes") return <span style={{ ...styles.pastille, fontSize: 10, fontWeight: 700 }}>Ab</span>;
  if (item.style === "cadastre" || item.style === "limites")
    return <span style={{ ...styles.pastille, border: `2px solid ${c}`, background: "transparent" }} />;
  if (geoms.has("surf"))
    return (
      <span style={{
        ...styles.pastille, background: `${c}66`,
        border: `1.5px ${item.style === "sup" ? "dashed" : "solid"} ${c}`,
      }} />
    );
  if (geoms.has("lin")) return <span style={{ ...styles.pastille, height: 3, marginTop: 6, background: c, borderRadius: 2 }} />;
  return <span style={{ ...styles.pastille, width: 10, height: 10, borderRadius: "50%", background: c, border: "1px solid #fff", boxShadow: "0 0 0 1px #0002" }} />;
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: "absolute", top: 12, right: 12, bottom: 60, width: 340, display: "flex", flexDirection: "column",
    background: "rgba(255,255,255,0.97)", borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
    transition: "transform .25s ease", zIndex: 2, overflow: "hidden",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 14px 8px", borderBottom: "1px solid #eee" },
  titre: { fontWeight: 650, fontSize: 14, color: "#1d1d1f" },
  sousTitre: { fontSize: 11, color: "#888", marginTop: 2 },
  lien: { border: "none", background: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: 0 },
  opacite: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#555", padding: "8px 14px", borderBottom: "1px solid #eee" },
  scroll: { overflowY: "auto", flex: 1, padding: "4px 0 8px" },
  groupe: { borderBottom: "1px solid #f2f2f2" },
  groupeHead: { display: "flex", alignItems: "center", gap: 6, padding: "6px 14px" },
  groupeBtn: {
    flex: 1, display: "flex", justifyContent: "space-between", border: "none", background: "none",
    fontSize: 13, fontWeight: 600, color: "#222", cursor: "pointer", padding: "2px 0", textAlign: "left",
  },
  compteur: { fontSize: 11, color: "#999", fontWeight: 400 },
  liste: { listStyle: "none", margin: 0, padding: "0 14px 6px 34px" },
  item: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#333", padding: "3px 0", cursor: "pointer" },
  pastille: { width: 16, height: 12, flex: "0 0 auto", borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  badge: { fontSize: 10, color: "#777", background: "#f1f1f1", borderRadius: 4, padding: "1px 4px" },
  nb: { fontSize: 10, color: "#aaa", minWidth: 34, textAlign: "right" },
  toggle: {
    position: "absolute", bottom: 24, right: 12, zIndex: 3, border: "none", borderRadius: 8, padding: "6px 10px",
    background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.2)", fontSize: 12, cursor: "pointer",
  },
  loading: {
    position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 2, fontSize: 12,
    background: "rgba(255,255,255,.95)", borderRadius: 6, padding: "4px 10px", boxShadow: "0 1px 6px rgba(0,0,0,.15)",
  },
  erreur: {
    position: "absolute", top: 12, left: 60, zIndex: 3, background: "#fee2e2", color: "#991b1b",
    padding: "8px 12px", borderRadius: 6, fontSize: 13,
  },
};
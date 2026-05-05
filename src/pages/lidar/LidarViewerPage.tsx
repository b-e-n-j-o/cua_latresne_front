/**
 * src/pages/lidar/index.tsx   (ou LidarViewer.tsx selon ta structure)
 * Route : /lidar
 *
 * Dépendances npm à ajouter :
 *   npm install @deck.gl/react @deck.gl/layers @loaders.gl/core @loaders.gl/arrow
 *
 * Variables d'env :
 *   VITE_API_URL=https://ton-backend.onrender.com   (ou http://localhost:8000 en dev)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { PointCloudLayer } from "@deck.gl/layers";
import { OrbitView, COORDINATE_SYSTEM } from "@deck.gl/core";
import { load } from "@loaders.gl/core";
import { ArrowLoader } from "@loaders.gl/arrow";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParcelleRef {
  code_insee: string;
  section: string;
  numero: string;
}

interface ViewState {
  target: [number, number, number];
  rotationX: number;
  rotationOrbit: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

interface LidarPoint {
  position: [number, number, number];
  color: [number, number, number];
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

// Couleurs par classe LAS (classification IGN LiDAR HD)
const CLASS_COLORS: Record<number, [number, number, number]> = {
  0:  [160, 160, 160],
  1:  [200, 200, 200],
  2:  [255, 140,   0],  // Sol → orange
  3:  [  0, 255, 255],  // Végétation basse → cyan
  4:  [  0, 255,   0],  // Végétation moyenne → vert clair
  5:  [  0, 180,   0],  // Végétation haute → vert foncé
  6:  [255,   0,   0],  // Bâtiment → rouge
  7:  [180, 180, 180],
  9:  [  0, 200, 255],  // Eau → bleu
  17: [255, 255,   0],  // Pont → jaune
  18: [255, 100, 255],  // Caténaire → magenta
  64: [255, 210, 120],
  65: [255, 150, 150],
  66: [170, 170, 255],
  67: [180, 100, 255],
};
const DEFAULT_COLOR: [number, number, number] = [220, 220, 220];

const INITIAL_VIEW_STATE: ViewState = {
  target: [0, 0, 0],
  rotationX: 45,
  rotationOrbit: 0,
  zoom: 0,
  minZoom: -5,
  maxZoom: 10,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyParcelleRef(): ParcelleRef {
  return { code_insee: "", section: "", numero: "" };
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function LidarViewer() {
  const [parcelles, setParcelles] = useState<ParcelleRef[]>([emptyParcelleRef()]);
  const [maxPoints, setMaxPoints] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pointData, setPointData] = useState<LidarPoint[] | null>(null);
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [nPoints, setNPoints] = useState<number | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // ── Gestion des champs parcelle ──
  const updateParcelle = (idx: number, field: keyof ParcelleRef, value: string) => {
    setParcelles((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value.toUpperCase() };
      return next;
    });
  };

  const addParcelle = () => setParcelles((p) => [...p, emptyParcelleRef()]);
  const removeParcelle = (idx: number) =>
    setParcelles((p) => p.filter((_, i) => i !== idx));

  // ── Lancement du pipeline ──
  const handleSubmit = useCallback(async () => {
    const invalid = parcelles.find(
      (p) => !p.code_insee.trim() || !p.section.trim() || !p.numero.trim()
    );
    if (invalid) {
      setError("Tous les champs de chaque parcelle sont requis.");
      return;
    }

    setLoading(true);
    setError(null);
    setLogs([]);
    setPointData(null);
    setNPoints(null);

    try {
      addLog(`Envoi de ${parcelles.length} référence(s) cadastrale(s)…`);
      addLog(`POST ${API}/lidar/points`);

      const t0 = performance.now();

      const res = await fetch(`${API}/lidar/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelles, max_points: maxPoints }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? res.statusText);
      }

      const n = res.headers.get("X-N-Points");
      if (n) addLog(`Réponse reçue : ${parseInt(n).toLocaleString()} points`);

      addLog("Parsing Arrow (Web Worker)…");
      const table = await load(res, ArrowLoader);

      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      addLog(`Arrow parsé en ${elapsed}s — construction du nuage…`);

      // La structure ArrowLoader loaders.gl est ici { shape, schema, data }
      const d = (table as any).data;
      if (!d) throw new Error(`Structure Arrow inattendue. Clés table: ${JSON.stringify(Object.keys(table as any))}`);

      addLog(`Clés data : ${JSON.stringify(Object.keys(d))}`);
      addLog(`Clés data.attributes : ${JSON.stringify(Object.keys((d as any).attributes ?? {}))}`);

      // Extraction directe depuis data
      const xCol = d.x as Float32Array;
      const yCol = d.y as Float32Array;
      const zCol = d.z as Float32Array;
      const clsCol = d.classification as Uint8Array;

      if (!xCol || !yCol || !zCol) throw new Error(`Colonnes manquantes. Clés data: ${JSON.stringify(Object.keys(d))}`);

      const count = xCol.length;
      setNPoints(count);
      addLog(`${count.toLocaleString()} points prêts, chargement deck.gl…`);

      // Construire un tableau d'objets simple — deck.gl l'accepte sans ambiguïté
      const points: LidarPoint[] = [];
      for (let i = 0; i < count; i++) {
        const cls = clsCol?.[i] ?? 1;
        points.push({
          position: [xCol[i], yCol[i], zCol[i]],
          color: CLASS_COLORS[cls] ?? DEFAULT_COLOR,
        });
      }

      setPointData(points);

      // Centre la vue sur le nuage
      let zMin = Infinity, zMax = -Infinity;
      for (let i = 0; i < zCol.length; i++) {
        if (zCol[i] < zMin) zMin = zCol[i];
        if (zCol[i] > zMax) zMax = zCol[i];
      }
      const zCenter = (zMin + zMax) / 2;
      setViewState({
        target: [0, 0, zCenter],
        rotationX: 45,
        rotationOrbit: 0,
        zoom: 1,
        minZoom: -5,
        maxZoom: 20,
      });

      addLog("✓ Visualisation prête.");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      addLog(`✗ Erreur : ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [parcelles, maxPoints, addLog]);

  // ── Couche deck.gl ──
  const layer = pointData
    ? new (PointCloudLayer as any)({
        id: "lidar-cloud",
        data: pointData as any,
        getPosition: (d: any) => d.position,
        getColor: (d: any) => d.color,
        pointSize: 2,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN, // Coordonnées relatives centrées
      })
    : null;

  // ─── Rendu ───────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* ── Panneau gauche : contrôles ── */}
      <div style={styles.panel}>
        <h2 style={styles.title}>Visualiseur LiDAR HD</h2>
        <p style={styles.subtitle}>IGN LiDAR HD · deck.gl · Apache Arrow</p>

        {/* Parcelles */}
        <div style={styles.section}>
          <label style={styles.label}>Références cadastrales</label>
          {parcelles.map((p, idx) => (
            <div key={idx} style={styles.parcelleRow}>
              <input
                style={styles.input}
                placeholder="INSEE (ex: 33234)"
                value={p.code_insee}
                onChange={(e) => updateParcelle(idx, "code_insee", e.target.value)}
                disabled={loading}
              />
              <input
                style={{ ...styles.input, width: 64 }}
                placeholder="Sect."
                value={p.section}
                onChange={(e) => updateParcelle(idx, "section", e.target.value)}
                disabled={loading}
              />
              <input
                style={{ ...styles.input, width: 72 }}
                placeholder="N°"
                value={p.numero}
                onChange={(e) => updateParcelle(idx, "numero", e.target.value)}
                disabled={loading}
              />
              {parcelles.length > 1 && (
                <button
                  style={styles.btnRemove}
                  onClick={() => removeParcelle(idx)}
                  disabled={loading}
                  title="Supprimer"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button style={styles.btnSecondary} onClick={addParcelle} disabled={loading}>
            + Ajouter une parcelle
          </button>
        </div>

        {/* Options */}
        <div style={styles.section}>
          <label style={styles.label}>Limite de points (0 = tous)</label>
          <input
            style={styles.input}
            type="number"
            min={0}
            step={100000}
            value={maxPoints}
            onChange={(e) => setMaxPoints(parseInt(e.target.value) || 0)}
            disabled={loading}
          />
        </div>

        {/* Bouton */}
        <button
          style={{ ...styles.btnPrimary, opacity: loading ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Traitement en cours…" : "Charger le nuage de points"}
        </button>

        {/* Stats */}
        {nPoints !== null && (
          <div style={styles.stats}>
            <span style={styles.statBadge}>{nPoints.toLocaleString()} pts</span>
            <span style={{ fontSize: 11, color: "#888" }}>orbit · scroll zoom · clic droit pan</span>
          </div>
        )}

        {/* Erreur */}
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Logs */}
        <div style={styles.section}>
          <label style={styles.label}>Logs</label>
          <div ref={logsRef} style={styles.logBox}>
            {logs.length === 0 ? (
              <span style={{ color: "#555" }}>En attente…</span>
            ) : (
              logs.map((l, i) => (
                <div key={i} style={{ color: l.includes("✗") ? "#f87171" : l.includes("✓") ? "#4ade80" : "#d1d5db" }}>
                  {l}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Légende classes */}
        <div style={styles.section}>
          <label style={styles.label}>Légende classes LAS</label>
          <div style={styles.legend}>
            {[
              [2, "Sol"],
              [3, "Végétation basse"],
              [4, "Végétation moyenne"],
              [5, "Végétation haute"],
              [6, "Bâtiment"],
              [9, "Eau"],
              [17, "Pont"],
            ].map(([cls, label]) => (
              <div key={cls as number} style={styles.legendRow}>
                <span
                  style={{
                    ...styles.legendDot,
                    background: `rgb(${(CLASS_COLORS[cls as number] ?? DEFAULT_COLOR).join(",")})`,
                  }}
                />
                <span style={{ fontSize: 11 }}>{label as string}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Zone de visualisation ── */}
      <div style={styles.viewer}>
        {!pointData && !loading && (
          <div style={styles.placeholder}>
            <div style={styles.placeholderIcon}>⛰</div>
            <div style={styles.placeholderText}>
              Saisissez des références cadastrales et lancez le chargement
            </div>
          </div>
        )}
        {loading && (
          <div style={styles.placeholder}>
            <div style={styles.spinner} />
            <div style={styles.placeholderText}>
              Téléchargement et traitement LiDAR en cours…
            </div>
            <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
              (130 Mo / dalle IGN, quelques dizaines de secondes)
            </div>
          </div>
        )}
        {pointData && (
          <DeckGL
            views={new OrbitView({ id: "orbit" })}
            viewState={viewState}
            onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
            controller
            layers={layer ? [layer] : []}
          />
        )}
      </div>
    </div>
  );
}

// ─── Styles inline ────────────────────────────────────────────────────────────
// (pas de dépendance CSS externe, s'intègre dans n'importe quelle app React)

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    height: "100vh",
    width: "100%",
    background: "#0d0d10",
    color: "#e5e7eb",
    fontFamily: "system-ui, sans-serif",
    overflow: "hidden",
  },
  panel: {
    width: 320,
    minWidth: 280,
    height: "100%",
    overflowY: "auto",
    background: "#111318",
    borderRight: "1px solid #1f2230",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    boxSizing: "border-box",
  },
  title: {
    margin: "0 0 2px",
    fontSize: 16,
    fontWeight: 600,
    color: "#f9fafb",
  },
  subtitle: {
    margin: "0 0 20px",
    fontSize: 11,
    color: "#6b7280",
  },
  section: {
    marginBottom: 18,
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 500,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
  },
  parcelleRow: {
    display: "flex",
    gap: 4,
    marginBottom: 6,
    alignItems: "center",
  },
  input: {
    flex: 1,
    background: "#1a1d27",
    border: "1px solid #2a2d3e",
    borderRadius: 6,
    color: "#e5e7eb",
    fontSize: 13,
    padding: "6px 8px",
    outline: "none",
    minWidth: 0,
  },
  btnRemove: {
    background: "transparent",
    border: "1px solid #3f3f46",
    borderRadius: 4,
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 12,
    padding: "4px 6px",
    flexShrink: 0,
  },
  btnSecondary: {
    background: "transparent",
    border: "1px dashed #374151",
    borderRadius: 6,
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 12,
    padding: "6px 10px",
    width: "100%",
    marginTop: 2,
  },
  btnPrimary: {
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    padding: "10px 16px",
    width: "100%",
    marginBottom: 12,
    transition: "opacity 0.15s",
  },
  stats: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  statBadge: {
    background: "#1e3a5f",
    color: "#93c5fd",
    borderRadius: 12,
    padding: "2px 10px",
    fontSize: 12,
    fontWeight: 500,
  },
  errorBox: {
    background: "#1f1010",
    border: "1px solid #7f1d1d",
    borderRadius: 6,
    color: "#fca5a5",
    fontSize: 12,
    padding: "8px 10px",
    marginBottom: 12,
    wordBreak: "break-word",
  },
  logBox: {
    background: "#0a0a0e",
    border: "1px solid #1f2230",
    borderRadius: 6,
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 1.6,
    padding: "8px 10px",
    height: 160,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  legend: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  legendRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "#9ca3af",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  viewer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  placeholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "#4b5563",
  },
  placeholderIcon: {
    fontSize: 48,
    opacity: 0.4,
  },
  placeholderText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 300,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #1f2937",
    borderTop: "3px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};

// Injection keyframe spinner (une seule fois)
if (typeof document !== "undefined" && !document.getElementById("lidar-spin-kf")) {
  const style = document.createElement("style");
  style.id = "lidar-spin-kf";
  style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(style);
}
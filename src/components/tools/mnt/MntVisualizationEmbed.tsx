/**
 * MntVisualizationEmbed.tsx
 * ─────────────────────────
 * Visualisation 3D du MNT (Modèle Numérique de Terrain) via React Three Fiber.
 * Remplace l'ancienne approche Plotly/iframe par un rendu WebGL natif.
 *
 * API identique à l'ancien composant — drop-in replacement :
 *   <MntVisualizationEmbed codeInsee="33234" section="AE" numero="0364" />
 *
 * Dépendances (déjà installées) :
 *   three @react-three/fiber @react-three/drei
 *
 * Endpoint backend attendu :
 *   POST /mnt/terrain/data  → { width, height, resolution_m, elev_min, elev_max,
 *                                elevations_b64, contours, exaggeration, ... }
 */

import { useEffect, useRef, useState, useMemo, Suspense, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MntVisualizationEmbedProps = {
  codeInsee: string;
  section: string;
  numero: string;
  unionGeometry?: GeoJSON.Geometry;
  parcelles?: Array<{ code_insee: string; section: string; numero: string }>;
  onClose?: () => void;
  className?: string;
};

interface TerrainData {
  width: number;
  height: number;
  resolution_m: number;
  elev_min: number;
  elev_max: number;
  elevations_b64: string;
  contours: GeoJSON.Geometry[];
  exaggeration: number;
  surface_m2: number;
  n_voisins: number;
  center_x: number;
  center_y: number;
}

// ── Constantes visuelles ──────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const BG_COLOR = "#0d0d10";
const CONTOUR_COLOR = "#ffea00";
const CONTOUR_Z_OFFSET = 1.25; // drapage au-dessus du relief pour lisibilité
const HOVER_SAMPLE_STEP = 3; // réduit l'échantillonnage hover (1 point / 3 cellules)

// Colormap altitude : brun foncé → vert → blanc neige
// Calculée sur 256 stops, appliquée en vertex colors
function altitudeColor(t: number): THREE.Color {
  // t ∈ [0, 1] : 0 = altitude min, 1 = altitude max
  const color = new THREE.Color();
  if (t < 0.25) {
    // Brun foncé → brun clair (sol nu / terre)
    color.setRGB(
      0.35 + t * 0.8,
      0.22 + t * 0.6,
      0.10 + t * 0.2,
    );
  } else if (t < 0.55) {
    // Brun clair → vert prairie
    const s = (t - 0.25) / 0.3;
    color.setRGB(
      0.55 - s * 0.25,
      0.37 + s * 0.25,
      0.12 - s * 0.05,
    );
  } else if (t < 0.80) {
    // Vert → vert foncé forêt
    const s = (t - 0.55) / 0.25;
    color.setRGB(
      0.30 - s * 0.10,
      0.62 - s * 0.15,
      0.07 + s * 0.05,
    );
  } else {
    // Vert foncé → blanc (crêtes / zones hautes)
    const s = (t - 0.80) / 0.20;
    color.setRGB(
      0.20 + s * 0.80,
      0.47 + s * 0.53,
      0.12 + s * 0.88,
    );
  }
  return color;
}

// ── Décodage base64 → Float32Array ────────────────────────────────────────────

function decodeElevations(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

// ── Construction du geometry Three.js ────────────────────────────────────────

function buildTerrainGeometry(data: TerrainData): THREE.BufferGeometry {
  const { width, height, resolution_m, elev_min, elev_max, elevations_b64, exaggeration } = data;
  const elevations = decodeElevations(elevations_b64);

  const cols = width;
  const rows = height;

  // Largeur / hauteur réelles en mètres (coordonnées relatives centrées sur 0)
  const W = cols * resolution_m;
  const H = rows * resolution_m;

  const geo = new THREE.PlaneGeometry(W, H, cols - 1, rows - 1);
  // PlaneGeometry crée les vertices dans l'ordre row-major Y+ → Y-
  // On travaille directement sur les positions et couleurs

  const positions = geo.attributes.position.array as Float32Array;
  const vertexCount = (cols) * (rows);
  const colors = new Float32Array(vertexCount * 3);

  const elevRange = elev_max - elev_min || 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const vertIdx = idx * 3;

      // Altitude avec exagération verticale
      const elev = elevations[idx];
      const z = (elev - elev_min) * exaggeration;
      positions[vertIdx + 2] = z;

      // Vertex color selon altitude normalisée
      const t = (elev - elev_min) / elevRange;
      const c = altitudeColor(Math.max(0, Math.min(1, t)));
      colors[vertIdx]     = c.r;
      colors[vertIdx + 1] = c.g;
      colors[vertIdx + 2] = c.b;
    }
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals(); // indispensable pour le lighting après déplacement Z
  return geo;
}

// ── Extraction des points de contour depuis GeoJSON ──────────────────────────

function extractContourPoints(
  geojson: GeoJSON.Geometry,
  elevations: Float32Array,
  width: number,
  height: number,
  resolution_m: number,
  elev_min: number,
  exaggeration: number,
): THREE.Vector3[] {
  const W = width  * resolution_m;
  const H = height * resolution_m;

  // Coordonnées relatives : (0,0) = centre du MNT
  // PlaneGeometry centré en 0 : x ∈ [-W/2, W/2], y ∈ [-H/2, H/2]
  const sampleElevAt = (rx: number, ry: number): number => {
    // rx, ry : coords relatives Lambert-93 (m), origine = centre MNT
    const col = Math.round((rx + W / 2) / resolution_m);
    const row = Math.round((H / 2 - ry) / resolution_m);
    const c = Math.max(0, Math.min(width  - 1, col));
    const r = Math.max(0, Math.min(height - 1, row));
    return elevations[r * width + c];
  };

  let rings: number[][][] = [];

  if (geojson.type === "Polygon") {
    rings = geojson.coordinates as number[][][];
  } else if (geojson.type === "MultiPolygon") {
    for (const poly of geojson.coordinates as number[][][][]) {
      rings.push(...poly);
    }
  }

  const points: THREE.Vector3[] = [];
  for (const ring of rings) {
    for (const [rx, ry] of ring) {
      const elev = sampleElevAt(rx, ry);
      const z = (elev - elev_min) * exaggeration + CONTOUR_Z_OFFSET;
      // Three.js PlaneGeometry : x = Lambert-X relatif, y = Lambert-Y relatif
      points.push(new THREE.Vector3(rx, ry, z));
    }
    // Fermer le ring
    if (ring.length > 0) {
      const [rx, ry] = ring[0];
      const elev = sampleElevAt(rx, ry);
      const z = (elev - elev_min) * exaggeration + CONTOUR_Z_OFFSET;
      points.push(new THREE.Vector3(rx, ry, z));
    }
  }

  return points;
}

// ── Composant terrain 3D (intérieur du Canvas) ───────────────────────────────

function TerrainMesh({
  data,
  onHoverPoint,
  isOrbitingRef,
}: {
  data: TerrainData;
  onHoverPoint?: (point: { x: number; y: number; elev: number; cellKey: string } | null) => void;
  isOrbitingRef?: React.MutableRefObject<boolean>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastHoverSampleAtRef = useRef(0);

  const geometry = useMemo(() => buildTerrainGeometry(data), [data]);
  const elevations = useMemo(() => decodeElevations(data.elevations_b64), [data.elevations_b64]);

  // Matériau : Phong avec vertex colors (permet le lighting directionnel)
  const material = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        shininess: 18,
        specular: new THREE.Color(0.08, 0.08, 0.08),
        flatShading: false,
      }),
    [],
  );

  // PlaneGeometry est dans le plan XY — on le rotate pour qu'il soit horizontal
  // (Three.js : Z = haut, mais PlaneGeometry est dans XY avec Z=normal)
  // On ne rotate pas : on laisse PlaneGeometry en XY et on utilise camera top-down
  // En fait on veut X=est, Y=nord, Z=haut → rotation de -π/2 autour de X
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={(e) => {
        if (isOrbitingRef?.current) {
          onHoverPoint?.(null);
          return;
        }
        const now = performance.now();
        if (now - lastHoverSampleAtRef.current < 100) return;
        lastHoverSampleAtRef.current = now;

        const rx = e.point.x;
        const ry = -e.point.z;
        const W = data.width * data.resolution_m;
        const H = data.height * data.resolution_m;
        const col = Math.round((rx + W / 2) / data.resolution_m);
        const row = Math.round((H / 2 - ry) / data.resolution_m);
        const cRaw = Math.max(0, Math.min(data.width - 1, col));
        const rRaw = Math.max(0, Math.min(data.height - 1, row));
        const c = Math.max(
          0,
          Math.min(
            data.width - 1,
            Math.round(cRaw / HOVER_SAMPLE_STEP) * HOVER_SAMPLE_STEP,
          ),
        );
        const r = Math.max(
          0,
          Math.min(
            data.height - 1,
            Math.round(rRaw / HOVER_SAMPLE_STEP) * HOVER_SAMPLE_STEP,
          ),
        );
        const elev = elevations[r * data.width + c];
        if (!Number.isFinite(elev)) {
          onHoverPoint?.(null);
          return;
        }
        onHoverPoint?.({
          x: e.nativeEvent.offsetX,
          y: e.nativeEvent.offsetY,
          elev,
          cellKey: `${r}:${c}`,
        });
      }}
      onPointerOut={() => onHoverPoint?.(null)}
    />
  );
}

function TerrainContours({ data }: { data: TerrainData }) {
  const elevations = useMemo(() => decodeElevations(data.elevations_b64), [data.elevations_b64]);

  const contourLines = useMemo(() => {
    return data.contours.map((geojson, i) => {
      const pts = extractContourPoints(
        geojson,
        elevations,
        data.width,
        data.height,
        data.resolution_m,
        data.elev_min,
        data.exaggeration,
      );
      if (pts.length < 2) return null;
      return (
        <Line
          key={i}
          points={pts}
          color={CONTOUR_COLOR}
          lineWidth={3}
          rotation={[-Math.PI / 2, 0, 0]}
          depthTest={false}
          renderOrder={20}
        />
      );
    });
  }, [data, elevations]);

  return <>{contourLines}</>;
}

// Caméra initiale calibrée sur l'étendue du MNT
function CameraSetup({ data }: { data: TerrainData }) {
  const { camera } = useThree();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const W = data.width  * data.resolution_m;
    const H = data.height * data.resolution_m;
    const elevRange = (data.elev_max - data.elev_min) * data.exaggeration;
    const diag = Math.sqrt(W * W + H * H);

    // Positionner la caméra en vue oblique : légèrement au-dessus et sur le côté
    camera.position.set(diag * 0.5, -diag * 0.6, diag * 0.55 + elevRange);
    camera.lookAt(0, 0, elevRange / 2);
    camera.updateProjectionMatrix();
  }, [data, camera]);

  return null;
}

// ── Composant Canvas principal ────────────────────────────────────────────────

function TerrainScene({
  data,
  onHoverPoint,
  isOrbitingRef,
  onOrbitStart,
  onOrbitEnd,
}: {
  data: TerrainData;
  onHoverPoint?: (point: { x: number; y: number; elev: number; cellKey: string } | null) => void;
  isOrbitingRef: React.MutableRefObject<boolean>;
  onOrbitStart?: () => void;
  onOrbitEnd?: () => void;
}) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.45} />
      <hemisphereLight
        args={["#b0cce8", "#6b4f2a", 0.5]}
      />
      <directionalLight
        position={[300, 400, 500]}
        intensity={1.1}
      />
      <directionalLight
        position={[-200, -300, 200]}
        intensity={0.25}
        color="#c8d8ff"
      />

      {/* Terrain */}
      <Suspense fallback={null}>
        <TerrainMesh data={data} onHoverPoint={onHoverPoint} isOrbitingRef={isOrbitingRef} />
        <TerrainContours data={data} />
      </Suspense>

      {/* Caméra & contrôles */}
      <CameraSetup data={data} />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={5000}
        maxPolarAngle={Math.PI / 2 - 0.02}
        onStart={onOrbitStart}
        onEnd={onOrbitEnd}
      />
    </>
  );
}

// ── Composant public (drop-in replacement) ────────────────────────────────────

export function MntVisualizationEmbed({
  codeInsee,
  section,
  numero,
  unionGeometry,
  parcelles,
  onClose,
  className = "",
}: MntVisualizationEmbedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TerrainData | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; elev: number } | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ x: number; y: number; elev: number; cellKey: string } | null>(null);
  const lastHoverKeyRef = useRef<string>("");
  const isOrbitingRef = useRef(false);

  const handleHoverPoint = useCallback((point: { x: number; y: number; elev: number; cellKey: string } | null) => {
    pendingHoverRef.current = point;

    if (hoverRafRef.current !== null) return;
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      const next = pendingHoverRef.current;

      if (!next) {
        if (lastHoverKeyRef.current !== "") {
          lastHoverKeyRef.current = "";
          setHoverPoint(null);
        }
        return;
      }

      const roundedX = Math.round(next.x);
      const roundedY = Math.round(next.y);
      const roundedElev = next.elev.toFixed(2);
      const newKey = `${next.cellKey}|${roundedX}|${roundedY}|${roundedElev}`;
      if (newKey === lastHoverKeyRef.current) return;

      lastHoverKeyRef.current = newKey;
      setHoverPoint({ x: next.x, y: next.y, elev: next.elev });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setHoverPoint(null);
      lastHoverKeyRef.current = "";

      try {
        const res = await fetch(`${API}/mnt/terrain/data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            code_insee:     codeInsee.trim(),
            section:        section.trim().toUpperCase(),
            numero:         numero.trim(),
            exaggeration:   1.5,
            include_voisins: true,
            union_geometry: unionGeometry ?? undefined,
            parcelles:      parcelles ?? undefined,
          }),
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(
            typeof detail.detail === "string"
              ? detail.detail
              : `Erreur MNT (${res.status})`,
          );
        }

        const json: TerrainData = await res.json();
        if (!cancelled) {
          setData(json);
          const perf = performance as Performance & {
            memory?: {
              usedJSHeapSize: number;
              totalJSHeapSize: number;
              jsHeapSizeLimit: number;
            };
          };
          if (perf.memory) {
            const mem = perf.memory;
            console.log(`[MNT] Heap JS utilise : ${(mem.usedJSHeapSize / 1e6).toFixed(1)} Mo`);
            console.log(`[MNT] Heap JS total   : ${(mem.totalJSHeapSize / 1e6).toFixed(1)} Mo`);
            console.log(`[MNT] Heap JS limite  : ${(mem.jsHeapSizeLimit / 1e6).toFixed(1)} Mo`);
          }
          console.log(
            `[MNT] Payload JSON    : ${((json.elevations_b64.length * 0.75) / 1e6).toFixed(1)} Mo (Float32)`,
          );
          console.log(
            `[MNT] Grille          : ${json.width}x${json.height} = ${((json.width * json.height) / 1e6).toFixed(2)}M vertices`,
          );
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (!cancelled) setError((e as Error).message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [codeInsee, section, numero, unionGeometry, parcelles]);

  useEffect(() => {
    return () => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-[${BG_COLOR}] ${className}`}
      style={{ background: BG_COLOR }}
    >
      {/* Barre de titre */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid #1f2230",
          background: "#111318",
          color: "#e2e8f0",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <span>
          Topographie MNT · {section} {numero} ({codeInsee})
        </span>
        {data && (
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {data.width}×{data.height} px · {data.resolution_m} m/px ·{" "}
            {data.elev_min.toFixed(1)}–{data.elev_max.toFixed(1)} m NGF
            {data.n_voisins > 0 && ` · ${data.n_voisins} voisins`}
          </span>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 4px",
            }}
            aria-label="Fermer"
          >
            ×
          </button>
        )}
      </div>

      {/* Zone de rendu */}
      <div style={{ flex: 1, minHeight: 360, position: "relative" }}>
        {loading && (
          <div style={overlayStyle}>
            <div style={spinnerStyle} />
            <span style={{ color: "#6b7280", fontSize: 13, marginTop: 12 }}>
              Génération du MNT…
            </span>
          </div>
        )}

        {error && (
          <div style={{ ...overlayStyle, color: "#f87171", fontSize: 13, padding: 24, textAlign: "center" }}>
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            <Canvas
              frameloop="demand"
              style={{ width: "100%", height: "100%" }}
              camera={{ fov: 45, near: 0.1, far: 50000 }}
              gl={{ antialias: true, alpha: false }}
              onCreated={({ gl }) => {
                gl.setClearColor(new THREE.Color(BG_COLOR));
                gl.shadowMap.enabled = false;
              }}
            >
              <TerrainScene
                data={data}
                onHoverPoint={handleHoverPoint}
                isOrbitingRef={isOrbitingRef}
                onOrbitStart={() => {
                  isOrbitingRef.current = true;
                  handleHoverPoint(null);
                }}
                onOrbitEnd={() => {
                  isOrbitingRef.current = false;
                }}
              />
            </Canvas>

            {hoverPoint && (
              <div
                style={{
                  position: "absolute",
                  left: hoverPoint.x + 14,
                  top: hoverPoint.y - 10,
                  background: "rgba(13,13,16,0.9)",
                  border: "1px solid #1f2230",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 12,
                  color: "#e5e7eb",
                  pointerEvents: "none",
                  backdropFilter: "blur(4px)",
                  zIndex: 10,
                }}
              >
                <span style={{ color: "#9ca3af" }}>Alt. NGF </span>
                <strong>{hoverPoint.elev.toFixed(2)} m</strong>
                <span style={{ color: "#4b5563", fontSize: 10, marginLeft: 6 }}>
                  (x{data.exaggeration} visuel)
                </span>
              </div>
            )}

            {/* Légende */}
            <div style={legendStyle}>
              <div style={legendRowStyle}>
                <span style={{ ...legendDotStyle, background: CONTOUR_COLOR }} />
                <span>Limite unité foncière cible</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: "#4b5563" }}>
                Clic gauche : orbiter · Scroll : zoom · Clic droit : pan
              </div>
            </div>

            {/* Échelle altitude */}
            <AltitudeScale elevMin={data.elev_min} elevMax={data.elev_max} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Échelle altitude (overlay) ────────────────────────────────────────────────

function AltitudeScale({ elevMin, elevMax }: { elevMin: number; elevMax: number }) {
  const stops = [0, 0.25, 0.5, 0.75, 1.0];
  return (
    <div style={scaleContainerStyle}>
      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>Altitude NGF</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {[...stops].reverse().map((t) => {
          const c = altitudeColor(t);
          const hex = "#" + [c.r, c.g, c.b]
            .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
            .join("");
          const elev = elevMin + t * (elevMax - elevMin);
          return (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div
                style={{ width: 14, height: 14, background: hex, borderRadius: 2, flexShrink: 0 }}
              />
              <span style={{ fontSize: 10, color: "#9ca3af" }}>
                {elev.toFixed(1)} m
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Styles overlay ────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "3px solid #1f2937",
  borderTop: "3px solid #3b82f6",
  borderRadius: "50%",
  animation: "mnt-spin 0.8s linear infinite",
};

const legendStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 16,
  background: "rgba(13,13,16,0.82)",
  border: "1px solid #1f2230",
  borderRadius: 8,
  padding: "8px 12px",
  backdropFilter: "blur(4px)",
};

const legendRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12,
  color: "#d1d5db",
};

const legendDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const scaleContainerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  right: 16,
  background: "rgba(13,13,16,0.82)",
  border: "1px solid #1f2230",
  borderRadius: 8,
  padding: "8px 12px",
  backdropFilter: "blur(4px)",
};

// Keyframe spinner (injection unique)
if (typeof document !== "undefined" && !document.getElementById("mnt-r3f-spin")) {
  const s = document.createElement("style");
  s.id = "mnt-r3f-spin";
  s.textContent = "@keyframes mnt-spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}
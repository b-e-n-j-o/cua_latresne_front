import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { PathLayer, PointCloudLayer } from "@deck.gl/layers";
import { OrbitView, COORDINATE_SYSTEM } from "@deck.gl/core";
import { load } from "@loaders.gl/core";
import { ArrowLoader } from "@loaders.gl/arrow";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type LidarParcelleRef = {
  code_insee: string;
  section: string;
  numero: string;
};

export type LidarVisualizationEmbedProps = {
  parcelles: LidarParcelleRef[];
  onClose?: () => void;
  /** Tampon contexte (m), défaut 5 — aligné avec la page /lidar */
  contextBufferM?: number;
  className?: string;
};

const CLASS_COLORS: Record<number, [number, number, number]> = {
  0: [160, 160, 160],
  1: [200, 200, 200],
  2: [255, 140, 0],
  3: [0, 255, 255],
  4: [0, 255, 0],
  5: [0, 180, 0],
  6: [255, 0, 0],
  7: [180, 180, 180],
  9: [0, 200, 255],
  17: [255, 255, 0],
  18: [255, 100, 255],
  64: [255, 210, 120],
  65: [255, 150, 150],
  66: [170, 170, 255],
  67: [180, 100, 255],
};
const DEFAULT_COLOR: [number, number, number] = [220, 220, 220];

type LidarPoint = { position: [number, number, number]; color: [number, number, number] };

type ViewState = {
  target: [number, number, number];
  rotationX: number;
  rotationOrbit: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
};

/**
 * Nuage LiDAR HD (Deck.gl) pour la carto — même API que la page /lidar.
 */
export function LidarVisualizationEmbed({
  parcelles,
  onClose,
  contextBufferM = 5,
  className = "",
}: LidarVisualizationEmbedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointData, setPointData] = useState<LidarPoint[] | null>(null);
  const [outlinePaths, setOutlinePaths] = useState<number[][][] | null>(null);
  const [nPoints, setNPoints] = useState<number | null>(null);
  const [viewState, setViewState] = useState<ViewState>({
    target: [0, 0, 0],
    rotationX: 45,
    rotationOrbit: 0,
    zoom: 1,
    minZoom: -5,
    maxZoom: 20,
  });

  const parcellesKey = useMemo(
    () => parcelles.map((p) => `${p.code_insee}|${p.section}|${p.numero}`).join(";"),
    [parcelles]
  );

  const parcellesRef = useRef(parcelles);
  parcellesRef.current = parcelles;

  useEffect(() => {
    let cancelled = false;
    const plist = parcellesRef.current;

    if (
      !plist.length ||
      plist.some((p) => !p.code_insee?.trim() || !p.section?.trim() || !p.numero?.trim())
    ) {
      setError("Références cadastrales incomplètes.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPointData(null);
    setOutlinePaths(null);
    setNPoints(null);

    (async () => {
      try {
        const res = await fetch(`${API}/lidar/points`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parcelles: plist.map((p) => ({
              code_insee: p.code_insee.trim(),
              section: p.section.trim().toUpperCase(),
              numero: p.numero.trim(),
            })),
            max_points: 0,
            context_buffer_m: contextBufferM,
            include_parcelle_outline: true,
          }),
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
        }

        const ct = res.headers.get("content-type") ?? "";
        let table: unknown;
        if (ct.includes("application/json")) {
          const j = (await res.json()) as {
            arrow_ipc_base64: string;
            outline_paths?: number[][][];
          };
          const bin = atob(j.arrow_ipc_base64);
          const buf = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          table = await load(buf, ArrowLoader);
          if (!cancelled) setOutlinePaths(j.outline_paths?.length ? j.outline_paths : null);
        } else {
          if (!cancelled) setOutlinePaths(null);
          table = await load(res, ArrowLoader);
        }

        const d = (table as { data?: unknown }).data as {
          x: Float32Array;
          y: Float32Array;
          z: Float32Array;
          classification?: Uint8Array;
        };
        if (!d?.x || !d?.y || !d?.z) throw new Error("Réponse Arrow invalide.");

        const xCol = d.x;
        const yCol = d.y;
        const zCol = d.z;
        const clsCol = d.classification;
        const count = xCol.length;

        const points: LidarPoint[] = [];
        for (let i = 0; i < count; i++) {
          const cls = clsCol?.[i] ?? 1;
          points.push({
            position: [xCol[i], yCol[i], zCol[i]],
            color: CLASS_COLORS[cls] ?? DEFAULT_COLOR,
          });
        }

        let zMin = Infinity;
        let zMax = -Infinity;
        for (let i = 0; i < zCol.length; i++) {
          if (zCol[i] < zMin) zMin = zCol[i];
          if (zCol[i] > zMax) zMax = zCol[i];
        }
        const zCenter = (zMin + zMax) / 2;

        if (!cancelled) {
          setNPoints(count);
          setPointData(points);
          setViewState({
            target: [0, 0, zCenter],
            rotationX: 45,
            rotationOrbit: 0,
            zoom: 1,
            minZoom: -5,
            maxZoom: 20,
          });
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parcellesKey, contextBufferM]);

  const layers = useMemo(() => {
    const out: any[] = [];
    if (pointData?.length) {
      out.push(
        new (PointCloudLayer as any)({
          id: "lidar-cloud-embed",
          data: pointData,
          getPosition: (d: LidarPoint) => d.position,
          getColor: (d: LidarPoint) => d.color,
          pointSize: 2,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        })
      );
    }
    if (outlinePaths?.length) {
      out.push(
        new (PathLayer as any)({
          id: "parcelle-limite-embed",
          data: outlinePaths.map((path, i) => ({ path, id: i })),
          getPath: (d: { path: number[][] }) => d.path,
          getColor: [255, 234, 0, 255],
          getWidth: 4,
          widthUnits: "pixels",
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          parameters: { depthTest: false },
        })
      );
    }
    return out.length ? out : null;
  }, [pointData, outlinePaths]);

  const refsLabel = useMemo(
    () => parcelles.map((p) => `${p.section} ${p.numero}`).join(", "),
    [parcelles]
  );

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-[#0d0d10] ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-[#1f2230] bg-[#111318] px-3 py-2 text-sm text-slate-200">
        <div className="min-w-0 truncate">
          <span className="font-medium text-white">Nuage LiDAR HD</span>
          <span className="ml-2 text-slate-400">
            {parcelles.length} parcelle{parcelles.length > 1 ? "s" : ""} · {refsLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {nPoints != null && (
            <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
              {nPoints.toLocaleString("fr-FR")} pts
            </span>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 text-lg leading-none text-slate-400 hover:text-white"
              aria-label="Fermer"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-[320px] flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0b0b0f]/90 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
            <span className="text-sm">Téléchargement et traitement LiDAR…</span>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-400">
            {error}
          </div>
        )}
        {pointData && (
          <DeckGL
            views={new OrbitView({ id: "orbit-embed" })}
            viewState={viewState}
            onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
            controller
            layers={layers ?? []}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-[#1f2230] bg-[#111318] px-3 py-2 text-[11px] text-slate-500">
        Orbit · molette zoom · clic droit panoramique · tampon {contextBufferM} m
      </div>
    </div>
  );
}

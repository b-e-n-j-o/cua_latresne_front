import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileDown,
  FileText,
  Loader2,
  MapPin,
  MinusCircle,
  XCircle,
} from "lucide-react";
import { ManualCuaForm } from "../../../pages/cua/cerfa/ManualCuaForm";

type UFParcelle = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
  surface_m2?: number;
};

type IntersectionResult = {
  table: string;
  display_name: string;
  elements?: Array<Record<string, unknown>>;
};

type LayerRowState = {
  table: string;
  displayName: string;
  status: "pending" | "skipped" | "not_intersected" | "intersected" | "error";
  elementsCount: number;
  skipReason?: string | null;
  error?: string | null;
};

type Props = {
  ufParcelles: UFParcelle[];
  commune: string;
  insee: string;
  unionGeometry: GeoJSON.Geometry;
  userId?: string | null;
  userEmail?: string | null;
  onIdentitePublished?: () => void;
  onParcellesDetected?: (
    parcelles: Array<{
      section: string;
      numero: string;
      surface_m2?: number;
    }>,
    commune: string,
    insee: string
  ) => void;
  onPipelineCreated?: (slug: string) => void;
  onClose: () => void;
  embedded?: boolean;
};

function mapLayerStatus(raw: string, intersected: boolean): LayerRowState["status"] {
  if (raw === "intersected" && intersected) return "intersected";
  if (raw === "skipped") return "skipped";
  if (raw === "error") return "error";
  return "not_intersected";
}

export default function UniteFonciereCard({
  ufParcelles,
  commune,
  insee,
  unionGeometry,
  userId,
  userEmail,
  onIdentitePublished,
  onParcellesDetected,
  onPipelineCreated,
  onClose,
  embedded = false,
}: Props) {
  const [showCUA, setShowCUA] = useState(false);

  const [cifStarted, setCifStarted] = useState(false);
  const [cifLoading, setCifLoading] = useState(false);
  const [cifError, setCifError] = useState<string | null>(null);
  const [layerRows, setLayerRows] = useState<LayerRowState[]>([]);

  const [publierLoading, setPublierLoading] = useState(false);
  const [publierError, setPublierError] = useState<string | null>(null);
  const [storedCarteUrl, setStoredCarteUrl] = useState<string | null>(null);
  const [storedPdfUrl, setStoredPdfUrl] = useState<string | null>(null);

  const totalSurface = ufParcelles.reduce((sum, p) => sum + (p.surface_m2 || 0), 0);

  const ufContentKey = ufParcelles
    .map((p) => `${p.section}::${p.numero}`)
    .join("\n");
  const parcellesCadastrales = useMemo(
    () => ufParcelles.map((p) => ({ section: p.section, numero: p.numero })),
    [ufContentKey]
  );

  const abortRef = useRef<AbortController | null>(null);
  const layerRowsSyncRef = useRef<LayerRowState[]>([]);

  const statusIcon = (s: LayerRowState["status"]) => {
    switch (s) {
      case "pending":
        return <Loader2 className="animate-spin shrink-0 text-slate-400" size={14} />;
      case "intersected":
        return <CheckCircle2 className="shrink-0 text-emerald-600" size={14} />;
      case "not_intersected":
        return <MinusCircle className="shrink-0 text-slate-400" size={14} />;
      case "skipped":
        return <XCircle className="shrink-0 text-amber-600/90" size={14} />;
      case "error":
        return <AlertCircle className="shrink-0 text-red-600" size={14} />;
      default:
        return null;
    }
  };

  const statusLabel = (row: LayerRowState) => {
    if (row.status === "pending") return "…";
    if (row.status === "intersected") return `${row.elementsCount} élt.`;
    if (row.status === "not_intersected") return "Non";
    if (row.status === "skipped") return row.skipReason ? `Ignoré (${row.skipReason})` : "Ignoré";
    if (row.status === "error") return row.error || "Erreur";
    return "—";
  };

  const runPublier = async (intersections: IntersectionResult[]) => {
    setPublierLoading(true);
    setPublierError(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      const body: Record<string, unknown> = {
        commune,
        insee,
        intersections,
        geometry: unionGeometry,
        parcelles_cadastrales: parcellesCadastrales,
        parcelle: parcellesCadastrales.map((p) => `${p.section} ${p.numero}`).join(", "),
        couches_synthese: layerRowsSyncRef.current.map((row) => ({
          table: row.table,
          display_name: row.displayName,
          status: row.status,
          elements_count: row.elementsCount,
          skip_reason: row.skipReason ?? null,
          error: row.error ?? null,
        })),
      };
      if (userId?.trim()) {
        body.user_id = userId.trim();
        if (userEmail?.trim()) body.user_email = userEmail.trim();
      }

      const response = await fetch(`${apiBase}/api/identite-fonciere/publier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        success?: boolean;
        carte_url?: string | null;
        pdf_url?: string | null;
        detail?: unknown;
        error?: string;
      };
      if (!response.ok) {
        const d = data.detail;
        const msg =
          typeof d === "string"
            ? d
            : Array.isArray(d)
              ? d.map((x) => (typeof x === "object" && x !== null && "msg" in x ? String((x as { msg: string }).msg) : String(x))).join(", ")
              : `HTTP ${response.status}`;
        throw new Error(msg);
      }
      if (!data.success) throw new Error(data.error || "Publication échouée");
      if (data.carte_url) setStoredCarteUrl(data.carte_url);
      if (data.pdf_url) setStoredPdfUrl(data.pdf_url);
      onIdentitePublished?.();
    } catch (e) {
      setPublierError((e as Error).message || "Erreur lors de la publication.");
    } finally {
      setPublierLoading(false);
    }
  };

  const runCifSse = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setCifStarted(true);
    setCifLoading(true);
    setCifError(null);
    setLayerRows([]);
    layerRowsSyncRef.current = [];
    setStoredCarteUrl(null);
    setStoredPdfUrl(null);
    setPublierError(null);

    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      const endpoint = `${apiBase}/api/identite-fonciere/intersect/stream`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ commune, insee, geometry: unionGeometry }),
        signal: ac.signal,
      });
      if (!response.ok) {
        setCifError(`HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setCifError("Flux indisponible");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let completedIntersections: IntersectionResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.startsWith("data: ") ? line.slice(6).trim() : line.replace(/^data:\s*/i, "").trim();
          if (!jsonStr) continue;

          let raw: Record<string, unknown>;
          try {
            raw = JSON.parse(jsonStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          const typ = raw.type;
          if (typ === "init") {
            const layers = raw.layers as Array<{ table: string; display_name: string }>;
            if (!Array.isArray(layers)) continue;
            const initial = layers.map((L) => ({
              table: L.table,
              displayName: L.display_name,
              status: "pending" as const,
              elementsCount: 0,
            }));
            layerRowsSyncRef.current = initial;
            setLayerRows(initial);
          } else if (typ === "layer_done") {
            const ld = raw as {
              table: string;
              display_name: string;
              status: string;
              intersected: boolean;
              elements_count?: number;
              skip_reason?: string | null;
              error?: string | null;
            };
            setLayerRows((prev) => {
              const next = [...prev];
              const i = next.findIndex((r) => r.table === ld.table);
              const row: LayerRowState = {
                table: ld.table,
                displayName: ld.display_name,
                status: mapLayerStatus(ld.status, ld.intersected),
                elementsCount: ld.elements_count ?? 0,
                skipReason: ld.skip_reason,
                error: ld.error,
              };
              if (i >= 0) next[i] = row;
              else next.push(row);
              layerRowsSyncRef.current = next;
              return next;
            });
          } else if (typ === "complete") {
            completedIntersections = (raw.intersections as IntersectionResult[] | undefined) ?? [];
          } else if (typ === "error") {
            setCifError(String(raw.error ?? "Erreur"));
          }
        }
      }

      if (!cifError) {
        await runPublier(completedIntersections);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setCifError("Erreur de connexion");
    } finally {
      setCifLoading(false);
    }
  };

  const cifReady = Boolean(storedCarteUrl && storedPdfUrl);
  const cifBusy = cifLoading || publierLoading;

  return (
    <>
      <div className={`${embedded ? "" : "absolute top-80 left-4 z-40"} bg-white shadow-lg rounded-md p-4 ${embedded ? "w-full" : "w-80"} max-h-[70vh] overflow-y-auto`}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-sm">Unité Foncière</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-lg leading-none">×</button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3">
          <div className="text-xs font-semibold text-amber-800 mb-1">
            {ufParcelles.length} parcelle{ufParcelles.length > 1 ? "s" : ""}
          </div>
          <div className="space-y-1 text-xs text-amber-700">
            {ufParcelles.map((p) => (
              <div key={`${p.section}-${p.numero}`} className="flex justify-between gap-2">
                <span className="font-mono">{p.section} {p.numero}</span>
                {typeof p.surface_m2 === "number" && p.surface_m2 > 0 && (
                  <span className="text-amber-900 font-medium">{p.surface_m2.toLocaleString("fr-FR")} m²</span>
                )}
              </div>
            ))}
          </div>
          {totalSurface > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-200 text-xs font-medium text-amber-900">
              Surface totale UF : <span>{totalSurface.toLocaleString("fr-FR")} m²</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-md font-semibold text-gray-700 mb-1">3. Choisir une action</div>

          <button
            onClick={() => void runCifSse()}
            disabled={cifBusy}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm transition-colors disabled:opacity-60"
          >
            {cifBusy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            <span>{cifBusy ? "Génération CIF en cours..." : "Carte d'identité foncière"}</span>
          </button>

          <button
            onClick={() => setShowCUA(true)}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm transition-colors"
          >
            <FileText size={16} />
            <span>Certificat d'urbanisme</span>
          </button>
        </div>

        {cifStarted && (
          <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <div className="flex items-center gap-2 mb-2 text-slate-700 font-medium">
              {cifReady ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Loader2 size={14} className="animate-spin text-slate-500" />}
              <span>{cifReady ? "Carte et PDF disponibles" : "Traitement CIF en cours..."}</span>
            </div>

            {layerRows.length > 0 && (
              <div className="border border-slate-200 rounded-md overflow-hidden mb-2">
                <div className="bg-slate-100 px-2 py-1.5 font-medium text-slate-700">Suivi des intersections</div>
                <div className="max-h-44 overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white text-left text-slate-500">
                        <th className="px-2 py-1 font-medium w-8" />
                        <th className="px-2 py-1 font-medium">Couche</th>
                        <th className="px-2 py-1 font-medium">Résultat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {layerRows.map((row) => (
                        <tr key={row.table} className="border-b border-slate-100 last:border-0 bg-white">
                          <td className="px-2 py-1 align-top">{statusIcon(row.status)}</td>
                          <td className="px-2 py-1 align-top text-slate-800">{row.displayName}</td>
                          <td className="px-2 py-1 align-top text-slate-600 break-words max-w-[11rem]">{statusLabel(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {cifError && <div className="text-red-600 mb-1">{cifError}</div>}
            {publierError && <div className="text-amber-700 mb-1">Publication : {publierError}</div>}

            <div className="flex flex-wrap gap-2 mt-1">
              <button
                type="button"
                onClick={() => storedCarteUrl && window.open(storedCarteUrl, "_blank", "noopener,noreferrer")}
                disabled={!storedCarteUrl}
                className="inline-flex items-center gap-1.5 rounded bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <MapPin size={13} />
                Carte
              </button>
              <button
                type="button"
                onClick={() => storedPdfUrl && window.open(storedPdfUrl, "_blank", "noopener,noreferrer")}
                disabled={!storedPdfUrl}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <FileDown size={13} />
                PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {showCUA && (
        <div className="absolute top-20 left-80 z-50 bg-white shadow-xl rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Générer le CUA (UF)</h3>
            <button onClick={() => setShowCUA(false)} className="text-gray-500 hover:text-gray-700 text-xl leading-none">×</button>
          </div>
          <ManualCuaForm
            ufParcelles={ufParcelles}
            unionGeometry={unionGeometry}
            onParcellesDetected={onParcellesDetected}
            onPipelineCreated={onPipelineCreated}
          />
        </div>
      )}
    </>
  );
}

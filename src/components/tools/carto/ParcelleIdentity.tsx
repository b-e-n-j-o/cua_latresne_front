import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  MapPin,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertCircle,
  FileDown,
} from "lucide-react";

type ParcelleInfo = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
};

type IntersectionResult = {
  table: string;
  display_name: string;
  article?: string | null;
  attribut_discriminant?: string | null;
  elements?: Array<Record<string, string | string[]>>;
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
  parcelle: ParcelleInfo;
  geometry?: GeoJSON.Geometry;
  /** Si true + geometry : lance l’appel identité foncière au montage (pas de 2e bouton). */
  autoFetch?: boolean;
  onResult?: (result: unknown) => void;
  /** UF : une entrée par parcelle pour la page de garde du PDF (section + numéro). */
  parcellesCadastrales?: Array<{ section: string; numero: string }>;
};

function formatElement(element: Record<string, string | string[]>) {
  return Object.entries(element)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}: ${value.join(", ")}`
        : `${key}: ${value}`
    )
    .join(" | ");
}

function mapLayerStatus(
  raw: string,
  intersected: boolean
): LayerRowState["status"] {
  if (raw === "intersected" && intersected) return "intersected";
  if (raw === "skipped") return "skipped";
  if (raw === "error") return "error";
  return "not_intersected";
}

function saveMapPayloadToLocalStorage(payload: unknown): string {
  const key = `maps_payload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const wrapped = {
    createdAt: Date.now(),
    payload,
  };
  localStorage.setItem(key, JSON.stringify(wrapped));
  return key;
}

export default function ParcelleIdentity({
  parcelle,
  geometry,
  autoFetch = false,
  onResult,
  parcellesCadastrales,
}: Props) {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<IntersectionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [layerRows, setLayerRows] = useState<LayerRowState[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runFetchParcelle = useCallback(async () => {
    setLoading(true);
    setError(null);
    setShowResults(true);
    setLayerRows([]);

    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      const endpoint = `${apiBase}/api/identite-parcelle/intersect`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parcelle),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.intersections);
        onResultRef.current?.(data);
      } else {
        setError(data.error || "Erreur lors du calcul");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [parcelle.section, parcelle.numero, parcelle.commune, parcelle.insee]);

  /** Évite de recréer les callbacks quand le parent repasse une nouvelle ref GeoJSON identique (re-render hover, etc.). */
  const geomFingerprint = geometry ? JSON.stringify(geometry) : "";
  const stableGeometry = useMemo(() => geometry, [geomFingerprint]);

  const runFetchFonciereSse = useCallback(async () => {
    if (!stableGeometry) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    setShowResults(true);
    setResults([]);
    setLayerRows([]);

    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      const endpoint = `${apiBase}/api/identite-fonciere/intersect/stream`;
      const payload = {
        commune: parcelle.commune,
        insee: parcelle.insee,
        geometry: stableGeometry,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });

      if (!response.ok) {
        setError(`HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("Flux indisponible");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.startsWith("data: ")
            ? line.slice(6).trim()
            : line.replace(/^data:\s*/i, "").trim();
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
            setLayerRows(
              layers.map((L) => ({
                table: L.table,
                displayName: L.display_name,
                status: "pending" as const,
                elementsCount: 0,
              }))
            );
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
              return next;
            });
          } else if (typ === "complete") {
            const intersections = raw.intersections as IntersectionResult[] | undefined;
            const nb = (raw.nb_intersections as number | undefined) ?? 0;
            setResults(intersections ?? []);
            onResultRef.current?.({
              success: true,
              parcelle: "UNITE_FONCIERE",
              commune: parcelle.commune,
              insee: parcelle.insee,
              nb_intersections: nb,
              intersections: intersections ?? [],
            });
          } else if (typ === "error") {
            setError(String(raw.error ?? "Erreur"));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [stableGeometry, parcelle.commune, parcelle.insee]);

  const runFetch = useCallback(async () => {
    if (stableGeometry) {
      await runFetchFonciereSse();
    } else {
      await runFetchParcelle();
    }
  }, [stableGeometry, runFetchFonciereSse, runFetchParcelle]);

  useEffect(() => {
    if (!autoFetch || !stableGeometry) return;
    void runFetch();
    return () => abortRef.current?.abort();
  }, [autoFetch, geomFingerprint, runFetch]);

  const handleManualClick = () => {
    void runFetch();
  };

  const handleOpenMap = useCallback(async () => {
    if (!stableGeometry) return;
    const newTab = window.open("", "_blank");
    if (!newTab) {
      setMapError("Le navigateur bloque l'ouverture d'onglet (popup).");
      return;
    }
    newTab.document.write("<title>Chargement carte...</title><p style='font-family:system-ui;padding:16px;'>Chargement de la carte…</p>");
    newTab.document.close();
    setMapLoading(true);
    setMapError(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      const response = await fetch(`${apiBase}/api/identite-fonciere/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commune: parcelle.commune,
          insee: parcelle.insee,
          geometry: stableGeometry,
          intersections: results,
        }),
      });

      const data = await response.json();
      if (!data.success || !data.html) {
        throw new Error(data.error || "La carte 2D n'a pas pu être générée.");
      }

      const payload = {
        id: `${parcelle.commune} (${parcelle.insee})`,
        carte2d_html: data.html,
      };
      const storageKey = saveMapPayloadToLocalStorage(payload);
      const targetUrl = `${window.location.origin}/maps?ls=${encodeURIComponent(storageKey)}`;
      newTab.location.assign(targetUrl);
    } catch (e) {
      newTab.close();
      setMapError((e as Error).message || "Erreur de génération de la carte.");
    } finally {
      setMapLoading(false);
    }
  }, [stableGeometry, parcelle.commune, parcelle.insee, results]);

  const handleDownloadPdf = useCallback(async () => {
    if (results.length === 0) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      const body: Record<string, unknown> = {
        commune: parcelle.commune,
        insee: parcelle.insee,
        intersections: results,
      };
      if (parcellesCadastrales && parcellesCadastrales.length > 0) {
        const refs = parcellesCadastrales.map((p) => ({
          section: String(p.section ?? "").trim(),
          numero: String(p.numero ?? "").trim(),
        }));
        body.parcelles_cadastrales = refs;
        // Toujours envoyer une référence lisible (sinon le backend met « UNITE_FONCIERE » sans le détail)
        body.parcelle = refs
          .map((p) => `${p.section} ${p.numero}`.trim())
          .filter(Boolean)
          .join(", ");
      }
      if (stableGeometry) {
        body.geometry = stableGeometry;
      } else if (!body.parcelle) {
        body.parcelle = `${parcelle.section} ${parcelle.numero}`.trim();
      }
      if (layerRows.length > 0) {
        body.couches_synthese = layerRows.map((row) => ({
          table: row.table,
          display_name: row.displayName,
          status: row.status,
          elements_count: row.elementsCount,
          skip_reason: row.skipReason ?? null,
          error: row.error ?? null,
        }));
      }
      const response = await fetch(`${apiBase}/api/identite-fonciere/rapport`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const cd = response.headers.get("Content-Disposition");
      let filename = "rapport_identite_fonciere.pdf";
      const m = cd?.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)/i) ?? cd?.match(/filename="([^"]+)"/i);
      if (m) filename = decodeURIComponent(m[1].trim());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError((e as Error).message || "Erreur lors du téléchargement du PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [
    results,
    layerRows,
    stableGeometry,
    parcelle.section,
    parcelle.numero,
    parcelle.commune,
    parcelle.insee,
    parcellesCadastrales,
  ]);

  const showManualButton = !autoFetch || !stableGeometry;

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
    if (row.status === "skipped")
      return row.skipReason ? `Ignoré (${row.skipReason})` : "Ignoré";
    if (row.status === "error") return row.error || "Erreur";
    return "—";
  };

  return (
    <div className="mt-3">
      {loading && (
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="animate-spin" size={16} />
          <span>Analyse des intersections en cours…</span>
        </div>
      )}

      {showManualButton && (
        <button
          type="button"
          onClick={handleManualClick}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm transition-colors disabled:bg-gray-400"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <MapPin size={16} />}
          <span>{loading ? "Analyse..." : "Carte d'identité"}</span>
        </button>
      )}

      {stableGeometry && layerRows.length > 0 && (
        <div className="mt-3 border border-slate-200 rounded-md overflow-hidden text-xs">
          <div className="bg-slate-100 px-2 py-1.5 font-medium text-slate-700">
            Couches du catalogue (intersection)
          </div>
          <div className="max-h-48 overflow-y-auto">
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
                  <tr
                    key={row.table}
                    className="border-b border-slate-100 last:border-0 bg-white"
                  >
                    <td className="px-2 py-1 align-top">{statusIcon(row.status)}</td>
                    <td className="px-2 py-1 align-top text-slate-800">{row.displayName}</td>
                    <td className="px-2 py-1 align-top text-slate-600 break-words max-w-[12rem]">
                      {statusLabel(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showResults && !loading && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm max-h-64 overflow-y-auto">
          {error && <div className="text-red-600">{error}</div>}
          {mapError && <div className="text-red-600 mb-2">{mapError}</div>}
          {pdfError && <div className="text-red-600 mb-2">{pdfError}</div>}

          {!error && results.length === 0 && !stableGeometry && (
            <div className="text-gray-500">Aucune intersection</div>
          )}

          {!error && results.length === 0 && stableGeometry && (
            <div className="text-gray-500">Aucune couche intersectante (détail ci-dessus).</div>
          )}

          {!error && results.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {stableGeometry && (
                  <button
                    type="button"
                    onClick={() => void handleOpenMap()}
                    disabled={mapLoading}
                    className="inline-flex items-center gap-2 rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {mapLoading ? <Loader2 className="animate-spin" size={14} /> : <MapPin size={14} />}
                    <span>{mapLoading ? "Génération carte..." : "Visualiser la carte"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDownloadPdf()}
                  disabled={pdfLoading}
                  className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {pdfLoading ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />}
                  <span>{pdfLoading ? "PDF..." : "Télécharger le rapport PDF"}</span>
                </button>
              </div>
              <div className="font-medium mb-2">{results.length} couche(s) intersectée(s) :</div>
              <ul className="space-y-2">
                {results.map((result, idx) => (
                  <li key={idx} className="text-xs">
                    <div className="font-semibold">{result.display_name}</div>
                    {result.elements && result.elements.length > 0 && (
                      <ul className="ml-3 mt-1 space-y-0.5 text-gray-600">
                        {result.elements.map((elem, i) => (
                          <li key={i}>• {formatElement(elem)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

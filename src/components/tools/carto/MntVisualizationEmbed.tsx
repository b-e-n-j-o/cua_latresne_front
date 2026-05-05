import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type MntVisualizationEmbedProps = {
  codeInsee: string;
  section: string;
  numero: string;
  onClose?: () => void;
  className?: string;
};

/**
 * MNT 3D Plotly dans un iframe (endpoint POST /mnt/visualisation/html).
 * Pensé pour une modale ou un panneau carto — pas une route dédiée.
 */
export function MntVisualizationEmbed({
  codeInsee,
  section,
  numero,
  onClose,
  className = "",
}: MntVisualizationEmbedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setHtmlDoc(null);
      try {
        const res = await fetch(`${API}/mnt/visualisation/html`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code_insee: codeInsee.trim(),
            section: section.trim().toUpperCase(),
            numero: numero.trim(),
            exaggeration: 1.5,
            include_voisins: true,
          }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(
            typeof detail.detail === "string" ? detail.detail : `Erreur MNT (${res.status})`
          );
        }
        const html = await res.text();
        if (!cancelled) setHtmlDoc(html);
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codeInsee, section, numero]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-[#0b0b0f] ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-[#1f2230] bg-[#111318] px-3 py-2 text-sm text-slate-200">
        <span>
          Topographie MNT · {section} {numero} ({codeInsee})
        </span>
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
      <div className="relative min-h-[360px] flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            Génération du MNT…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-400">
            {error}
          </div>
        )}
        {htmlDoc && (
          <iframe
            title="MNT 3D"
            srcDoc={htmlDoc}
            className="h-full min-h-[360px] w-full border-0 bg-[#0b0b0f]"
          />
        )}
      </div>
    </div>
  );
}

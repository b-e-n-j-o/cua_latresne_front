import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileDown,
  FileText,
  Loader2,
  MapPin,
} from "lucide-react";
import type { ParcelleResumeRef } from "../../../../types/sigResume";
import { generateArgelesCua } from "../../../../utils/argeles/generateArgelesCua";

type Props = {
  communeSlug?: string;
  parcelles: ParcelleResumeRef[];
  userId?: string | null;
  userEmail?: string | null;
  onPipelineCreated?: (slug: string) => void;
};

export default function ParcelleCuaGenerateAction({
  communeSlug = "argeles",
  parcelles,
  userId,
  userEmail,
  onPipelineCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [docxUrl, setDocxUrl] = useState<string | null>(null);
  const [carteUrl, setCarteUrl] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  const ready = Boolean(viewerUrl || docxUrl);

  const runGenerate = async () => {
    setStarted(true);
    setLoading(true);
    setError(null);
    setViewerUrl(null);
    setDocxUrl(null);
    setCarteUrl(null);
    setSlug(null);

    try {
      const result = await generateArgelesCua({
        communeSlug,
        refs: parcelles.map((p) => ({ section: p.section, numero: p.numero })),
        userId,
        userEmail,
      });

      if (result.slug) {
        setSlug(result.slug);
        onPipelineCreated?.(result.slug);
      }
      if (result.docxUrl) setDocxUrl(result.docxUrl);
      if (result.viewerUrl) setViewerUrl(result.viewerUrl);
      if (result.carteUrl) setCarteUrl(result.carteUrl);
    } catch (e) {
      setError((e as Error).message || "Erreur lors de la génération du CUA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void runGenerate()}
        disabled={loading || !parcelles.length}
        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 px-3 rounded-lg text-sm font-medium shadow-md transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin shrink-0" /> : <FileText size={16} />}
        <span>{loading ? "Génération CUA en cours…" : "Certificat d'urbanisme"}</span>
      </button>

      {started ? (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
          <div className="flex items-center gap-2 mb-2 text-emerald-800 font-medium">
            {ready ? (
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            ) : loading ? (
              <Loader2 size={14} className="animate-spin text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={14} className="text-red-600 shrink-0" />
            )}
            <span>
              {ready
                ? "Certificat d'urbanisme disponible"
                : loading
                  ? "Intersections et rédaction du CUA en cours…"
                  : "Échec de la génération CUA"}
            </span>
          </div>

          {error ? <div className="text-red-600 mb-2">{error}</div> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => viewerUrl && window.open(viewerUrl, "_blank", "noopener,noreferrer")}
              disabled={!viewerUrl}
              className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <FileText size={13} />
              Visualiser le CUA
            </button>
            <button
              type="button"
              onClick={() => docxUrl && window.open(docxUrl, "_blank", "noopener,noreferrer")}
              disabled={!docxUrl}
              className="inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
            >
              <FileDown size={13} />
              DOCX
            </button>
            <button
              type="button"
              onClick={() => carteUrl && window.open(carteUrl, "_blank", "noopener,noreferrer")}
              disabled={!carteUrl}
              className="inline-flex items-center gap-1.5 rounded bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <MapPin size={13} />
              Carte d&apos;urbanisme
            </button>
          </div>

          {slug ? <div className="mt-2 text-emerald-700/80">Dossier : {slug}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

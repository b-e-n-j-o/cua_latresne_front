import { Loader2, MapPin, X } from "lucide-react";
import type { StudyZoneCartoContext } from "./types";
import { studyZoneLabel } from "./types";

type Props = {
  context: StudyZoneCartoContext;
  bufferM: number;
  bufferMaxM: number;
  loading?: boolean;
  onBufferChange: (m: number) => void;
  onExit: () => void;
};

/** Contrôles zone d'étude (bandeau + buffer) — légende dans le panneau droit. */
export default function StudyZoneControls({
  context,
  bufferM,
  bufferMaxM,
  loading,
  onBufferChange,
  onExit,
}: Props) {
  const label = studyZoneLabel(context);

  return (
    <div className="absolute top-3 left-3 z-20 pointer-events-none flex flex-col gap-2 max-w-md">
      <div className="pointer-events-auto rounded-lg border border-blue-200 bg-white/95 shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="flex items-start justify-between gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              Zone d&apos;étude · {label}
            </div>
            <p className="text-[10px] text-blue-700/80 mt-0.5 leading-snug">
              Géométries découpées à {context.display_clip_m ?? 1000} m — survol pour le détail
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="shrink-0 p-1 rounded hover:bg-blue-100 text-blue-800"
            title="Revenir à la carto communale"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2.5 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Chargement des géométries…
            </div>
          ) : null}

          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
              <span>Contexte périphérique</span>
              <span className="tabular-nums font-medium text-gray-800">{bufferM} m</span>
            </div>
            <input
              type="range"
              min={0}
              max={bufferMaxM}
              step={5}
              value={bufferM}
              disabled={loading}
              onChange={(e) => onBufferChange(Number(e.target.value))}
              className="w-full h-1.5 accent-blue-600 disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>Parcelle</span>
              <span>{bufferMaxM} m (max chargé)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { X } from "lucide-react";

export type DraftUfParcelleItem = {
  section: string;
  numero: string;
  subtitle?: string | null;
};

function formatM2(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} m²`;
}

type Props = {
  parcelles: DraftUfParcelleItem[];
  ufSurface?: number | null;
  onRemove?: (section: string, numero: string) => void;
};

export default function DraftUfParcelleList({ parcelles, ufSurface, onRemove }: Props) {
  if (!parcelles.length) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2.5 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold text-amber-950">
          Unité foncière en cours ({parcelles.length} parcelle{parcelles.length > 1 ? "s" : ""})
        </div>
        {ufSurface != null && ufSurface > 0 ? (
          <span className="text-[10px] text-amber-800 tabular-nums shrink-0">
            {formatM2(ufSurface)}
          </span>
        ) : null}
      </div>
      <ul className="space-y-1">
        {parcelles.map((parcelle) => (
          <li
            key={`${parcelle.section}-${parcelle.numero}`}
            className="flex items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-white/90 px-2 py-1.5"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-900">
                Section {parcelle.section} – Parcelle {parcelle.numero}
              </div>
              {parcelle.subtitle ? (
                <div className="text-[10px] text-gray-500 truncate" title={parcelle.subtitle}>
                  {parcelle.subtitle}
                </div>
              ) : null}
            </div>
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(parcelle.section, parcelle.numero)}
                className="shrink-0 p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Retirer de l'unité foncière"
                aria-label={`Retirer la parcelle ${parcelle.section} ${parcelle.numero}`}
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-amber-800/90 leading-snug">
        Cliquez sur ✕ pour retirer une parcelle, ou sur la carte pour en ajouter.
      </p>
    </div>
  );
}

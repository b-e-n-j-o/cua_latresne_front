// src/components/rag_components/PLUSelector.tsx

export type Commune = {
  insee: string;
  nom: string;
};

type Props = {
  enabled: boolean;
  commune: string | null;
  communes: Commune[];
  onToggle: (enabled: boolean) => void;
  onCommuneChange: (insee: string | null) => void;
};

export default function PLUSelector({
  enabled,
  commune,
  communes,
  onToggle,
  onCommuneChange,
}: Props) {
  const selectedCommune = communes.find((c) => c.insee === commune);

  return (
    <div className="flex items-center gap-4">
      {/* Toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="hidden"
        />

        <div
          className={`w-9 h-5 rounded-full relative transition ${
            enabled ? "bg-[#FF4F3B]" : "bg-[#D5E1E3]"
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition ${
              enabled ? "translate-x-4" : ""
            }`}
          />
        </div>

        <span className="text-sm font-medium text-[#1A2B42]">PLU</span>

        <span
          className={`text-xs ${
            enabled ? "text-[#FF4F3B] font-medium" : "text-[#1A2B42]/50"
          }`}
        >
          {enabled ? "activé" : "désactivé"}
        </span>
      </label>

      {/* Commune */}
      <select
        value={commune ?? ""}
        disabled={!enabled}
        onChange={(e) => onCommuneChange(e.target.value || null)}
        className="
          w-[240px]
          max-w-[60vw]
          px-3 py-2
          rounded-xl
          border border-[#D5E1E3]
          text-sm
          disabled:bg-[#F7FAFB]
          disabled:text-[#1A2B42]/40
        "
      >
        <option value="">Sélectionner une commune…</option>
        {communes.map((c) => (
          <option key={c.insee} value={c.insee}>
            {c.nom}
          </option>
        ))}
      </select>

      {/* Feedback texte */}
      {enabled && commune && (
        <span className="text-[11px] text-[#1A2B42]/70">
          PLU de {selectedCommune?.nom ?? commune}
        </span>
      )}
    </div>
  );
}

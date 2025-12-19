// src/components/rag_components/LegalSourcesSelector.tsx

import type { LegalCode } from "./CodeSelector";
import type { Commune } from "./PLUSelector";

const ALL_CODES: { key: LegalCode; label: string }[] = [
  { key: "urbanisme", label: "Code de l’urbanisme" },
  { key: "construction", label: "Construction & habitation" },
  { key: "environnement", label: "Code de l’environnement" },
];

type Props = {
  selectedCodes: LegalCode[];
  onCodesChange: (codes: LegalCode[]) => void;

  pluCommune: string | null; // null => aucun PLU
  communesDisponibles: Commune[];
  onPluCommuneChange: (insee: string | null) => void;

  disabled?: boolean;
};

export default function LegalSourcesSelector({
  selectedCodes,
  onCodesChange,
  pluCommune,
  communesDisponibles,
  onPluCommuneChange,
  disabled,
}: Props) {
  const toggleCode = (code: LegalCode) => {
    if (selectedCodes.includes(code)) {
      onCodesChange(selectedCodes.filter((c) => c !== code));
    } else {
      onCodesChange([...selectedCodes, code]);
    }
  };

  return (
    <div className="space-y-4">
      {/* ================= CODES ================= */}
      <div>
        <p className="text-xs font-medium text-[#1A2B42] mb-2">
          Codes juridiques
        </p>

        <div className="flex flex-wrap gap-2">
          {ALL_CODES.map((code) => (
            <button
              key={code.key}
              type="button"
              disabled={disabled}
              onClick={() => toggleCode(code.key)}
              className={`px-3 py-1 rounded-full text-xs border transition ${
                selectedCodes.includes(code.key)
                  ? "bg-[#FF4F3B] text-white border-[#FF4F3B]"
                  : "bg-white border-[#D5E1E3]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {code.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= PLU ================= */}
      <div className="rounded-2xl border border-[#D5E1E3] bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs font-semibold text-[#1A2B42]">
            PLU (règlement local)
          </p>
          <span className="text-[11px] text-[#1A2B42]/60">
            optionnel
          </span>
        </div>

        <select
          value={pluCommune ?? ""}
          disabled={disabled}
          onChange={(e) => onPluCommuneChange(e.target.value || null)}
          className="w-full px-3 py-2 rounded-xl border border-[#D5E1E3] text-sm disabled:bg-[#F7FAFB] disabled:cursor-not-allowed"
        >
          <option value="">Aucun PLU</option>
          {communesDisponibles.map((c) => (
            <option key={c.insee} value={c.insee}>
              {c.nom}
            </option>
          ))}
        </select>

        <p className="text-[11px] text-[#1A2B42]/70 mt-2 leading-snug">
          Si une commune est sélectionnée, Kerelia interroge automatiquement
          le PLU en complément des codes nationaux.
        </p>
      </div>
    </div>
  );
}

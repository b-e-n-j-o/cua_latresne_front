import { useState } from "react";

export type LegalCode =
  | "urbanisme"
  | "construction"
  | "environnement";

type Props = {
  selectedCodes: LegalCode[];
  onChange: (codes: LegalCode[]) => void;
};

const ALL_CODES: { key: LegalCode; label: string }[] = [
  { key: "urbanisme", label: "Code de l’urbanisme" },
  { key: "construction", label: "Construction & habitation" },
  { key: "environnement", label: "Code de l’environnement" },
];

export default function CodeSelector({ selectedCodes, onChange }: Props) {
  const allSelected = selectedCodes.length === ALL_CODES.length;

  const toggleAll = () => {
    if (allSelected) onChange([]);
    else onChange(ALL_CODES.map(c => c.key));
  };

  const toggleCode = (code: LegalCode) => {
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter(c => c !== code));
    } else {
      onChange([...selectedCodes, code]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <button
        type="button"
        onClick={toggleAll}
        className={`px-3 py-1 rounded-full text-xs border ${
          allSelected
            ? "bg-black text-white"
            : "bg-white border-[#D5E1E3]"
        }`}
      >
        Tous les codes
      </button>

      {ALL_CODES.map(code => (
        <button
          key={code.key}
          type="button"
          onClick={() => toggleCode(code.key)}
          className={`px-3 py-1 rounded-full text-xs border ${
            selectedCodes.includes(code.key)
              ? "bg-[#FF4F3B] text-white border-[#FF4F3B]"
              : "bg-white border-[#D5E1E3]"
          }`}
        >
          {code.label}
        </button>
      ))}
    </div>
  );
}

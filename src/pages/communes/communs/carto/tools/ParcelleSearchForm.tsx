import { useState } from "react";
import { Search } from "lucide-react";

type Props = {
  /** Référence cadastrale saisie — la page gère zoom et sélection. */
  onSelect: (section: string, numero: string) => void | Promise<void>;
  embedded?: boolean;
};

export default function ParcelleSearchForm({ onSelect, embedded = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState("");
  const [numero, setNumero] = useState("");

  function padNumero(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    return trimmed.padStart(4, "0");
  }

  async function submit() {
    const normalizedSection = section.trim().toUpperCase();
    const normalizedNumero = padNumero(numero);
    if (!normalizedSection || !normalizedNumero) {
      alert("Veuillez renseigner la section et le numéro de parcelle.");
      return;
    }

    setLoading(true);
    try {
      await onSelect(normalizedSection, normalizedNumero);
    } catch {
      alert("Parcelle introuvable");
    } finally {
      setLoading(false);
    }
  }

  if (!embedded) {
    return (
      <div className="absolute top-4 left-4 z-40 w-80 bg-white shadow-md rounded-md p-3 text-sm space-y-3 border border-[#d5e1e3]">
        <ParcelleSearchFields
          section={section}
          numero={numero}
          loading={loading}
          onSectionChange={setSection}
          onNumeroChange={setNumero}
          onSubmit={submit}
        />
      </div>
    );
  }

  return (
    <div className="parcelle-search-form">
      <p className="parcelle-search-form__hint">
        Saisissez la section et le numéro si vous ne localisez pas la parcelle sur la carte.
      </p>
      <ParcelleSearchFields
        section={section}
        numero={numero}
        loading={loading}
        onSectionChange={setSection}
        onNumeroChange={setNumero}
        onSubmit={submit}
      />
    </div>
  );
}

function ParcelleSearchFields({
  section,
  numero,
  loading,
  onSectionChange,
  onNumeroChange,
  onSubmit,
}: {
  section: string;
  numero: string;
  loading: boolean;
  onSectionChange: (v: string) => void;
  onNumeroChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="parcelle-search-form__fields">
      <div className="parcelle-search-form__row">
        <label className="parcelle-search-form__label" htmlFor="parcelle-search-section">
          Section
        </label>
        <input
          id="parcelle-search-section"
          className="parcelle-search-form__input"
          placeholder="ex. AC"
          value={section}
          onChange={(e) => onSectionChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
      </div>
      <div className="parcelle-search-form__row">
        <label className="parcelle-search-form__label" htmlFor="parcelle-search-numero">
          Numéro
        </label>
        <input
          id="parcelle-search-numero"
          className="parcelle-search-form__input"
          placeholder="ex. 0042"
          value={numero}
          onChange={(e) => onNumeroChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
      </div>
      <button
        type="button"
        className="parcelle-search-form__submit"
        disabled={loading}
        onClick={onSubmit}
      >
        <Search size={14} aria-hidden />
        {loading ? "Recherche…" : "Rechercher la parcelle"}
      </button>
    </div>
  );
}

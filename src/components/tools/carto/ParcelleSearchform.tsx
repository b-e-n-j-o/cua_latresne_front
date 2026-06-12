import { useState } from "react";

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

  return (
    <div
      className={`${
        embedded ? "w-full space-y-3" : "absolute top-4 left-4 z-40 w-80"
      } ${embedded ? "" : "bg-white shadow-md rounded-md p-3 text-sm space-y-3"}`}
    >
      <input
        className="w-full border px-2 py-1 rounded text-sm"
        placeholder="Section (ex: AC)"
        value={section}
        onChange={(e) => setSection(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <input
        className="w-full border px-2 py-1 rounded text-sm"
        placeholder="Numéro (ex: 0042)"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button
        type="button"
        className="w-full bg-black text-white py-1.5 rounded text-sm disabled:opacity-50"
        disabled={loading}
        onClick={submit}
      >
        {loading ? "Recherche…" : "Rechercher"}
      </button>
    </div>
  );
}

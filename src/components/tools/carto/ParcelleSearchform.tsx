import { useState, useEffect } from "react";

type Props = {
  onSearch: (data: any, addressPoint?: [number, number], keepSelection?: boolean) => void;
  embedded?: boolean; // Si true, pas de positionnement absolu (pour sidebar)
};

type Mode = "parcelle" | "adresse";

export default function ParcelleSearchForm({ 
  onSearch, 
  embedded = false
}: Props) {
  const [mode, setMode] = useState<Mode>("parcelle");
  const [loading, setLoading] = useState(false);

  const [section, setSection] = useState("");
  const [numero, setNumero] = useState("");

  // Adresse (commune forcée à Latresne côté backend)
  const [adresse, setAdresse] = useState("");

  function padNumero(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    return trimmed.padStart(4, "0");
  }

  async function submit() {
    setLoading(true);
    try {
      let url = "";
      let addressPoint: [number, number] | undefined;
      let geojson: any;

      if (mode === "parcelle") {
        const communeValue = "Latresne";
        url =
          `${import.meta.env.VITE_API_BASE}/parcelle/et-voisins` +
          `?commune=${encodeURIComponent(communeValue)}` +
          `&section=${section}` +
          `&numero=${padNumero(numero)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        geojson = {
          type: data.type,
          features: data.features
        };
        addressPoint = data.address_point as [number, number] | undefined;
      } else if (mode === "adresse") {
        const q = `${adresse}, Latresne`;
        url =
          `${import.meta.env.VITE_API_BASE}/parcelle/et-voisins-adresse` +
          `?adresse=${encodeURIComponent(q)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        geojson = {
          type: data.type,
          features: data.features
        };
        addressPoint = data.address_point as [number, number] | undefined;
      }

      onSearch(geojson, addressPoint);
    } catch {
      alert("Recherche impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${embedded ? '' : 'absolute top-4 left-4 z-40'} bg-white shadow-md rounded-md p-3 text-sm ${embedded ? 'w-full' : 'w-80'} space-y-3`}>
      <div className="font-semibold">Rechercher une parcelle</div>

      {/* Onglets */}
      <div className="flex border rounded overflow-hidden">
        <button
          className={`flex-1 py-1 ${mode === "parcelle" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("parcelle")}
        >
          Parcelle
        </button>
        <button
          className={`flex-1 py-1 ${mode === "adresse" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("adresse")}
        >
          Adresse
        </button>
      </div>

      {/* Form Parcelle */}
      {mode === "parcelle" && (
        <>
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Section (ex: AC)"
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
          />
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Numéro (ex: 0042)"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
        </>
      )}

      {/* Form Adresse */}
      {mode === "adresse" && (
        <>
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Numéro et rue (ex : 12 rue des Malbecs)"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
        </>
      )}

      {/* Bouton de recherche */}
      <button
        className="w-full bg-black text-white py-1 rounded disabled:opacity-50"
        disabled={loading}
        onClick={submit}
      >
        {loading ? "Recherche…" : "Rechercher"}
      </button>
    </div>
  );
}

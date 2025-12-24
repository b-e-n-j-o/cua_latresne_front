import { useState } from "react";

type Props = {
  onSearch: (data: any, addressPoint?: [number, number]) => void;
};

type Mode = "parcelle" | "adresse";

export default function ParcelleSearchForm({ onSearch }: Props) {
  const [mode, setMode] = useState<Mode>("parcelle");
  const [loading, setLoading] = useState(false);

  // Parcelle
  const [commune, setCommune] = useState("");
  const [section, setSection] = useState("");
  const [numero, setNumero] = useState("");

  // Adresse
  const [adresse, setAdresse] = useState("");
  const [communeAdresse, setCommuneAdresse] = useState("");

  async function submit() {
    setLoading(true);
    try {
      let url = "";

      if (mode === "parcelle") {
        url =
          `${import.meta.env.VITE_API_BASE}/parcelle/et-voisins` +
          `?commune=${encodeURIComponent(commune)}` +
          `&section=${section}` +
          `&numero=${numero}`;
      } else {
        const q = `${adresse}, ${communeAdresse}`;
        url =
          `${import.meta.env.VITE_API_BASE}/parcelle/et-voisins-adresse` +
          `?adresse=${encodeURIComponent(q)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error();

      const data = await res.json();
      const geojson = {
        type: data.type,
        features: data.features
      };
      const addressPoint = data.address_point as [number, number] | undefined;
      
      onSearch(geojson, addressPoint);
    } catch {
      alert("Recherche impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute top-4 left-4 z-40 bg-white shadow-md rounded-md p-3 text-sm w-72 space-y-3">
      <div className="font-semibold">Rechercher</div>

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
            placeholder="Commune"
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
          />
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Section (ex: AC)"
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
          />
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Numéro (ex: 42)"
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
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Commune ou code postal (ex : Latresne ou 33360)"
            value={communeAdresse}
            onChange={(e) => setCommuneAdresse(e.target.value)}
          />
        </>
      )}

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

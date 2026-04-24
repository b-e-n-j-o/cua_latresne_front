import { useState } from "react";

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
  const [parcellesAdresse, setParcellesAdresse] = useState<Array<{ section: string; numero: string; label: string }>>([]);
  const [matchedAddress, setMatchedAddress] = useState<string | null>(null);

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

      setParcellesAdresse([]);
      setMatchedAddress(null);

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
        url =
          `${import.meta.env.VITE_API_BASE}/latresne/parcelles-via-adresse` +
          `?adresse=${encodeURIComponent(adresse)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        geojson = {
          type: data.type,
          features: data.features
        };
        addressPoint = data.address_point as [number, number] | undefined;
        setParcellesAdresse(Array.isArray(data.parcelles) ? data.parcelles : []);
        setMatchedAddress(typeof data.matched_address === "string" ? data.matched_address : null);
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
          {matchedAddress && (
            <div className="text-xs text-gray-500">
              Adresse reconnue : <span className="font-medium text-gray-700">{matchedAddress}</span>
            </div>
          )}
          {parcellesAdresse.length > 0 && (
            <div className="border rounded p-2 bg-gray-50">
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Parcelle(s) trouvée(s) ({parcellesAdresse.length})
              </div>
              <div className="text-xs text-gray-700">
                {parcellesAdresse.map((p) => p.label || `${p.section} ${p.numero}`).join(", ")}
              </div>
            </div>
          )}
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

import { useState } from "react";

type Props = {
  onSearch: (data: any, addressPoint?: [number, number]) => void;
};

type Mode = "parcelle" | "adresse" | "uf";

type UFParcelle = {
  section: string;
  numero: string;
};

export default function ParcelleSearchForm({ onSearch }: Props) {
  const [mode, setMode] = useState<Mode>("parcelle");
  const [loading, setLoading] = useState(false);

  // Parcelle & UF : commune
  const [commune, setCommune] = useState("");
  const [section, setSection] = useState("");
  const [numero, setNumero] = useState("");

  // Unité foncière : liste de parcelles
  const [ufParcelles, setUfParcelles] = useState<UFParcelle[]>([
    { section: "", numero: "" }
  ]);

  // Adresse
  const [adresse, setAdresse] = useState("");
  const [communeAdresse, setCommuneAdresse] = useState("");

  function addUfParcelle() {
    setUfParcelles((prev) => [...prev, { section: "", numero: "" }]);
  }

  function updateUfParcelle(index: number, field: keyof UFParcelle, value: string) {
    setUfParcelles((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              [field]: field === "section" ? value.toUpperCase() : value
            }
          : p
      )
    );
  }

  function removeUfParcelle(index: number) {
    setUfParcelles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    setLoading(true);
    try {
      let url = "";
      let addressPoint: [number, number] | undefined;
      let geojson: any;

      if (mode === "parcelle") {
        url =
          `${import.meta.env.VITE_API_BASE}/parcelle/et-voisins` +
          `?commune=${encodeURIComponent(commune)}` +
          `&section=${section}` +
          `&numero=${numero}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        geojson = {
          type: data.type,
          features: data.features
        };
        addressPoint = data.address_point as [number, number] | undefined;
      } else if (mode === "adresse") {
        const q = `${adresse}, ${communeAdresse}`;
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
      } else {
        // mode === "uf"
        const parcellesPayload = ufParcelles
          .map((p) => ({
            section: p.section.trim().toUpperCase(),
            numero: p.numero.trim()
          }))
          .filter((p) => p.section && p.numero);

        if (!commune.trim() || parcellesPayload.length === 0) {
          alert("Veuillez renseigner la commune et au moins une parcelle pour l'unité foncière.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/parcelle/uf-et-voisins`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              commune: commune.trim(),
              parcelles: parcellesPayload
            })
          }
        );

        if (!res.ok) throw new Error();

        const data = await res.json();
        geojson = {
          type: data.type,
          features: data.features
        };
        // Pas de point d'adresse pour l'UF
      }

      onSearch(geojson, addressPoint);
    } catch {
      alert("Recherche impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute top-4 left-4 z-40 bg-white shadow-md rounded-md p-3 text-sm w-80 space-y-3">
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
        <button
          className={`flex-1 py-1 ${mode === "uf" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("uf")}
        >
          Unité foncière
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

      {/* Form Unité foncière */}
      {mode === "uf" && (
        <div className="space-y-2">
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Commune"
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
          />

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {ufParcelles.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  className="w-20 border px-2 py-1 rounded"
                  placeholder="Section"
                  value={p.section}
                  onChange={(e) => updateUfParcelle(idx, "section", e.target.value)}
                />
                <input
                  className="flex-1 border px-2 py-1 rounded"
                  placeholder="Numéro"
                  value={p.numero}
                  onChange={(e) => updateUfParcelle(idx, "numero", e.target.value)}
                />
                {ufParcelles.length > 1 && (
                  <button
                    type="button"
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-100"
                    onClick={() => removeUfParcelle(idx)}
                  >
                    -
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="w-full border border-dashed px-2 py-1 rounded text-xs hover:bg-gray-50"
            onClick={addUfParcelle}
          >
            + Ajouter une parcelle
          </button>
        </div>
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

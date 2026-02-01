import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

type ParcelleInfo = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
};

type IntersectionResult = {
  table: string;
  display_name: string;
  elements?: string[];
};

type Props = {
  parcelle: ParcelleInfo;
  onResult?: (result: any) => void;
};

export default function ParcelleIdentity({ parcelle, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<IntersectionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    setShowResults(true);

    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      const response = await fetch(`${apiBase}/api/identite-parcelle/intersect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parcelle),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.intersections);
        // Passer le résultat complet au parent pour construction du contexte
        if (onResult) {
          onResult(data);
        }
      } else {
        setError(data.error || "Erreur lors du calcul");
      }
    } catch (err) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm transition-colors disabled:bg-gray-400"
      >
        {loading ? <Loader2 className="animate-spin" size={16} /> : <MapPin size={16} />}
        <span>{loading ? "Analyse..." : "Carte d'identité"}</span>
      </button>

      {showResults && !loading && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm max-h-64 overflow-y-auto">
          {error && (
            <div className="text-red-600">{error}</div>
          )}
          
          {!error && results.length === 0 && (
            <div className="text-gray-500">Aucune intersection</div>
          )}

          {!error && results.length > 0 && (
            <>
              <div className="font-medium mb-2">{results.length} couche(s) :</div>
              <ul className="space-y-2">
                {results.map((result, idx) => (
                  <li key={idx} className="text-xs">
                    <div className="font-semibold">{result.display_name}</div>
                    {result.elements && result.elements.length > 0 && (
                      <ul className="ml-3 mt-1 space-y-0.5 text-gray-600">
                        {result.elements.map((elem, i) => (
                          <li key={i}>• {elem}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
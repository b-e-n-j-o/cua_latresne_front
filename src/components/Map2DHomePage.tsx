import { useEffect, useState } from "react";

/**
 * Composant spécialisé pour afficher une carte 2D dans l'encart de la page d'accueil.
 * Adapté pour remplir complètement un conteneur avec aspect-square.
 */
export default function Map2DHomePage({ url }: { url: string }) {
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMap() {
      try {
        setLoading(true);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erreur ${res.status}`);

        const html = await res.text();
        const blob = new Blob([html], { type: "text/html" });
        const blobUrl = URL.createObjectURL(blob);

        setIframeSrc(blobUrl);
      } catch (err: any) {
        setError(err.message || "Erreur inattendue");
      } finally {
        setLoading(false);
      }
    }

    loadMap();
  }, [url]);

  return (
    <div className="w-full h-full border-0 rounded-2xl bg-white relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[#0b131f]/70 bg-white/80 rounded-2xl">
          Chargement de la carte...
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-600 text-sm text-center px-4 bg-white/80 rounded-2xl">
          Erreur lors du chargement de la carte :<br />
          {error}
        </div>
      )}

      {!error && (
        <iframe
          src={iframeSrc}
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-none rounded-2xl"
          style={{ display: loading ? "none" : "block" }}
          title="Carte réglementaire 2D"
        />
      )}
    </div>
  );
}


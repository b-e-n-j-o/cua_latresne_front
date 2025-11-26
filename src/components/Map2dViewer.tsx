import { useEffect, useState } from "react";

export default function Map2DViewer({ url }: { url: string }) {
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
    <div className="w-full border border-[#d5e1e3] rounded-lg bg-white relative h-[600px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[#0b131f]/70">
          Chargement de la carte...
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-600 text-sm text-center px-4">
          Erreur lors du chargement de la carte :<br />
          {error}
        </div>
      )}

      {!error && (
        <iframe
          src={iframeSrc}
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-none"
          style={{ display: loading ? "none" : "block" }}
        />
      )}
    </div>
  );
}

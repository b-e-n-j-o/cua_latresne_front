import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

export default function Map2DHomePage({ url }: { url: string }) {
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hovered, setHovered] = useState(false);

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

  // ESC support
  useEffect(() => {
    const escClose = (e: KeyboardEvent) =>
      e.key === "Escape" && setIsFullscreen(false);

    window.addEventListener("keydown", escClose);
    return () => window.removeEventListener("keydown", escClose);
  }, []);

  /** VIEWER RENDU */
  const viewer = (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm bg-white/70 rounded-xl z-10">
          Chargement…
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-600 bg-white/70 rounded-xl z-10 text-sm text-center px-4">
          Erreur :<br />
          {error}
        </div>
      )}

      {!error && (
        <iframe
          src={iframeSrc}
          sandbox="allow-scripts allow-same-origin"
          className="absolute inset-0 w-full h-full border-0 rounded-xl"
          style={{ display: loading ? "none" : "block" }}
        />
      )}

      {/* ⬇️ Overlay bouton toujours visible avec animation au hover */}
      {!isFullscreen && !loading && !error && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/30 text-white rounded-xl transition-all duration-300 ${
            hovered ? "bg-black/60" : "bg-black/30"
          }`}
        >
          <button
            onClick={() => setIsFullscreen(true)}
            className={`px-4 py-2 bg-white text-black font-medium rounded-lg shadow-md hover:bg-gray-100 transition-all duration-300 ${
              hovered ? "scale-105" : "scale-100"
            }`}
          >
            Visualiser la carte
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mode preview */}
      <div
        className="relative w-full h-full rounded-xl overflow-hidden"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {viewer}
      </div>

      {/* Mode fullscreen */}
      {isFullscreen &&
        createPortal(
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] p-6 flex flex-col">
            {/* 🔧 Bouton fermeture visible */}
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 bg-white/15 hover:bg-white/30 text-white p-2 rounded-xl shadow-lg backdrop-blur transition"
              style={{ zIndex: 10000 }}
            >
              <X size={26} />
            </button>

            <div
              className="flex-1 border border-white/20 rounded-2xl overflow-hidden relative"
              style={{ zIndex: 9000 }}
            >
              {viewer}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

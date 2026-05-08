import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function DocumentViewerHomePage({ url }: { url: string }) {
  const [hovered, setHovered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string>("");

  useEffect(() => {
    if (url) {
      // Google Docs Viewer
      setViewerUrl(
        `https://docs.google.com/gview?url=${encodeURIComponent(
          url
        )}&embedded=true`
      );
    }
  }, [url]);

  // ESC support
  useEffect(() => {
    const escClose = (e: KeyboardEvent) =>
      e.key === "Escape" && setIsFullscreen(false);

    window.addEventListener("keydown", escClose);
    return () => window.removeEventListener("keydown", escClose);
  }, []);

  return (
    <>
      {/* Preview container */}
      <div
        className="relative w-full h-full rounded-xl overflow-hidden border"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Document preview iframe */}
        <iframe
          src={viewerUrl}
          className="absolute inset-0 w-full h-full border-0 rounded-xl"
          title="Document Visualisation"
        />

        {/* ⬇️ Overlay bouton toujours visible avec animation au hover */}
        {!isFullscreen && (
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
              Visualiser le document
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen portal */}
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
              <iframe
                src={viewerUrl}
                className="absolute inset-0 w-full h-full border-0 rounded-xl"
                title="Document Plein écran"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

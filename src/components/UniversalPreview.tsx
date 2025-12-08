import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  url: string;
  title?: string;
}

export default function UniversalPreview({ url, title }: Props) {
  const [hovered, setHovered] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const extension = url
    ?.split("?")[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  useEffect(() => {
    async function prepareViewer() {
      if (!url) return;

      // 🔹 CAS MAPS HTML (charger le contenu et générer un blob comme avant)
      if (extension === "html" || extension === "htm" || extension === "map") {
        try {
          setLoading(true);
          setError(null);
          const res = await fetch(url);
          if (!res.ok) throw new Error("Impossible de charger la carte");

          const html = await res.text();
          const blob = new Blob([html], { type: "text/html" });
          const blobUrl = URL.createObjectURL(blob);

          // Nettoyer l'ancien blob URL s'il existe
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          blobUrlRef.current = blobUrl;

          setViewerUrl(blobUrl);
          setLoading(false);
          return;
        } catch (err) {
          console.error("Erreur chargement carte HTML:", err);
          setError(err instanceof Error ? err.message : "Erreur inattendue");
          setLoading(false);
          setViewerUrl(null);
          return;
        }
      }

      // 🔹 CAS DOCUMENTS OFFICE/PDF
      if (
        ["doc", "docx", "pdf", "xls", "xlsx", "ppt", "pptx"].includes(
          extension || ""
        )
      ) {
        setViewerUrl(
          `https://docs.google.com/gview?url=${encodeURIComponent(
            url
          )}&embedded=true`
        );
        return;
      }

      // 🔹 CAS SIMPLE (images, svg, json, etc)
      setViewerUrl(url);
    }

    prepareViewer();

    // Cleanup: revoke blob URL on unmount or when url/extension changes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [url, extension]);

  // ESC support pour fermer le fullscreen
  useEffect(() => {
    const escClose = (e: KeyboardEvent) =>
      e.key === "Escape" && setFullscreen(false);

    if (fullscreen) {
      window.addEventListener("keydown", escClose);
      return () => window.removeEventListener("keydown", escClose);
    }
  }, [fullscreen]);

  function renderPreview() {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          Chargement…
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-600 text-sm text-center px-4">
          Erreur : {error}
        </div>
      );
    }

    if (!viewerUrl) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          Impossible de prévisualiser ce fichier.
        </div>
      );
    }

    if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension || "")) {
      return (
        <img
          src={viewerUrl}
          alt="Aperçu"
          className="absolute inset-0 w-full h-full object-cover rounded-xl"
        />
      );
    }

    if (extension === "svg") {
      return (
        <iframe
          src={viewerUrl}
          className="absolute inset-0 w-full h-full border-0 rounded-xl bg-white"
          title="SVG Viewer"
        />
      );
    }

    if (extension === "json" || extension === "geojson") {
      return (
        <iframe
          srcDoc={`<pre style="padding:12px;font-size:14px;background:#fafafa;color:#111;white-space:pre-wrap;">${viewerUrl}</pre>`}
          className="absolute inset-0 w-full h-full rounded-xl border bg-white"
          title="JSON Viewer"
        />
      );
    }

    return (
      <iframe
        src={viewerUrl}
        sandbox="allow-scripts allow-same-origin allow-popups"
        className="absolute inset-0 w-full h-full border-0 rounded-xl bg-white"
        title={title || "Visualisation"}
      />
    );
  }

  return (
    <>
      {/* PREVIEW CONTAINER */}
      <div
        className="relative w-full h-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {renderPreview()}

        {/* Overlay hover */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-xl transition ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            onClick={() => setFullscreen(true)}
            className="px-4 py-2 bg-white text-black font-medium rounded-lg shadow hover:bg-gray-100 transition"
          >
            Visualiser
          </button>
        </div>
      </div>

      {/* FULLSCREEN VIEWER */}
      {fullscreen &&
        createPortal(
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex flex-col p-6">
            {/* 🔧 Bouton fermeture visible */}
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-6 right-6 bg-white/15 hover:bg-white/30 text-black p-2 rounded-xl shadow-lg backdrop-blur transition"
              style={{ zIndex: 10000 }}
            >
              <X size={26} />
            </button>

            <div
              className="flex-1 border border-white/20 rounded-2xl overflow-hidden relative bg-white"
              style={{ zIndex: 9000 }}
            >
              {renderPreview()}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

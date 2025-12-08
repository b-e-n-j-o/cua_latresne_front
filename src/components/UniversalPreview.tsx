import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileSearch } from "lucide-react";

interface Props {
  url: string;
  title?: string;
}

export default function UniversalPreview({ url, title }: Props) {
  const [hovered, setHovered] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const extension = url
    ?.split("?")[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  useEffect(() => {
    switch (extension) {
      case "html":
      case "htm":
      case "map":
        setViewerUrl(url);
        break;

      case "doc":
      case "docx":
      case "pdf":
      case "xls":
      case "xlsx":
      case "ppt":
      case "pptx":
        setViewerUrl(
          `https://docs.google.com/gview?url=${encodeURIComponent(
            url
          )}&embedded=true`
        );
        break;

      default:
        setViewerUrl(url);
    }
  }, [url, extension]);

  function renderPreview() {
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
            {/* Close button */}
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-6 right-6 bg-white/15 hover:bg-white/30 text-white p-2 rounded-xl shadow-lg"
            >
              <X size={26} />
            </button>

            <div className="flex-1 border border-white/20 rounded-2xl overflow-hidden relative bg-white">
              {renderPreview()}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

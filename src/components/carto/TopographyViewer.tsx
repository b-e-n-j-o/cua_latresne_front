import { useState, useEffect, useCallback, useRef } from "react";
import { X, ExternalLink, ChevronUp, ChevronDown } from "lucide-react";

interface TopographyViewerProps {
  parcelle: {
    section: string;
    numero: string;
    commune: string;
    insee: string;
  };
  onClose: () => void;
}

export default function TopographyViewer({ parcelle, onClose }: TopographyViewerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string>("");
  const blobUrlRef = useRef<string>("");

  const generateTopography = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = "";
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/topographie-3d`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_insee: parcelle.insee,
          section: parcelle.section,
          numero: parcelle.numero
        })
      });

      if (!response.ok) {
        throw new Error("Échec de la génération de la topographie");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setIframeUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  }, [parcelle.insee, parcelle.section, parcelle.numero]);

  useEffect(() => {
    generateTopography();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openInNewTab = () => {
    if (iframeUrl) {
      window.open(iframeUrl, "_blank");
    }
  };

  // Mode minimisé : petit onglet en bas à droite
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all"
        >
          <ChevronUp size={18} className="animate-bounce" />
          <div className="text-left">
            <div className="text-xs font-semibold">Topographie 3D</div>
            <div className="text-xs opacity-80">
              {parcelle.section} {parcelle.numero}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ml-2 p-1 hover:bg-white/20 rounded"
          >
            <X size={14} />
          </button>
        </button>
      </div>
    );
  }

  // Mode plein écran
  return (
    <div className="fixed inset-4 bg-white shadow-2xl rounded-lg overflow-hidden transition-all duration-300 z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <div>
            <h3 className="font-semibold text-sm">Topographie 3D</h3>
            <p className="text-xs text-slate-200">
              {parcelle.commune} – Section {parcelle.section} Parcelle {parcelle.numero}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {iframeUrl && (
            <button
              onClick={openInNewTab}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink size={16} />
            </button>
          )}
          
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title="Réduire"
          >
            <ChevronDown size={16} />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative w-full h-[calc(100%-52px)]">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
            <div className="relative w-12 h-12 mb-4">
              <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-slate-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 text-sm">Génération de la topographie 3D...</p>
            <p className="text-slate-400 text-xs mt-2">Traitement des données LIDAR IGN</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-6">
            <div className="text-red-600 text-center">
              <p className="font-semibold mb-2">Erreur</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={generateTopography}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {iframeUrl && !isLoading && !error && (
          <iframe
            src={iframeUrl}
            className="w-full h-full border-0"
            title="Visualisation 3D de la topographie"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}


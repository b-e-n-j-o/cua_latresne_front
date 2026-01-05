import { useState, useEffect } from "react";
import { FileText, Download, X, ChevronDown, ChevronUp } from "lucide-react";

interface DPEViewerProps {
  parcelle: {
    section: string;
    numero: string;
    commune: string;
    insee: string;
  };
  onClose: () => void;
}

export default function DPEViewer({ parcelle, onClose }: DPEViewerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");

  useEffect(() => {
    generateDPE();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, []);

  const generateDPE = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/rapport-dpe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_insee: parcelle.insee,
          section: parcelle.section,
          numero: parcelle.numero
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Erreur génération DPE");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = () => {
    if (pdfUrl) {
      const a = document.createElement("a");
      a.href = pdfUrl;
      a.download = `DPE_${parcelle.section}_${parcelle.numero}.pdf`;
      a.click();
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3"
        >
          <ChevronUp size={18} />
          <div className="text-left">
            <div className="text-xs font-semibold">Rapport DPE</div>
            <div className="text-xs opacity-80">{parcelle.section} {parcelle.numero}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="ml-2 p-1 hover:bg-white/20 rounded">
            <X size={14} />
          </button>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-4 bg-white shadow-2xl rounded-lg overflow-hidden z-50">
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={20} />
          <div>
            <h3 className="font-semibold text-sm">Diagnostic de Performance Énergétique</h3>
            <p className="text-xs text-blue-100">
              {parcelle.commune} – Section {parcelle.section} Parcelle {parcelle.numero}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pdfUrl && (
            <button onClick={downloadPDF} className="p-1.5 hover:bg-white/10 rounded" title="Télécharger PDF">
              <Download size={16} />
            </button>
          )}
          <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-white/10 rounded">
            <ChevronDown size={16} />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="relative w-full h-[calc(100%-52px)]">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-blue-600 text-sm">Génération du rapport DPE...</p>
            <p className="text-blue-400 text-xs mt-2">Intersection spatiale & analyse énergétique</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-6">
            <p className="text-red-600 font-semibold mb-2">Erreur</p>
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={generateDPE} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Réessayer
            </button>
          </div>
        )}

        {pdfUrl && !isLoading && (
          <iframe src={pdfUrl} className="w-full h-full border-0" title="Rapport DPE" />
        )}
      </div>
    </div>
  );
}
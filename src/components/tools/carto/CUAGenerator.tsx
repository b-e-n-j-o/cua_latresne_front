import { useState, useEffect } from "react";
import { FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface CUAGeneratorProps {
  parcelle: {
    section: string;
    numero: string;
    commune: string;
    insee: string;
  };
}

export function CUAGenerator({ parcelle }: CUAGeneratorProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [cuaViewerUrl, setCuaViewerUrl] = useState<string | null>(null);

  // Polling du statut du job
  useEffect(() => {
    if (!jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/status/${jobId}`
        );
        const data = await res.json();

        setStatus(data.status);
        setCurrentStep(data.current_step);

        if (data.status === "success") {
          setSlug(data.slug);
          if (data.result_enhanced?.cua_viewer_url) {
            setCuaViewerUrl(data.result_enhanced.cua_viewer_url);
          }
          clearInterval(pollInterval);
        } else if (data.status === "error") {
          setError(data.error || "Erreur lors de la génération");
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Erreur polling:", err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId]);

  const handleGenerate = async () => {
    setJobId(null);
    setStatus(null);
    setError(null);
    setSlug(null);
    setCurrentStep(null);
    setCuaViewerUrl(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE}/analyze-parcelles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parcelles: [
              {
                section: parcelle.section,
                numero: parcelle.numero,
              },
            ],
            code_insee: parcelle.insee,
            commune_nom: parcelle.commune,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Erreur lors du lancement de la génération");
      }

      const data = await response.json();
      setJobId(data.job_id);
      setStatus("queued");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const getStepLabel = (step: string | null) => {
    const steps: Record<string, string> = {
      queued: "En attente...",
      unite_fonciere: "Vérification unité foncière",
      intersections: "Analyse des servitudes",
      generation_cua: "Génération du CUA",
      cua_pret: "Finalisation",
      done: "Terminé",
      error: "Erreur",
    };
    return steps[step || ""] || "En cours...";
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Certificat d'Urbanisme
      </h3>

      {!jobId && !slug ? (
        <button
          onClick={handleGenerate}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Générer le CUA
        </button>
      ) : status === "success" && cuaViewerUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>CUA généré avec succès</span>
          </div>
          <a
            href={cuaViewerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Visualiser le CUA
          </a>
        </div>
      ) : status === "error" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Échec de la génération</span>
          </div>
          <button
            onClick={handleGenerate}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            Réessayer
          </button>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{getStepLabel(currentStep)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width:
                  currentStep === "unite_fonciere"
                    ? "25%"
                    : currentStep === "intersections"
                    ? "50%"
                    : currentStep === "generation_cua"
                    ? "75%"
                    : currentStep === "done"
                    ? "100%"
                    : "10%",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
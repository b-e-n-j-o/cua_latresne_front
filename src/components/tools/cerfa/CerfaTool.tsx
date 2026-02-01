import { useState } from "react";
import { DropZone } from "./DropZone";
import { ValidationView } from "./ValidationView";

const API_BASE = import.meta.env.VITE_API_BASE;

type Step = "idle" | "analysing" | "validation" | "error";

type Props = {
  onParcellesDetected?: (parcelles: Array<{
    section: string;
    numero: string;
    surface_m2?: number;
  }>, commune: string, insee: string) => void;
};

export default function CerfaTool({ onParcellesDetected }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentData, setCurrentData] = useState<any>(null);

  async function handleAnalyse() {
    if (!file) return;

    setStep("analysing");
    setError(null);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch(`${API_BASE}/cerfa/analyse`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Erreur lors de l'analyse du CERFA");
      }

      const json = await res.json();
      setResult(json);
      setCurrentData(json.data);
      setStep("validation");

      // Notifier le parent avec les parcelles détectées
      if (onParcellesDetected && json.data?.parcelles_detectees?.references_cadastrales) {
        const parcelles = json.data.parcelles_detectees.references_cadastrales;
        const commune = json.data.info_generales?.commune_nom || "";
        const insee = json.data.info_generales?.commune_insee || "";
        console.log("🔔 Notification parcelles détectées:", { parcelles, commune, insee });
        onParcellesDetected(parcelles, commune, insee);
      } else {
        console.warn("⚠️ Pas de callback onParcellesDetected ou pas de parcelles détectées");
      }
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
      setStep("error");
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          Certificat d'urbanisme (CERFA)
        </h3>
      </div>

      {/* Contenu */}
      {step === "idle" && (
        <DropZone
          file={file}
          onFileSelected={setFile}
          onAnalyse={handleAnalyse}
        />
      )}

      {step === "analysing" && (
        <div className="text-xs text-gray-600 italic">
          Analyse du formulaire CERFA en cours…
        </div>
      )}

      {step === "validation" && result && (
        <ValidationView
          result={{ ...result, data: currentData || result.data }}
          file={file}
          onBack={() => {
            setStep("idle");
            setFile(null);
            setResult(null);
            setCurrentData(null);
          }}
          onDataChange={(updatedData) => {
            setCurrentData(updatedData);
            setResult({ ...result, data: updatedData });
            
            // Mettre à jour les parcelles sur la carte si elles ont changé
            // Filtrer les parcelles vides (sans section ou numéro)
            if (onParcellesDetected && updatedData.parcelles_detectees?.references_cadastrales) {
              const parcelles = updatedData.parcelles_detectees.references_cadastrales.filter(
                (p: any) => p.section && p.numero && p.section.trim() && p.numero.trim()
              );
              
              if (parcelles.length > 0) {
                const commune = updatedData.info_generales?.commune_nom || "";
                const insee = updatedData.info_generales?.commune_insee || "";
                console.log("🔄 Mise à jour parcelles modifiées:", { parcelles, commune, insee });
                onParcellesDetected(parcelles, commune, insee);
              }
            }
          }}
        />
      )}

      {step === "error" && (
        <div className="text-xs text-red-600">
          Erreur : {error}
        </div>
      )}
    </div>
  );
}

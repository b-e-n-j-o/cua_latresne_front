import { useState, useEffect } from "react";
import { Mountain, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import TopographyViewer from "./TopographyViewer";
import DPEViewer from "./DPEViewer";
import { CUAGenerator } from "./CUAGenerator";
import ParcelleIdentity from "./ParcelleIdentity";
import ParcellePatrimoine from "./latresne/ParcellePatrimoineCard";
import type { ZonageInfo } from "../../../types/parcelle";

type UFParcelle = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
};

type Props = {
  ufParcelles: UFParcelle[];
  commune: string;
  insee: string;
  unionGeometry?: GeoJSON.Geometry;
  zonages?: ZonageInfo[]; // Zonages PLUi pour chaque parcelle de l'UF
  onClose: () => void;
  embedded?: boolean; // Si true, pas de positionnement absolu (pour sidebar)
};

type SelectionMode = "uf" | "parcelle";
type SelectedParcelle = UFParcelle | null;

export default function UniteFonciereCard({
  ufParcelles,
  commune,
  insee,
  embedded = false,
  unionGeometry,
  zonages,
  onClose
}: Props) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("uf");
  const [selectedParcelle, setSelectedParcelle] = useState<SelectedParcelle>(null);
  const [show3D, setShow3D] = useState(false);
  const [showDPE, setShowDPE] = useState(false);
  const [showCUA, setShowCUA] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showPatrimoine, setShowPatrimoine] = useState(false);
  const [patrimoineData, setPatrimoineData] = useState<any | null>(null);
  const [patrimoineLoading, setPatrimoineLoading] = useState(false);
  const [patrimoineError, setPatrimoineError] = useState<string | null>(null);
  const [patrimoineExists, setPatrimoineExists] = useState<boolean | null>(null);
  const [dpeExists, setDpeExists] = useState<boolean | null>(null);

  // Parcelle active pour les fonctionnalités (UF ou parcelle sélectionnée)
  const activeParcelle = selectionMode === "uf" 
    ? { section: ufParcelles.map(p => p.section).join("+"), numero: ufParcelles.map(p => p.numero).join("+"), commune, insee }
    : selectedParcelle || { section: "", numero: "", commune, insee };

  // Vérifier l'existence des données patrimoine pour la parcelle active
  useEffect(() => {
    if (selectionMode === "uf" || !selectedParcelle) {
      // Pour l'UF, on ne vérifie pas le patrimoine (trop complexe)
      setPatrimoineExists(null);
      return;
    }

    const checkPatrimoineExists = async () => {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      
      const numeroNormalise = String(Number(selectedParcelle.numero));
      const parcelleI = `${selectedParcelle.section}${numeroNormalise}`;

      try {
        const res = await fetch(
          `${apiBase}/latresne/patrimoine/${parcelleI}/exists`
        );

        if (res.ok) {
          const data = await res.json();
          setPatrimoineExists(data.exists);
        } else {
          setPatrimoineExists(false);
        }
      } catch (err) {
        console.error("❌ Erreur vérification patrimoine:", err);
        setPatrimoineExists(false);
      }
    };

    checkPatrimoineExists();
  }, [selectionMode, selectedParcelle]);

  // Vérifier l'existence d'un DPE pour la parcelle active
  useEffect(() => {
    if (selectionMode === "uf" || !selectedParcelle) {
      // Pour l'UF, on ne vérifie pas le DPE (trop complexe)
      setDpeExists(null);
      return;
    }

    const checkDpeExists = async () => {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";

      try {
        const res = await fetch(
          `${apiBase}/rapport-dpe/exists/${selectedParcelle.insee}/${selectedParcelle.section}/${selectedParcelle.numero}`
        );

        if (res.ok) {
          const data = await res.json();
          setDpeExists(data.exists);
        } else {
          setDpeExists(false);
        }
      } catch (err) {
        console.error("❌ Erreur vérification DPE:", err);
        setDpeExists(false);
      }
    };

    checkDpeExists();
  }, [selectionMode, selectedParcelle]);

  const handlePatrimoineClick = async () => {
    if (!selectedParcelle) return;
    
    setShowPatrimoine(true);

    if (patrimoineData || patrimoineLoading) return;

    setPatrimoineLoading(true);
    setPatrimoineError(null);

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";

    const numeroNormalise = String(Number(selectedParcelle.numero));
    const parcelleI = `${selectedParcelle.section}${numeroNormalise}`;

    try {
      console.log("🧩 Parcelle ID normalisée:", parcelleI);
      console.log("📡 Fetch patrimoine:", parcelleI);

      const res = await fetch(
        `${apiBase}/latresne/patrimoine/${parcelleI}`
      );

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}`);
      }

      const data = await res.json();
      setPatrimoineData(data);

    } catch (err: any) {
      console.error("❌ Erreur patrimoine:", err);
      setPatrimoineError(err.message);
    } finally {
      setPatrimoineLoading(false);
    }
  };

  return (
    <>
      <div className={`${embedded ? '' : 'absolute top-80 left-4 z-40'} bg-white shadow-lg rounded-md p-4 ${embedded ? 'w-full' : 'w-80'} max-h-[70vh] overflow-y-auto`}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-sm">Unité Foncière</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Info UF */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3">
          <div className="text-xs font-semibold text-amber-800 mb-1">
            {ufParcelles.length} parcelle{ufParcelles.length > 1 ? "s" : ""}
          </div>
          <div className="text-xs text-amber-700">
            {ufParcelles.map(p => `${p.section} ${p.numero}`).join(", ")}
          </div>
        </div>

        {/* Mode de sélection */}
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-700 mb-2">Mode d'action :</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectionMode("uf");
                setSelectedParcelle(null);
              }}
              className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                selectionMode === "uf"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              UF entière
            </button>
            <button
              onClick={() => {
                setSelectionMode("parcelle");
                if (!selectedParcelle && ufParcelles.length > 0) {
                  setSelectedParcelle(ufParcelles[0]);
                }
              }}
              className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                selectionMode === "parcelle"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Parcelle
            </button>
          </div>
        </div>

        {/* Sélection de parcelle individuelle */}
        {selectionMode === "parcelle" && (
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-700 mb-2">Sélectionner une parcelle :</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {ufParcelles.map((p, idx) => (
                <button
                  key={`${p.section}-${p.numero}-${idx}`}
                  onClick={() => setSelectedParcelle(p)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded border transition-colors ${
                    selectedParcelle?.section === p.section && selectedParcelle?.numero === p.numero
                      ? "bg-amber-100 border-amber-400 font-medium"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {p.section} {p.numero}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info parcelle active */}
        <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
          <div className="font-medium text-gray-700 mb-1">
            {selectionMode === "uf" ? "Unité Foncière" : "Parcelle sélectionnée"} :
          </div>
          <div className="text-gray-600">
            {selectionMode === "uf" 
              ? `${activeParcelle.section} / ${activeParcelle.numero}`
              : `${activeParcelle.section} ${activeParcelle.numero}`
            }
          </div>
        </div>

        {/* Affichage des zonages PLUi */}
        {zonages && zonages.length > 0 && (
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded p-2">
            <div className="text-xs font-semibold text-blue-800 mb-1">
              Zonages PLUi ({zonages.length})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {zonages.map((z, idx) => (
                <div key={idx} className="text-xs bg-white rounded p-1.5 border border-blue-100">
                  <div className="font-medium text-blue-900">
                    {z.section} {z.numero}
                  </div>
                  {z.etiquette ? (
                    <>
                      <div className="text-blue-700 font-medium">{z.etiquette}</div>
                      {z.libelle && (
                        <div className="text-blue-600 mt-0.5">{z.libelle}</div>
                      )}
                      {z.libelong && (
                        <div className="text-blue-500 text-xs mt-0.5 italic">{z.libelong}</div>
                      )}
                      {z.typezone && (
                        <div className="text-gray-600 text-xs mt-0.5">Type: {z.typezone}</div>
                      )}
                    </>
                  ) : (
                    <div className="text-gray-500 italic">Hors zonage</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {selectionMode === "parcelle" && selectedParcelle && (
            <button
              onClick={() => setShow3D(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white py-2 px-3 rounded text-sm transition-colors"
            >
              <Mountain size={16} />
              <span>Topographie 3D</span>
            </button>
          )}
          
          {selectionMode === "uf" && (
            <div className="w-full px-3 py-2 bg-gray-100 text-gray-500 text-xs rounded text-center">
              Topographie 3D disponible uniquement pour une parcelle individuelle
            </div>
          )}

          {selectionMode === "parcelle" && selectedParcelle && dpeExists === true && (
            <button
              onClick={() => setShowDPE(true)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm transition-colors"
            >
              <FileText size={16} />
              <span>Rapport DPE</span>
            </button>
          )}

          <button
            onClick={() => setShowCUA(true)}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm transition-colors"
            disabled={selectionMode === "parcelle" && !selectedParcelle}
          >
            <FileText size={16} />
            <span>Générer le CUA</span>
            {selectionMode === "uf" && <span className="text-xs opacity-75">(UF)</span>}
          </button>

          <button
            onClick={() => setShowIdentity(true)}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm transition-colors"
            disabled={selectionMode === "parcelle" && !selectedParcelle}
          >
            <FileText size={16} />
            <span>Identité</span>
            {selectionMode === "uf" && <span className="text-xs opacity-75">(UF)</span>}
          </button>

          {selectionMode === "parcelle" && selectedParcelle && patrimoineExists === true && (
            <>
              <button
                onClick={handlePatrimoineClick}
                disabled={patrimoineLoading}
                className={`w-full flex items-center justify-center gap-2 ${
                  patrimoineLoading
                    ? 'bg-amber-400 cursor-wait'
                    : 'bg-amber-600 hover:bg-amber-700'
                } text-white py-2 px-3 rounded text-sm transition-colors`}
              >
                <FileText size={16} />
                <span>
                  {patrimoineLoading ? 'Chargement...' : 'Données patrimoine'}
                </span>
              </button>
              
              {patrimoineError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {patrimoineError}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modales */}
      {show3D && selectedParcelle && selectionMode === "parcelle" && (
        <TopographyViewer
          parcelle={selectedParcelle}
          onClose={() => setShow3D(false)}
        />
      )}

      {showDPE && selectedParcelle && (
        <DPEViewer
          parcelle={selectedParcelle}
          onClose={() => setShowDPE(false)}
        />
      )}

      {showCUA && activeParcelle && (
        <div className="absolute top-20 left-80 z-50 bg-white shadow-xl rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">
              Générer le CUA {selectionMode === "uf" ? "(UF)" : ""}
            </h3>
            <button
              onClick={() => setShowCUA(false)}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>
          {selectionMode === "uf" ? (
            <CUAGeneratorUF ufParcelles={ufParcelles} commune={commune} insee={insee} />
          ) : (
            <CUAGenerator parcelle={activeParcelle} />
          )}
        </div>
      )}

      {showIdentity && activeParcelle && (
        <div className="absolute top-20 left-80 z-50 bg-white shadow-xl rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">
              Identité {selectionMode === "uf" ? "Unité Foncière" : "Parcelle"}
            </h3>
            <button
              onClick={() => setShowIdentity(false)}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>
          <ParcelleIdentity parcelle={activeParcelle} />
        </div>
      )}

      {showPatrimoine && patrimoineData && (
        <ParcellePatrimoine
          patrimoine={patrimoineData}
          onClose={() => setShowPatrimoine(false)}
        />
      )}
    </>
  );
}

// Composant CUAGenerator adapté pour les unités foncières (plusieurs parcelles)
function CUAGeneratorUF({
  ufParcelles,
  commune,
  insee
}: {
  ufParcelles: UFParcelle[];
  commune: string;
  insee: string;
}) {
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
            parcelles: ufParcelles.map(p => ({
              section: p.section,
              numero: p.numero,
            })),
            code_insee: insee,
            commune_nom: commune,
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
        Certificat d'Urbanisme (Unité Foncière)
      </h3>

      <div className="text-xs text-gray-600 mb-3 p-2 bg-gray-50 rounded">
        {ufParcelles.length} parcelle{ufParcelles.length > 1 ? "s" : ""} :{" "}
        {ufParcelles.map(p => `${p.section} ${p.numero}`).join(", ")}
      </div>

      {!jobId && !slug ? (
        <button
          onClick={handleGenerate}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Générer le CUA pour l'UF
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

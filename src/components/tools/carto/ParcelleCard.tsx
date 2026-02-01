import { useState, useEffect } from "react";
import { Mountain, FileText } from "lucide-react";
import TopographyViewer from "./TopographyViewer";
import DPEViewer from "./DPEViewer";
import { CUAGenerator } from "./CUAGenerator";
import ParcelleIdentity from "./ParcelleIdentity";
import ParcellePatrimoine from "./latresne/ParcellePatrimoineCard";
import type { ParcelleInfo, ParcelleContext } from "../../../types/parcelle";
import { buildParcelleContextText } from "../../../utils/buildParcelleContext";

type Props = {
  parcelle: ParcelleInfo;
  onClose: () => void;
  onContextUpdate?: (context: ParcelleContext | null) => void;
  embedded?: boolean; // Si true, pas de positionnement absolu (pour sidebar)
};

export default function ParcelleCard({ parcelle, onClose, onContextUpdate, embedded = false }: Props) {
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

  // Vérifier l'existence des données patrimoine au chargement
  useEffect(() => {
    const checkPatrimoineExists = async () => {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      
      // 👉 construire parcelle_i = "AE380" (normaliser le numéro pour supprimer les zéros de tête)
      const numeroNormalise = String(Number(parcelle.numero));
      const parcelleI = `${parcelle.section}${numeroNormalise}`;

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
  }, [parcelle.section, parcelle.numero]);

  // Vérifier l'existence d'un DPE au chargement
  useEffect(() => {
    const checkDpeExists = async () => {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";

      try {
        const res = await fetch(
          `${apiBase}/rapport-dpe/exists/${parcelle.insee}/${parcelle.section}/${parcelle.numero}`
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
  }, [parcelle.insee, parcelle.section, parcelle.numero]);

  const handlePatrimoineClick = async () => {
    setShowPatrimoine(true);

    // Déjà chargé → ne pas refetch
    if (patrimoineData || patrimoineLoading) return;

    setPatrimoineLoading(true);
    setPatrimoineError(null);

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";

    // 👉 construire parcelle_i = "AE380" (normaliser le numéro pour supprimer les zéros de tête)
    const numeroNormalise = String(Number(parcelle.numero));
    const parcelleI = `${parcelle.section}${numeroNormalise}`;

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
      <div className={`${embedded ? '' : 'absolute top-80 left-4 z-40'} bg-white shadow-lg rounded-md p-4 ${embedded ? 'w-full' : 'w-64'}`}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-sm">Parcelle</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="space-y-1 text-sm">
          {parcelle.isUF ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                <div className="text-xs font-semibold text-amber-800 mb-1">
                  Unité Foncière
                </div>
                <div className="text-xs text-amber-700">
                  {parcelle.ufParcelles?.map(p => `${p.section} ${p.numero}`).join(", ")}
                </div>
              </div>
              <div>
                <span className="font-medium">Sections :</span> {parcelle.section}
              </div>
              <div>
                <span className="font-medium">Numéros :</span> {parcelle.numero}
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="font-medium">Section :</span> {parcelle.section}
              </div>
              <div>
                <span className="font-medium">Numéro :</span> {parcelle.numero}
              </div>
              {parcelle.surface && (
                <div>
                  <span className="font-medium">Surface :</span> {parcelle.surface.toLocaleString('fr-FR')} m²
                </div>
              )}
            </>
          )}

          {/* Affichage des zonages */}
          {parcelle.isUF && parcelle.zonages && parcelle.zonages.length > 0 ? (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
              <div className="text-xs font-semibold text-blue-800 mb-1">
                Zonages ({parcelle.zonages.length})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {parcelle.zonages.map((z, idx) => (
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
          ) : parcelle.zonages && parcelle.zonages.length > 0 ? (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
              <div className="text-xs font-semibold text-blue-800 mb-1">Zonage PLUi</div>
              {parcelle.zonages[0].etiquette && (
                <div className="text-sm text-blue-900 font-medium">
                  {parcelle.zonages[0].etiquette}
                </div>
              )}
              {parcelle.zonages[0].libelle && (
                <div className="text-xs text-blue-700 mt-1">
                  {parcelle.zonages[0].libelle}
                </div>
              )}
              {parcelle.zonages[0].libelong && (
                <div className="text-xs text-blue-600 mt-1 italic">
                  {parcelle.zonages[0].libelong}
                </div>
              )}
              {parcelle.zonages[0].typezone && (
                <div className="text-xs text-gray-600 mt-1">
                  Type: {parcelle.zonages[0].typezone}
                </div>
              )}
            </div>
          ) : parcelle.zonage && (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
              <div className="text-xs font-semibold text-blue-800">Zonage</div>
              <div className="text-sm text-blue-900">{parcelle.zonage}</div>
            </div>
          )}
        </div>

        <div className="space-y-2 mt-3">
          <button
            onClick={() => setShow3D(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white py-2 px-3 rounded text-sm transition-colors"
          >
            <Mountain size={16} />
            <span>Topographie 3D</span>
          </button>

          {dpeExists === true && (
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
          >
            <FileText size={16} />
            <span>Générer le CUA</span>
          </button>

          <button
            onClick={() => setShowIdentity(true)}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm transition-colors"
          >
            <FileText size={16} />
            <span>Identité parcelle</span>
          </button>

          {patrimoineExists === true && (
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

      {show3D && (
        <TopographyViewer
          parcelle={parcelle}
          onClose={() => setShow3D(false)}
        />
      )}

      {showDPE && (
        <DPEViewer
          parcelle={parcelle}
          onClose={() => setShowDPE(false)}
        />
      )}

      {showCUA && (
        <div className="absolute top-20 left-80 z-50 bg-white shadow-xl rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Générer le CUA</h3>
            <button
              onClick={() => setShowCUA(false)}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>
          <CUAGenerator parcelle={parcelle} />
        </div>
      )}

      {showIdentity && (
        <div className="absolute top-20 left-80 z-50 bg-white shadow-xl rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Identité parcelle</h3>
            <button
              onClick={() => setShowIdentity(false)}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>
          <ParcelleIdentity 
            parcelle={parcelle}
            onResult={(result) => {
              if (result && onContextUpdate) {
                const contextKey = `${parcelle.insee}-${parcelle.section}-${parcelle.numero}`;
                const contextText = buildParcelleContextText(parcelle, result);
                // Extraire les zonages depuis les intersections (recherche de "zonage" dans display_name)
                const zonages = result.intersections
                  ?.filter((i: any) => i.display_name.toLowerCase().includes("zonage"))
                  ?.flatMap((i: any) => i.elements || [i.display_name]) || [];
                
                onContextUpdate({
                  key: contextKey,
                  text: contextText,
                  zonages
                });
              }
            }}
          />
        </div>
      )}

      {showPatrimoine && (
        <ParcellePatrimoine
          patrimoine={patrimoineData}
          onClose={() => setShowPatrimoine(false)}
        />
      )}
    </>
  );
}
import { useState } from "react";
import { Mountain, FileText, Scan } from "lucide-react";
import TopographyViewer from "./TopographyViewer";
import DPEViewer from "./DPEViewer";
import { CUAGenerator } from "./CUAGenerator";
import ParcelleIdentity from "./ParcelleIdentity";
import ParcellePatrimoine from "./latresne/ParcellePatrimoineCard";

type ParcelleInfo = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
  patrimoine?: any;
};

type Props = {
  parcelle: ParcelleInfo;
  onClose: () => void;
};

export default function ParcelleCard({ parcelle, onClose }: Props) {
  const [show3D, setShow3D] = useState(false);
  const [showDPE, setShowDPE] = useState(false);
  const [showCUA, setShowCUA] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showPatrimoine, setShowPatrimoine] = useState(false);
  const [lidarLoading, setLidarLoading] = useState(false);
  const [lidarError, setLidarError] = useState<string | null>(null);
  const [lidarGenerated, setLidarGenerated] = useState(false);
  const [patrimoineData, setPatrimoineData] = useState<any | null>(null);
  const [patrimoineLoading, setPatrimoineLoading] = useState(false);
  const [patrimoineError, setPatrimoineError] = useState<string | null>(null);

  const handleLidarClick = async () => {
    // Si déjà généré, juste ouvrir la visualisation
    if (lidarGenerated) {
      window.open(
        `/lidar/${parcelle.insee}/${parcelle.section}/${parcelle.numero}`, 
        '_blank'
      );
      return;
    }

    // Sinon, générer d'abord
    setLidarLoading(true);
    setLidarError(null);
    
    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    
    try {
      console.log('🚀 Génération nuage LIDAR...');
      const response = await fetch(
        `${apiBase}/api/lidar/parcelle/${parcelle.insee}/${parcelle.section}/${parcelle.numero}`
      );
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Génération échouée');
      }
      
      console.log('✅ Nuage généré');
      setLidarGenerated(true);
      
      // Ouvrir immédiatement après génération
      window.open(
        `/lidar/${parcelle.insee}/${parcelle.section}/${parcelle.numero}`, 
        '_blank'
      );
      
    } catch (err: any) {
      console.error('❌ Erreur génération LIDAR:', err);
      setLidarError(err.message);
    } finally {
      setLidarLoading(false);
    }
  };

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
      <div className="absolute top-80 left-4 z-40 bg-white shadow-lg rounded-md p-4 w-64">
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
          <div>
            <span className="font-medium">Section :</span> {parcelle.section}
          </div>
          <div>
            <span className="font-medium">Numéro :</span> {parcelle.numero}
          </div>
        </div>

        <div className="space-y-2 mt-3">
          <button
            onClick={() => setShow3D(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white py-2 px-3 rounded text-sm transition-colors"
          >
            <Mountain size={16} />
            <span>Topographie 3D</span>
          </button>

          <button 
            onClick={handleLidarClick}
            disabled={lidarLoading}
            className={`w-full flex items-center justify-center gap-2 ${
              lidarLoading 
                ? 'bg-orange-400 cursor-wait' 
                : lidarGenerated
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-orange-600 hover:bg-orange-700'
            } text-white py-2 px-3 rounded text-sm transition-colors`}
          >
            <Scan size={16} />
            <span>
              {lidarLoading 
                ? 'Génération...' 
                : lidarGenerated 
                ? 'Visualiser LIDAR' 
                : 'Générer LIDAR'}
            </span>
          </button>
          
          {lidarError && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {lidarError}
            </div>
          )}

          <button
            onClick={() => setShowDPE(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm transition-colors"
          >
            <FileText size={16} />
            <span>Rapport DPE</span>
          </button>

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
          <ParcelleIdentity parcelle={parcelle} />
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
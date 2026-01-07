import { useState } from "react";
import { Mountain, FileText } from "lucide-react";
import TopographyViewer from "./TopographyViewer";
import DPEViewer from "./DPEViewer";
import { CUAGenerator } from "./CUAGenerator";

type ParcelleInfo = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
};

type Props = {
  parcelle: ParcelleInfo;
  onClose: () => void;
};

export default function ParcelleCard({ parcelle, onClose }: Props) {
  const [show3D, setShow3D] = useState(false);
  const [showDPE, setShowDPE] = useState(false);

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
          <div>
            <span className="font-medium">Commune :</span> {parcelle.commune}
          </div>
          <div className="text-xs text-gray-500">
            INSEE : {parcelle.insee}
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
            onClick={() => setShowDPE(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm transition-colors"
          >
            <FileText size={16} />
            <span>Rapport DPE</span>
          </button>
        </div>

        {/* Nouveau composant CUA */}
        <CUAGenerator parcelle={parcelle} />
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
    </>
  );
}
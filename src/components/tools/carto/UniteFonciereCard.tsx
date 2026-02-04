import { useState } from "react";
import { FileText } from "lucide-react";
import ParcelleIdentity from "./ParcelleIdentity";
import { ManualCuaForm } from "../cerfa/ManualCuaForm";

type UFParcelle = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
  surface_m2?: number;
};

type Props = {
  ufParcelles: UFParcelle[];
  commune: string;
  insee: string;
  unionGeometry: GeoJSON.Geometry;
  onParcellesDetected?: (
    parcelles: Array<{
      section: string;
      numero: string;
      surface_m2?: number;
    }>,
    commune: string,
    insee: string
  ) => void;
  onClose: () => void;
  embedded?: boolean;
};

export default function UniteFonciereCard({
  ufParcelles,
  commune,
  insee,
  unionGeometry,
  onParcellesDetected,
  onClose,
  embedded = false
}: Props) {
  const [showIdentity, setShowIdentity] = useState(false);
  const [showCUA, setShowCUA] = useState(false);

  const totalSurface = ufParcelles.reduce(
    (sum, p) => sum + (p.surface_m2 || 0),
    0
  );

  return (
    <>
      <div className={`${embedded ? '' : 'absolute top-80 left-4 z-40'} bg-white shadow-lg rounded-md p-4 ${embedded ? 'w-full' : 'w-80'} max-h-[70vh] overflow-y-auto`}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-sm">Unité Foncière</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-lg leading-none">×</button>
        </div>

        {/* Info UF : liste des parcelles + surfaces */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3">
          <div className="text-xs font-semibold text-amber-800 mb-1">
            {ufParcelles.length} parcelle{ufParcelles.length > 1 ? "s" : ""}
          </div>
          <div className="space-y-1 text-xs text-amber-700">
            {ufParcelles.map((p) => (
              <div
                key={`${p.section}-${p.numero}`}
                className="flex justify-between gap-2"
              >
                <span className="font-mono">
                  {p.section} {p.numero}
                </span>
                {typeof p.surface_m2 === "number" && p.surface_m2 > 0 && (
                  <span className="text-amber-900 font-medium">
                    {p.surface_m2.toLocaleString("fr-FR")} m²
                  </span>
                )}
              </div>
            ))}
          </div>
          {totalSurface > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-200 text-xs font-medium text-amber-900">
              Surface totale UF :{" "}
              <span>
                {totalSurface.toLocaleString("fr-FR")} m²
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => setShowIdentity(true)}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm transition-colors"
          >
            <FileText size={16} />
            <span>Carte d'identité foncière</span>
          </button>

          <button
            onClick={() => setShowCUA(true)}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm transition-colors"
          >
            <FileText size={16} />
            <span>Certificat d'urbanisme</span>
          </button>
        </div>
      </div>

      {/* Modales */}
      {showIdentity && (
        <div className="absolute top-20 left-80 z-50 bg-white shadow-xl rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Identité Unité Foncière</h3>
            <button onClick={() => setShowIdentity(false)} className="text-gray-500 hover:text-gray-700 text-xl leading-none">×</button>
          </div>
          <ParcelleIdentity 
            parcelle={{
              section: ufParcelles.map(p => p.section).join("+"),
              numero: ufParcelles.map(p => p.numero).join("+"),
              commune,
              insee
            }} 
          />
        </div>
      )}

      {showCUA && (
        <div className="absolute top-20 left-80 z-50 bg-white shadow-xl rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Générer le CUA (UF)</h3>
            <button onClick={() => setShowCUA(false)} className="text-gray-500 hover:text-gray-700 text-xl leading-none">×</button>
          </div>
          <ManualCuaForm 
            ufParcelles={ufParcelles}
            unionGeometry={unionGeometry}
            onParcellesDetected={onParcellesDetected}
          />
        </div>
      )}
    </>
  );
}
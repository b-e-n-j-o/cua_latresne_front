import { useState, useEffect } from "react";
import { SideBarLeft } from "../components/layout/SideBarLeft";
import ParcelleSearchForm from "../components/tools/carto/ParcelleSearchform";
import ParcelleCard from "../components/tools/carto/ParcelleCard";
import UniteFonciereCard from "../components/tools/carto/UniteFonciereCard";
import { PLUConsultation } from "../components/tools/carto/PLUConsultation";
import MapPage from "./BordeauxMetropoleMap";
import type { ParcelleInfo, ZonageInfo, ParcelleContext } from "../types/parcelle";
import maplibregl from "maplibre-gl";

type MapState = {
  selectedParcelle: ParcelleInfo | null;
  parcelleContext: ParcelleContext | null;
  currentInsee: string | null;
  currentCommune: string | null;
  currentZones: string[];
  currentZoom: number;
  ufBuilderMode: boolean;
  selectedUfParcelles: Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry?: GeoJSON.Geometry;
  }>;
  mapRef: React.RefObject<maplibregl.Map | null>;
  showParcelleResultRef: React.MutableRefObject<((geojson: any, addressPoint?: [number, number], targetZoom?: number) => void) | null>;
  getZonageForUFRef: React.MutableRefObject<((insee: string, parcelles: Array<{ section: string; numero: string }>) => Promise<ZonageInfo[]>) | null>;
  setSelectedParcelle: (parcelle: ParcelleInfo | null) => void;
  setParcelleContext: (context: ParcelleContext | null) => void;
  setUfBuilderMode: (active: boolean) => void;
  setSelectedUfParcelles: React.Dispatch<React.SetStateAction<Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry?: GeoJSON.Geometry;
  }>>>;
};

export default function CartoWorkspacePage() {
  const [mapState, setMapState] = useState<MapState | null>(null);

  const handleCloseParcelle = () => {
    if (mapState) {
      mapState.setSelectedParcelle(null);
      mapState.setParcelleContext(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header simple */}
      <header className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between shadow-sm z-50">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            Atelier cartographique – Bordeaux Métropole
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Outils parcelle, PLU & analyse réglementaire
          </p>
        </div>
        <div className="text-xs text-gray-400">
          Version workspace
        </div>
      </header>

      {/* Contenu : sidebar gauche + carte droite */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <SideBarLeft
          searchSlot={
            mapState?.mapRef.current && (
              <ParcelleSearchForm
                embedded={true}
                onSearch={(geojson, addressPoint) => {
                  if (!mapState.mapRef.current || !mapState.showParcelleResultRef.current) return;
                  mapState.showParcelleResultRef.current(geojson, addressPoint);
                  mapState.setSelectedParcelle(null);
                  mapState.setParcelleContext(null);
                }}
                ufBuilderMode={mapState.ufBuilderMode}
                selectedUfParcelles={mapState.selectedUfParcelles}
                onUfBuilderToggle={(active) => {
                  mapState.setUfBuilderMode(active);
                  if (!active) {
                    mapState.setSelectedUfParcelles([]);
                  }
                  mapState.setParcelleContext(null);
                }}
                onUfParcelleRemove={(section, numero) => {
                  mapState.setSelectedUfParcelles(prev =>
                    prev.filter(p => !(p.section === section && p.numero === numero))
                  );
                }}
                onConfirmUF={async (parcelles, unionGeometry, commune, insee) => {
                  if (!mapState.getZonageForUFRef.current) {
                    console.error("getZonageForUF non disponible");
                    return;
                  }

                  const inseeCodes = parcelles
                    .map(p => p.insee)
                    .filter(insee => insee && insee.trim() !== "");
                  
                  if (inseeCodes.length === 0) {
                    alert("Impossible de créer l'unité foncière : aucune parcelle n'a de code INSEE.");
                    return;
                  }
                  
                  const uniqueInsee = [...new Set(inseeCodes)];
                  if (uniqueInsee.length > 1) {
                    alert("Impossible de créer l'unité foncière : les parcelles appartiennent à des communes différentes.");
                    return;
                  }
                  
                  const finalInsee = uniqueInsee[0] || insee;
                  
                  if (!finalInsee) {
                    alert("Impossible de créer l'unité foncière : code INSEE manquant.");
                    return;
                  }
                  
                  const zonages = await mapState.getZonageForUFRef.current(finalInsee, parcelles);
                  
                  mapState.setParcelleContext(null);
                  mapState.setSelectedParcelle({
                    section: parcelles.map(p => p.section).join("+"),
                    numero: parcelles.map(p => p.numero).join("+"),
                    commune,
                    insee: finalInsee,
                    isUF: true,
                    ufParcelles: parcelles,
                    ufUnionGeometry: unionGeometry,
                    zonages: zonages
                  });
                }}
              />
            )
          }
          parcelleSlot={
            mapState?.selectedParcelle ? (
              mapState.selectedParcelle.isUF && mapState.selectedParcelle.ufParcelles ? (
                <UniteFonciereCard
                  embedded={true}
                  ufParcelles={mapState.selectedParcelle.ufParcelles}
                  commune={mapState.selectedParcelle.commune}
                  insee={mapState.selectedParcelle.insee}
                  unionGeometry={mapState.selectedParcelle.ufUnionGeometry}
                  zonages={mapState.selectedParcelle.zonages}
                  onClose={handleCloseParcelle}
                />
              ) : (
                <ParcelleCard
                  embedded={true}
                  parcelle={mapState.selectedParcelle}
                  onClose={handleCloseParcelle}
                  onContextUpdate={(context) => mapState.setParcelleContext(context)}
                />
              )
            ) : undefined
          }
          pluSlot={
            mapState && (
              <PLUConsultation
                embedded={true}
                inseeCode={mapState.selectedParcelle?.insee || mapState.currentInsee}
                communeName={mapState.selectedParcelle?.commune || mapState.currentCommune}
                zones={
                  mapState.selectedParcelle && 
                  mapState.selectedParcelle.zonages && 
                  mapState.selectedParcelle.zonages.length > 0 && 
                  mapState.selectedParcelle.zonages[0].libelle
                    ? [mapState.selectedParcelle.zonages[0].libelle]
                    : mapState.currentZones
                }
                visible={mapState.currentZoom >= 14}
                parcelleContext={mapState.parcelleContext?.text || null}
              />
            )
          }
        />
        
        {/* Carte en mode embedded */}
        <div className="flex-1 relative">
          <MapPage 
            embedded 
            onStateChange={(state) => setMapState(state)}
          />
          
          {/* Message informatif pour le mode UF builder (affiché sur la carte) */}
          {mapState?.ufBuilderMode && mapState.currentZoom >= 13 && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
              <span className="text-sm font-medium">
                Mode UF actif - Cliquez sur les parcelles pour les ajouter ({mapState.selectedUfParcelles.length}/5)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

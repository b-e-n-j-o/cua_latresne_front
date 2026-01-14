// components/carto/latresne/LayerSwitcherLatresne.tsx
import { useState, useEffect } from "react";
import maplibregl from "maplibre-gl";

interface Layer {
  id: string;
  nom: string;
  type: string;
}

interface Props {
  map: maplibregl.Map | null;
  layers: Layer[];
  visibility: Record<string, boolean>;
  onToggle: (layerId: string) => void;
}

export default function LayerSwitcherLatresne({ map, layers, visibility, onToggle }: Props) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<number>(13);

  useEffect(() => {
    if (!map) return;
    
    const updateZoom = () => setZoom(map.getZoom());
    updateZoom();
    
    map.on("zoom", updateZoom);
    return () => { map.off("zoom", updateZoom); };
  }, [map]);

  const layersByType = layers.reduce((acc, layer) => {
    if (!acc[layer.type]) acc[layer.type] = [];
    acc[layer.type].push(layer);
    return acc;
  }, {} as Record<string, Layer[]>);

  const toggleType = (type: string) => {
    setExpandedTypes(s => {
      const newSet = new Set(s);
      newSet.has(type) ? newSet.delete(type) : newSet.add(type);
      return newSet;
    });
  };

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto w-80 z-40">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">Couches Latresne</h3>
        <span className="text-xs text-gray-500">Zoom: {zoom.toFixed(1)}</span>
      </div>
      {Object.entries(layersByType).map(([type, typeLayers]) => (
        <div key={type} className="mb-3">
          <button
            onClick={() => toggleType(type)}
            className="font-semibold text-sm mb-2 flex items-center gap-2 w-full"
          >
            <span>{expandedTypes.has(type) ? "▼" : "▶"}</span>
            {type} ({typeLayers.length})
          </button>
          {expandedTypes.has(type) && (
            <div className="ml-4 space-y-1">
              {typeLayers.map(layer => (
                <label key={layer.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!visibility[layer.id]}
                    onChange={() => onToggle(layer.id)}
                    className="w-4 h-4"
                  />
                  {layer.nom}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
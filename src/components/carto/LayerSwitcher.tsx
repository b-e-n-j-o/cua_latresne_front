import { useEffect, useState } from "react";
import maplibregl from "maplibre-gl";

import registerPLUILayer from "../../carto/layers/plui";
import registerI4Layer from "../../carto/layers/i4";
import registerAC1Layer from "../../carto/layers/ac1";
import registerAC2Layer from "../../carto/layers/ac2";
import registerAC4Layer from "../../carto/layers/ac4";
import registerI1Layer from "../../carto/layers/i1";


type LayerConfig = {
  id: string;
  label: string;
  mapLayers: string[];
  register: (map: maplibregl.Map, apiBase: string) => void;
  defaultVisible?: boolean;
};

type Props = {
  map: maplibregl.Map;
};

function setLayerGroupVisibility(
  map: maplibregl.Map,
  layerIds: string[],
  visible: boolean
) {
  const visibility = visible ? "visible" : "none";

  for (const id of layerIds) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visibility);
    }
  }
}

const LAYERS: LayerConfig[] = [
  {
    id: "plui",
    label: "Zonage PLU / PLUi",
    mapLayers: ["plui-fill", "plui-outline", "plui-labels"],
    register: registerPLUILayer,
    defaultVisible: false
  },
  {
    id: "i4",
    label: "Servitudes I4",
    mapLayers: ["i4-fill"],
    register: registerI4Layer,
    defaultVisible: false
  },
  {
    id: "ac1",
    label: "Servitudes AC1",
    mapLayers: ["ac1-fill"],
    register: registerAC1Layer
  },
  {
    id: "ac2",
    label: "Servitudes AC2",
    mapLayers: ["ac2-fill"],
    register: registerAC2Layer
  },
  {
    id: "ac4",
    label: "Servitudes AC4",
    mapLayers: ["ac4-fill"],
    register: registerAC4Layer
  },
  {
    id: "i1",
    label: "Servitudes I1",
    mapLayers: ["i1-lines"],
    register: registerI1Layer
  }
];

export default function LayerSwitcher({ map }: Props) {
  const apiBase = import.meta.env.VITE_API_BASE;

  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState<number>(() => map.getZoom());

  // Initialisation
  useEffect(() => {
    const initVis: Record<string, boolean> = {};
    const initLoaded: Record<string, boolean> = {};

    LAYERS.forEach(l => {
      initVis[l.id] = l.defaultVisible ?? false;
      initLoaded[l.id] = false;
    });

    setVisibility(initVis);
    setLoaded(initLoaded);
  }, []);

  // Réaction aux toggles
  useEffect(() => {
    for (const layer of LAYERS) {
      const isVisible = visibility[layer.id];
      if (isVisible === undefined) continue;

      // 🔹 1) Charger la couche si nécessaire
      if (isVisible && !loaded[layer.id]) {
        layer.register(map, apiBase);
        setLoaded(v => ({ ...v, [layer.id]: true }));
      }

      // 🔹 2) Gérer la visibilité
      setLayerGroupVisibility(map, layer.mapLayers, isVisible);
    }
  }, [visibility, loaded, map]);

  // Suivi en temps réel du niveau de zoom MapLibre
  useEffect(() => {
    const updateZoom = () => {
      setZoom(map.getZoom());
    };

    // Mise à jour initiale
    updateZoom();

    // On écoute les mouvements de caméra (inclut les changements de zoom)
    map.on("move", updateZoom);

    return () => {
      map.off("move", updateZoom);
    };
  }, [map]);

  function toggleLayer(id: string) {
    setVisibility(v => ({ ...v, [id]: !v[id] }));
  }

  return (
    <div className="absolute top-4 right-4 z-40 bg-white shadow-md rounded-md p-3 space-y-2 text-sm">
      <div className="flex items-baseline justify-between mb-1 gap-3">
        <div className="font-semibold">Couches</div>
        <div className="text-xs text-gray-500">
          Zoom&nbsp;:&nbsp;{zoom.toFixed(2)}
        </div>
      </div>
      {LAYERS.map(layer => (
        <label key={layer.id} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!visibility[layer.id]}
            onChange={() => toggleLayer(layer.id)}
          />
          {layer.label}
        </label>
      ))}
    </div>
  );
}

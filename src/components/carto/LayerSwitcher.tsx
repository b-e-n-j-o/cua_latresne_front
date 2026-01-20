import { useEffect, useState } from "react";
import maplibregl from "maplibre-gl";

import registerPLUILayer from "../../carto/layers/plui";
import registerPLUIPrescriptionsSurfLayer from "../../carto/layers/presc_surf_bdx_metropole";
import registerPLUIPrescriptionsLinLayer from "../../carto/layers/presc_lin_bdx_metropole";
import registerPLUIPrescriptionsPctLayer from "../../carto/layers/presc_pct_bdx_metropole";
import registerPLUIInfoSurfLayer from "../../carto/layers/infos_surf_bdx_metropole";
import registerPLUIInfoPctLayer from "../../carto/layers/info_pct_bdx_metropole";
import registerPLUIHabillageLinLayer from "../../carto/layers/habillage_lin_bdx_metropole";
import registerPLUIHabillagePctLayer from "../../carto/layers/habillage_pct_bdx_metropole";
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
  category: "PLUI" | "Servitudes";
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
    label: "Zonage",
    mapLayers: ["plui-fill", "plui-outline", "plui-labels"],
    register: registerPLUILayer,
    defaultVisible: false,
    category: "PLUI"
  },
  {
    id: "plui-presc-surf",
    label: "Prescriptions surfaciques",
    mapLayers: ["plui-presc-surf-fill", "plui-presc-surf-outline", "plui-presc-surf-labels"],
    register: registerPLUIPrescriptionsSurfLayer,
    defaultVisible: false,
    category: "PLUI"
  },
  {
    id: "plui-info-surf",
    label: "Informations surfaciques",
    mapLayers: ["plui-info-surf-fill", "plui-info-surf-outline", "plui-info-surf-labels"],
    register: registerPLUIInfoSurfLayer,
    defaultVisible: false,
    category: "PLUI"
  },
  {
    id: "plui-prescriptions-lin",
    label: "Prescriptions linéaires",
    mapLayers: ["plui-presc-lin"],
    register: registerPLUIPrescriptionsLinLayer,
    defaultVisible: false,
    category: "PLUI"
  },
  {
    id: "plui-prescriptions-pct",
    label: "Prescriptions ponctuelles",
    mapLayers: ["plui-presc-pct"],
    register: registerPLUIPrescriptionsPctLayer,
    defaultVisible: false,
    category: "PLUI"
  },
  {
    id: "plui-info-pct",
    label: "Informations ponctuelles",
    mapLayers: ["plui-info-pct"],
    register: registerPLUIInfoPctLayer,
    defaultVisible: false,
    category: "PLUI"
  },
  {
    id: "plui-habillage-lin",
    label: "Habillage linéaire",
    mapLayers: ["plui-habillage-lin"],
    register: registerPLUIHabillageLinLayer,
    defaultVisible: false,
    category: "PLUI"
  },
  {
    id: "plui-habillage-pct",
    label: "Habillage ponctuel",
    mapLayers: ["plui-habillage-pct"],
    register: registerPLUIHabillagePctLayer,
    defaultVisible: false,
    category: "PLUI"
  },
  {
    id: "i4",
    label: "Servitudes I4",
    mapLayers: ["i4-fill"],
    register: registerI4Layer,
    defaultVisible: false,
    category: "Servitudes"
  },
  {
    id: "ac1",
    label: "Servitudes AC1",
    mapLayers: ["ac1-fill"],
    register: registerAC1Layer,
    category: "Servitudes"
  },
  {
    id: "ac2",
    label: "Servitudes AC2",
    mapLayers: ["ac2-fill"],
    register: registerAC2Layer,
    category: "Servitudes"
  },
  {
    id: "ac4",
    label: "Servitudes AC4",
    mapLayers: ["ac4-fill"],
    register: registerAC4Layer,
    category: "Servitudes"
  },
  {
    id: "i1",
    label: "Servitudes I1",
    mapLayers: ["i1-lines"],
    register: registerI1Layer,
    category: "Servitudes"
  }
];

export default function LayerSwitcher({ map }: Props) {
  const apiBase = import.meta.env.VITE_API_BASE;

  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState<number>(() => map.getZoom());
  const [collapsed, setCollapsed] = useState(false);
  const [categoryCollapsed, setCategoryCollapsed] = useState<{
    PLUI: boolean;
    Servitudes: boolean;
  }>({
    PLUI: false,
    Servitudes: false,
  });

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
    <div className="absolute top-4 right-4 z-40 bg-white shadow-md rounded-md p-3 text-sm w-56">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">
          Couches
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            Zoom&nbsp;:&nbsp;{zoom.toFixed(2)}
          </div>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="text-gray-500 hover:text-black transition"
            title={collapsed ? "Afficher les couches" : "Masquer"}
          >
            {collapsed ? "▼" : "×"}
          </button>
        </div>
      </div>

      {collapsed && (
        <div className="text-xs text-gray-400 italic">
          {Object.values(visibility).filter(Boolean).length} couche(s) active(s)
        </div>
      )}

      {!collapsed && (
        <div className="space-y-3">
          {/* Groupe PLUI */}
          <div>
            <button
              type="button"
              onClick={() =>
                setCategoryCollapsed((prev) => ({
                  ...prev,
                  PLUI: !prev.PLUI,
                }))
              }
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-600 mb-1 uppercase"
            >
              <span>PLUI</span>
              <span className="text-gray-400">
                {categoryCollapsed.PLUI ? "▶" : "▼"}
              </span>
            </button>
            {!categoryCollapsed.PLUI && (
              <div className="space-y-1">
                {LAYERS.filter((l) => l.category === "PLUI").map((layer) => (
                  <label
                    key={layer.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!visibility[layer.id]}
                      onChange={() => toggleLayer(layer.id)}
                    />
                    {layer.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Groupe Servitudes */}
          <div>
            <button
              type="button"
              onClick={() =>
                setCategoryCollapsed((prev) => ({
                  ...prev,
                  Servitudes: !prev.Servitudes,
                }))
              }
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-600 mb-1 uppercase"
            >
              <span>Servitudes</span>
              <span className="text-gray-400">
                {categoryCollapsed.Servitudes ? "▶" : "▼"}
              </span>
            </button>
            {!categoryCollapsed.Servitudes && (
              <div className="space-y-1">
                {LAYERS.filter((l) => l.category === "Servitudes").map(
                  (layer) => (
                    <label
                      key={layer.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!!visibility[layer.id]}
                        onChange={() => toggleLayer(layer.id)}
                      />
                      {layer.label}
                    </label>
                  )
                )}
              </div>
            )}
            </div>
        </div>
      )}
    </div>
  );
}

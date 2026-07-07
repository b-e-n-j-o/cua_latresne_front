import type maplibregl from "maplibre-gl";
import SharedCartoLegendPanel from "../../communs/carto/legend/CartoLegendPanel";
import {
  CARTO_FAMILIES,
  CARTO_LAYERS,
  layersForFamily,
  type CartoLayerDef,
} from "./cartoLayers";
import {
  discoverGroupValues,
  mergeStaticGroupLegend,
  syncCartoOnMap,
} from "./cartoFilters";

const LATRESNE_BOUNDS: [number, number, number, number] = [
  -0.533033, 44.769809, -0.459991, 44.808794,
];

type Props = {
  map: maplibregl.Map | null;
  layerVisible: Record<string, boolean>;
  onLayerVisibleChange: (layerId: string, on: boolean) => void;
  onAfterSync?: (map: maplibregl.Map) => void;
  onLegendHarvesting?: (active: boolean) => void;
  embedded?: boolean;
};

const filters = {
  discoverGroupValues,
  mergeStaticGroupLegend,
  syncCartoOnMap,
};

export default function CartoLegendPanel(props: Props) {
  return (
    <SharedCartoLegendPanel<CartoLayerDef>
      {...props}
      communeBounds={LATRESNE_BOUNDS}
      families={CARTO_FAMILIES}
      layers={CARTO_LAYERS}
      layersForFamily={layersForFamily}
      filters={filters}
    />
  );
}

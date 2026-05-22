import LegendCollapsibleSection from "./LegendCollapsibleSection";
import LegendToggleGroup from "./LegendToggleGroup";
import type { MapData } from "../types";
import type { MapVisibilityState } from "../hooks/useMapVisibility";

type Props = {
  mapData: MapData;
  visibility: MapVisibilityState;
};

export default function MapLegend({ mapData, visibility }: Props) {
  const zones = mapData.zones.features;

  return (
    <div className="plu-map-panel__legend-scroll">
      {visibility.extraLayers.length > 0 && (
        <LegendCollapsibleSection
          title="Couches locales"
          count={visibility.extraLayers.reduce((n, l) => n + l.count, 0)}
        >
          {visibility.extraLayers.map((layer) => {
            const on = visibility.visibleExtra.has(layer.id);
            return (
              <button
                key={layer.id}
                type="button"
                className={`plu-map-panel__legend-item${on ? "" : " plu-map-panel__legend-item--off"}`}
                onClick={() => visibility.toggleExtra(layer.id)}
                title={layer.title}
              >
                <span
                  className="plu-map-panel__legend-dot"
                  style={{ background: layer.color, opacity: on ? 1 : 0.35 }}
                />
                <span className="plu-map-panel__legend-code">{layer.title}</span>
                <span className="plu-map-panel__legend-pct">{layer.count}</span>
              </button>
            );
          })}
        </LegendCollapsibleSection>
      )}

      {visibility.servitudeGroups.length > 0 && (
        <LegendCollapsibleSection
          title="Servitudes"
          count={visibility.servitudeGroups.reduce((n, g) => n + g.count, 0)}
        >
          <LegendToggleGroup
            groups={visibility.servitudeGroups}
            visible={visibility.visibleServitudes}
            onToggle={visibility.toggleServitude}
          />
        </LegendCollapsibleSection>
      )}

      {visibility.informationGroups.length > 0 && (
        <LegendCollapsibleSection
          title="Informations"
          count={visibility.informationGroups.reduce((n, g) => n + g.count, 0)}
        >
          <LegendToggleGroup
            groups={visibility.informationGroups}
            visible={visibility.visibleInformations}
            onToggle={visibility.toggleInformation}
          />
        </LegendCollapsibleSection>
      )}

      {visibility.prescriptionGroups.length > 0 && (
        <LegendCollapsibleSection
          title="Prescriptions"
          count={visibility.prescriptionGroups.reduce((n, g) => n + g.count, 0)}
        >
          <LegendToggleGroup
            groups={visibility.prescriptionGroups}
            visible={visibility.visiblePrescriptions}
            onToggle={visibility.togglePrescription}
          />
        </LegendCollapsibleSection>
      )}

      {zones.length > 0 && (
        <div className="plu-map-panel__legend-block">
          <div className="plu-map-panel__legend-section-title plu-map-panel__legend-section-title--static">
            Zonage PLU
          </div>
          <div className="plu-map-panel__legend-section-body plu-map-panel__legend-section-body--static">
            {zones.map((f) => {
              const p = f.properties;
              const on = visibility.visibleZones.has(p.code_zone);
              return (
                <button
                  key={p.code_zone}
                  type="button"
                  className={`plu-map-panel__legend-item${on ? "" : " plu-map-panel__legend-item--off"}`}
                  onClick={() => visibility.toggleZone(p.code_zone)}
                  title={p.libelong ?? p.libelle ?? p.code_zone}
                >
                  <span
                    className="plu-map-panel__legend-dot"
                    style={{ background: p.color, opacity: on ? 1 : 0.35 }}
                  />
                  <span className="plu-map-panel__legend-code">{p.code_zone}</span>
                  {p.pct_parcelle_couverte != null && (
                    <span className="plu-map-panel__legend-pct">{p.pct_parcelle_couverte} %</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import type { StudyZoneLayerLegend } from "./studyZoneLegend";

export type StudyZoneLegendLayerRow = {
  layerId: string;
  title: string;
  family: string;
  familyTitle: string;
  visibleCount: number;
  parcelHits: number;
};

type Props = {
  layerRows: StudyZoneLegendLayerRow[];
  layerLegends: StudyZoneLayerLegend[];
  visibleLayerIds: Set<string>;
  visibleGroups: Record<string, Set<string>>;
  onToggleLayer: (layerId: string) => void;
  onToggleGroup: (layerId: string, key: string) => void;
  onToggleAllGroups: (layerId: string, on: boolean, keys: string[]) => void;
};

function LayerToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <label className="rsp-switch" title={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="rsp-switch__track" />
      <span className="rsp-switch__thumb" />
    </label>
  );
}

function ColorLegendItems({
  items,
}: {
  items: readonly { label: string; color: string; count?: number }[];
}) {
  return (
    <div className="space-y-0.5">
      {items.map((l) => (
        <div key={l.label} className="flex items-center gap-1.5 py-0.5 min-w-0">
          <span className="rsp-swatch inline-block shrink-0" style={{ background: l.color }} />
          <span className="flex-1 truncate text-[10px] text-[#0b131f]/75" title={l.label}>
            {l.label}
          </span>
          {l.count != null ? (
            <span className="text-slate-500 tabular-nums text-[10px] shrink-0">{l.count}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Légende zone d'étude — alignée sur CartoLegendPanel (filtres par attribut discriminant). */
export default function StudyZoneLegendPanel({
  layerRows,
  layerLegends,
  visibleLayerIds,
  visibleGroups,
  onToggleLayer,
  onToggleGroup,
  onToggleAllGroups,
}: Props) {
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});

  const legendByLayerId = new Map(layerLegends.map((l) => [l.layerId, l]));

  const byFamily = layerRows.reduce<Record<string, StudyZoneLegendLayerRow[]>>((acc, row) => {
    if (!acc[row.familyTitle]) acc[row.familyTitle] = [];
    acc[row.familyTitle].push(row);
    return acc;
  }, {});

  const setFamilyVisible = (rows: StudyZoneLegendLayerRow[], on: boolean) => {
    for (const row of rows) {
      const isOn = visibleLayerIds.has(row.layerId);
      if (on && !isOn) onToggleLayer(row.layerId);
      if (!on && isOn) onToggleLayer(row.layerId);
    }
  };

  if (!layerRows.length) {
    return <p className="text-[11px] text-gray-500 italic px-1">Aucune couche visible.</p>;
  }

  return (
    <div className="carto-legend-embedded">
      <div className="carto-legend-embedded__scroll">
        {Object.entries(byFamily).map(([familyTitle, rows]) => {
          const familyOn = rows.some((r) => visibleLayerIds.has(r.layerId));
          const familyExpanded = expandedFamilies[familyTitle] ?? true;

          return (
            <div key={familyTitle} className="carto-legend-embedded__layer carto-legend-embedded__family">
              <div className="carto-legend-embedded__row">
                <button
                  type="button"
                  className="rsp-expand-btn"
                  aria-expanded={familyExpanded}
                  onClick={() =>
                    setExpandedFamilies((e) => ({ ...e, [familyTitle]: !familyExpanded }))
                  }
                >
                  {familyExpanded ? "▾" : "▸"}
                </button>
                <span
                  className={`carto-legend-embedded__label carto-legend-embedded__label--family${familyOn ? "" : " carto-legend-embedded__label--off"}`}
                  title={familyTitle}
                >
                  {familyTitle}
                </span>
                <LayerToggle
                  checked={familyOn}
                  onChange={(on) => setFamilyVisible(rows, on)}
                  label={familyTitle}
                />
              </div>

              {familyExpanded ? (
                <div className="carto-legend-embedded__family-children">
                  {rows.map((row) => {
                    const on = visibleLayerIds.has(row.layerId);
                    const legend = legendByLayerId.get(row.layerId);
                    const expanded = expandedLayers[row.layerId] ?? false;
                    const hasSub =
                      !!legend &&
                      (legend.colorLegendOnly ||
                        legend.filterable ||
                        (legend.items.length ?? 0) > 1);
                    const activeKeys = visibleGroups[row.layerId];
                    const itemKeys = legend?.items.map((i) => i.key) ?? [];

                    return (
                      <div
                        key={row.layerId}
                        className="carto-legend-embedded__layer carto-legend-embedded__layer--nested"
                      >
                        <div className="carto-legend-embedded__row">
                          {hasSub ? (
                            <button
                              type="button"
                              className="rsp-expand-btn"
                              aria-expanded={expanded}
                              onClick={() =>
                                setExpandedLayers((e) => ({
                                  ...e,
                                  [row.layerId]: !expanded,
                                }))
                              }
                            >
                              {expanded ? "▾" : "▸"}
                            </button>
                          ) : (
                            <span className="w-[1.375rem] shrink-0" />
                          )}
                          <span
                            className={`carto-legend-embedded__label${on ? "" : " carto-legend-embedded__label--off"}`}
                            title={row.title}
                          >
                            {row.title}
                          </span>
                          <LayerToggle
                            checked={on}
                            onChange={() => onToggleLayer(row.layerId)}
                            label={row.title}
                          />
                        </div>

                        {hasSub && expanded && legend ? (
                          <div className="carto-legend-embedded__sub">
                            {legend.colorLegendOnly ? (
                              <ColorLegendItems items={legend.items} />
                            ) : (
                              <>
                                <p className="text-[10px] text-slate-500 italic py-0.5">
                                  {legend.fieldLabel}
                                </p>
                                {legend.filterable ? (
                                  <div className="rsp-sub-actions">
                                    <button
                                      type="button"
                                      onClick={() => onToggleAllGroups(row.layerId, true, itemKeys)}
                                    >
                                      Tout
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onToggleAllGroups(row.layerId, false, itemKeys)}
                                    >
                                      Aucun
                                    </button>
                                  </div>
                                ) : null}
                                {legend.items.map((item) => {
                                  const groupOn = legend.filterable
                                    ? (activeKeys?.has(item.key) ?? true)
                                    : true;
                                  return (
                                    <label
                                      key={item.key}
                                      className={`rsp-sub-item${groupOn ? "" : " rsp-sub-item--off"}`}
                                    >
                                      {legend.filterable ? (
                                        <LayerToggle
                                          checked={groupOn}
                                          onChange={() => onToggleGroup(row.layerId, item.key)}
                                          label={item.label}
                                        />
                                      ) : null}
                                      <span
                                        className="rsp-swatch"
                                        style={{ background: item.color }}
                                      />
                                      <span
                                        className="flex-1 truncate text-[10px]"
                                        title={item.label}
                                      >
                                        {item.label}
                                      </span>
                                      <span className="text-slate-500 tabular-nums text-[10px] shrink-0">
                                        {item.count}
                                      </span>
                                    </label>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

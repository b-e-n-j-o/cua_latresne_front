import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type maplibregl from "maplibre-gl";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { buildEffectiveClassColorMap } from "../cartoClassColors";
import {
  LEGEND_AUTRES_KEY,
  LEGEND_CLASS_ROWS_VISIBLE,
  LEGEND_CLASS_TOP_K,
  buildLegendTree,
  isClassVisible,
  layerColorLegendOnly,
  layerHasClassList,
  prepareClassListForDisplay,
  toggleClassVisibility,
  type LegendFamilyDef,
  type LegendGroupItem,
  type LegendLayerCatalogDef,
} from "./cartoLegendModel";
import LegendClassColorPicker from "./LegendClassColorPicker";
import { harvestLegendAtCommuneExtent, isLegendLayerHarvested } from "../cartoLegendDiscover";
import "./cartoLegendShell.css";

export type CartoLegendFiltersApi<Def extends LegendLayerCatalogDef> = {
  discoverGroupValues: (map: maplibregl.Map, def: Def) => LegendGroupItem[];
  mergeStaticGroupLegend: (def: Def, discovered: LegendGroupItem[]) => LegendGroupItem[];
  syncCartoOnMap: (
    map: maplibregl.Map,
    layerVisible: Record<string, boolean>,
    visibleGroups: Record<string, Set<string>>,
    classColors?: Record<string, Record<string, string>>,
    onAfterSync?: (map: maplibregl.Map) => void,
  ) => void;
};

type Props<Def extends LegendLayerCatalogDef> = {
  map: maplibregl.Map | null;
  layerVisible: Record<string, boolean>;
  onLayerVisibleChange: (layerId: string, on: boolean) => void;
  onAfterSync?: (map: maplibregl.Map) => void;
  /** true pendant l'indexation communale des entités (masque le flash carte). */
  onLegendHarvesting?: (active: boolean) => void;
  embedded?: boolean;
  /** Emprise communale : récolte toutes les entités distinctes au premier affichage d'une couche. */
  communeBounds?: [number, number, number, number];
  families: readonly LegendFamilyDef[];
  layers: readonly Def[];
  layersForFamily: (familyId: string) => Def[];
  filters: CartoLegendFiltersApi<Def>;
};

function layerById<Def extends LegendLayerCatalogDef>(
  layers: readonly Def[],
): Map<string, Def> {
  return new Map(layers.map((layer) => [layer.id, layer]));
}

export default function CartoLegendPanel<Def extends LegendLayerCatalogDef>({
  map,
  layerVisible,
  onLayerVisibleChange,
  onAfterSync,
  onLegendHarvesting,
  embedded = false,
  communeBounds,
  families,
  layers,
  layersForFamily,
  filters,
}: Props<Def>) {
  const layerMap = useMemo(() => layerById(layers), [layers]);
  const { categories, standaloneLayerIds } = useMemo(
    () => buildLegendTree(families, layers),
    [families, layers],
  );

  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((category) => [category.id, false])),
  );
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      layers.filter((layer) => layerHasClassList(layer)).map((layer) => [layer.id, false]),
    ),
  );
  const [groupItems, setGroupItems] = useState<Record<string, LegendGroupItem[]>>({});
  const [visibleGroups, setVisibleGroups] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const def of layers) {
      if (def.staticGroupLegend) {
        init[def.id] = new Set(def.staticGroupLegend.map((item) => item.key));
      }
    }
    return init;
  });
  const [classColorOverrides, setClassColorOverrides] = useState<
    Record<string, Record<string, string>>
  >({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autresKeysByLayer = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const def of layers) {
      const items = groupItems[def.id] ?? [];
      if (!items.length) continue;
      result[def.id] = prepareClassListForDisplay(items, LEGEND_CLASS_TOP_K).autresKeys;
    }
    return result;
  }, [groupItems, layers]);

  const classColorsByLayer = useMemo(() => {
    const result: Record<string, Record<string, string>> = {};
    for (const def of layers) {
      if (!def.groupField) continue;
      const keys = new Set<string>();
      for (const item of groupItems[def.id] ?? []) keys.add(item.key);
      for (const item of def.staticGroupLegend ?? []) keys.add(item.key);
      for (const key of autresKeysByLayer[def.id] ?? []) keys.add(key);
      if (!keys.size) continue;
      result[def.id] = buildEffectiveClassColorMap(
        def,
        [...keys],
        classColorOverrides[def.id],
      );
    }
    return result;
  }, [autresKeysByLayer, classColorOverrides, groupItems, layers]);

  const refreshGroups = useCallback(() => {
    if (!map?.isStyleLoaded()) return;

    const nextItems: Record<string, LegendGroupItem[]> = {};
    for (const def of layers) {
      if (!def.groupField) continue;
      const discovered = filters.discoverGroupValues(map, def);
      nextItems[def.id] = filters.mergeStaticGroupLegend(def, discovered);
    }

    setGroupItems((prevItems) => {
      setVisibleGroups((prev) => {
        const next: Record<string, Set<string>> = { ...prev };
        for (const def of layers) {
          if (!def.groupField) continue;
          const items = nextItems[def.id] ?? [];
          const layerId = def.id;
          const oldKeys = new Set((prevItems[layerId] ?? []).map((item) => item.key));
          if (!prev[layerId]) {
            const initial = def.staticGroupLegend
              ? def.staticGroupLegend.map((item) => item.key)
              : items.map((item) => item.key);
            next[layerId] = new Set(initial);
            continue;
          }
          const set = new Set(prev[layerId]);
          for (const { key } of items) {
            if (!oldKeys.has(key)) set.add(key);
          }
          next[layerId] = set;
        }
        return next;
      });
      return nextItems;
    });
  }, [filters, layers, map]);

  useEffect(() => {
    if (!map?.isStyleLoaded() || !communeBounds) return;
    let cancelled = false;

    const pending = layers.filter(
      (def) =>
        layerVisible[def.id] &&
        def.groupField &&
        map.getSource(def.id) &&
        !isLegendLayerHarvested(def.id),
    );
    if (!pending.length) return;

    void (async () => {
      onLegendHarvesting?.(true);
      try {
        for (const def of pending) {
          if (cancelled) break;
          await harvestLegendAtCommuneExtent(map, def, communeBounds);
        }
        if (!cancelled) refreshGroups();
      } finally {
        if (!cancelled) onLegendHarvesting?.(false);
      }
    })();

    return () => {
      cancelled = true;
      onLegendHarvesting?.(false);
    };
  }, [communeBounds, layerVisible, layers, map, onLegendHarvesting, refreshGroups]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refreshGroups, 400);
  }, [refreshGroups]);

  useEffect(() => {
    if (!map) return;
    refreshGroups();
    map.on("idle", scheduleRefresh);
    return () => {
      map.off("idle", scheduleRefresh);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [map, refreshGroups, scheduleRefresh]);

  useEffect(() => {
    if (!map) return;
    filters.syncCartoOnMap(map, layerVisible, visibleGroups, classColorsByLayer, onAfterSync);
  }, [classColorsByLayer, filters, map, layerVisible, visibleGroups, onAfterSync]);

  const handleClassColorChange = useCallback(
    (layerId: string, classKey: string, color: string) => {
      setClassColorOverrides((prev) => ({
        ...prev,
        [layerId]: { ...(prev[layerId] ?? {}), [classKey]: color },
      }));
    },
    [],
  );

  const toggleFamily = (familyId: string, on: boolean) => {
    for (const def of layersForFamily(familyId)) {
      onLayerVisibleChange(def.id, on);
    }
  };

  const familyChecked = (familyId: string): boolean => {
    const familyLayers = layersForFamily(familyId);
    return familyLayers.length > 0 && familyLayers.some((layer) => layerVisible[layer.id]);
  };

  const resolveItems = (def: Def): LegendGroupItem[] => {
    const discovered = groupItems[def.id] ?? [];
    if (discovered.length > 0) return discovered;
    return (
      def.staticGroupLegend?.map((item) => ({
        key: item.key,
        label: item.label,
        color: item.color,
        count: 0,
      })) ?? []
    );
  };

  const legendBody = (
    <div className="carto-legend-shell">
      {categories.map((category) => (
        <CategoryRow
          key={category.id}
          title={category.title}
          expanded={!!expandedFamilies[category.id]}
          visible={familyChecked(category.id)}
          onToggleExpand={() =>
            setExpandedFamilies((prev) => ({ ...prev, [category.id]: !prev[category.id] }))
          }
          onToggleVisible={() => toggleFamily(category.id, !familyChecked(category.id))}
        >
          {category.layerIds.map((layerId) => {
            const def = layerMap.get(layerId);
            if (!def) return null;
            return (
              <LayerRow
                key={def.id}
                def={def}
                layerOn={!!layerVisible[def.id]}
                expanded={!!expandedLayers[def.id]}
                items={resolveItems(def)}
                activeKeys={visibleGroups[def.id]}
                autresKeys={autresKeysByLayer[def.id] ?? []}
                onLayerChange={(on) => onLayerVisibleChange(def.id, on)}
                onToggleExpand={() =>
                  setExpandedLayers((prev) => ({ ...prev, [def.id]: !prev[def.id] }))
                }
                onToggleClass={(classKey) =>
                  setVisibleGroups((prev) => ({
                    ...prev,
                    [def.id]: toggleClassVisibility(
                      prev[def.id],
                      classKey,
                      autresKeysByLayer[def.id] ?? [],
                    ),
                  }))
                }
                onToggleAllClasses={(on, keys) =>
                  setVisibleGroups((prev) => ({
                    ...prev,
                    [def.id]: on ? new Set(keys) : new Set(),
                  }))
                }
                classColors={classColorsByLayer[def.id]}
                onClassColorChange={(classKey, color) =>
                  handleClassColorChange(def.id, classKey, color)
                }
              />
            );
          })}
        </CategoryRow>
      ))}

      {standaloneLayerIds.map((layerId) => {
        const def = layerMap.get(layerId);
        if (!def) return null;
        return (
          <LayerRow
            key={def.id}
            def={def}
            layerOn={!!layerVisible[def.id]}
            expanded={!!expandedLayers[def.id]}
            items={resolveItems(def)}
            activeKeys={visibleGroups[def.id]}
            autresKeys={autresKeysByLayer[def.id] ?? []}
            onLayerChange={(on) => onLayerVisibleChange(def.id, on)}
            onToggleExpand={() =>
              setExpandedLayers((prev) => ({ ...prev, [def.id]: !prev[def.id] }))
            }
            onToggleClass={(classKey) =>
              setVisibleGroups((prev) => ({
                ...prev,
                [def.id]: toggleClassVisibility(
                  prev[def.id],
                  classKey,
                  autresKeysByLayer[def.id] ?? [],
                ),
              }))
            }
            onToggleAllClasses={(on, keys) =>
              setVisibleGroups((prev) => ({
                ...prev,
                [def.id]: on ? new Set(keys) : new Set(),
              }))
            }
            classColors={classColorsByLayer[def.id]}
            onClassColorChange={(classKey, color) =>
              handleClassColorChange(def.id, classKey, color)
            }
          />
        );
      })}
    </div>
  );

  if (embedded) {
    return <div className="carto-legend-embedded__scroll">{legendBody}</div>;
  }

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none">
      {!panelOpen ? (
        <button
          type="button"
          className="pointer-events-auto px-3 py-2 text-xs font-medium bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 hover:bg-white"
          onClick={() => setPanelOpen(true)}
        >
          Couches
        </button>
      ) : (
        <div
          className="pointer-events-auto flex flex-col bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 text-xs overflow-hidden"
          style={{
            width: 300,
            minWidth: 220,
            maxWidth: "min(340px, 90vw)",
            height: 420,
            minHeight: 160,
            maxHeight: "min(60vh, 480px)",
            resize: "both",
          }}
        >
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-gray-200 bg-gray-50/90 shrink-0">
            <span className="font-semibold text-gray-800 text-[11px] uppercase tracking-wide">
              Couches
            </span>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-800 px-1 leading-none"
              title="Réduire le panneau"
              onClick={() => setPanelOpen(false)}
            >
              −
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0">{legendBody}</div>
        </div>
      )}
    </div>
  );
}

function Caret({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="carto-legend-shell__caret"
    >
      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
    </button>
  );
}

function Swatch({
  color,
  onClick,
  title,
}: {
  color: string;
  onClick?: () => void;
  title?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        className="carto-legend-shell__swatch-btn"
        style={{ background: color }}
        title={title}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      />
    );
  }
  return <span className="carto-legend-shell__swatch" style={{ background: color }} />;
}

function CategoryRow({
  title,
  expanded,
  visible,
  onToggleExpand,
  onToggleVisible,
  children,
}: {
  title: string;
  expanded: boolean;
  visible: boolean;
  onToggleExpand: () => void;
  onToggleVisible: () => void;
  children: ReactNode;
}) {
  return (
    <div className="carto-legend-shell__category">
      <div className="carto-legend-shell__row">
        <Caret open={expanded} onClick={onToggleExpand} />
        <button
          type="button"
          className="carto-legend-shell__row-main"
          onClick={onToggleVisible}
          title="Afficher / masquer la catégorie"
        >
          <span
            className={`carto-legend-shell__label carto-legend-shell__label--category${visible ? "" : " carto-legend-shell__label--off"}`}
          >
            {title}
          </span>
          {visible ? (
            <Eye size={11} className="carto-legend-shell__row-eye" />
          ) : (
            <EyeOff size={11} className="carto-legend-shell__row-eye" />
          )}
        </button>
      </div>
      {expanded ? <div className="carto-legend-shell__children">{children}</div> : null}
    </div>
  );
}

function LayerRow({
  def,
  layerOn,
  expanded,
  items,
  activeKeys,
  autresKeys,
  onLayerChange,
  onToggleExpand,
  onToggleClass,
  onToggleAllClasses,
  classColors,
  onClassColorChange,
}: {
  def: LegendLayerCatalogDef;
  layerOn: boolean;
  expanded: boolean;
  items: LegendGroupItem[];
  activeKeys?: Set<string>;
  autresKeys: string[];
  onLayerChange: (on: boolean) => void;
  onToggleExpand: () => void;
  onToggleClass: (classKey: string) => void;
  onToggleAllClasses: (on: boolean, keys: string[]) => void;
  classColors?: Record<string, string>;
  onClassColorChange?: (classKey: string, color: string) => void;
}) {
  const hasSub = layerHasClassList(def);
  const colorLegendOnly = layerColorLegendOnly(def);
  const groupsReady = activeKeys !== undefined || !!def.staticGroupLegend;
  const prepared = prepareClassListForDisplay(items, LEGEND_CLASS_TOP_K);
  const allClassKeys = [
    ...prepared.displayItems.filter((item) => !item.isOther).map((item) => item.key),
    ...autresKeys,
  ];

  return (
    <div className="carto-legend-shell__layer">
      <div className="carto-legend-shell__row">
        {hasSub ? <Caret open={expanded} onClick={onToggleExpand} /> : <span className="carto-legend-shell__caret-spacer" />}
        <button
          type="button"
          className="carto-legend-shell__row-main"
          onClick={() => onLayerChange(!layerOn)}
          title="Afficher / masquer la couche"
        >
          <span
            className={`carto-legend-shell__label${layerOn ? "" : " carto-legend-shell__label--off"}`}
          >
            {def.title}
          </span>
          {layerOn ? (
            <Eye size={11} className="carto-legend-shell__row-eye" />
          ) : (
            <EyeOff size={11} className="carto-legend-shell__row-eye" />
          )}
        </button>
      </div>

      {hasSub && expanded && layerOn ? (
        <div className="carto-legend-shell__classes">
          {colorLegendOnly ? (
            <div className="carto-legend-shell__color-list">
              {def.colorLegend?.map((item) => (
                <div key={item.label} className="carto-legend-shell__color-item">
                  <Swatch color={item.color} />
                  <span className="carto-legend-shell__class-label">{item.label}</span>
                </div>
              ))}
            </div>
          ) : !groupsReady || (!def.staticGroupLegend && items.length === 0) ? (
            <p className="carto-legend-shell__loading">Chargement…</p>
          ) : (
            <>
              {prepared.truncated ? (
                <p className="carto-legend-shell__hint">
                  {prepared.totalDistinct} valeurs · {LEGEND_CLASS_TOP_K} principales + Autres
                </p>
              ) : null}
              <div className="carto-legend-shell__bulk">
                <button type="button" onClick={() => onToggleAllClasses(true, allClassKeys)}>
                  tout
                </button>
                <button type="button" onClick={() => onToggleAllClasses(false, allClassKeys)}>
                  aucun
                </button>
              </div>
              <div
                className="carto-legend-shell__class-scroll"
                style={{ maxHeight: LEGEND_CLASS_ROWS_VISIBLE * 22 }}
              >
                {prepared.displayItems.map((item) => {
                  const visible = isClassVisible(def.id, item.key, activeKeys, {
                    [def.id]: autresKeys,
                  });
                  const displayColor = classColors?.[item.key] ?? item.color;
                  return (
                    <div
                      key={item.key}
                      className={`carto-legend-shell__class${visible ? "" : " carto-legend-shell__class--off"}`}
                    >
                      {!item.isOther && onClassColorChange ? (
                        <LegendClassColorPicker
                          color={displayColor}
                          onChange={(color) => onClassColorChange(item.key, color)}
                        />
                      ) : (
                        <Swatch color={displayColor} />
                      )}
                      <button
                        type="button"
                        className="carto-legend-shell__class-main"
                        onClick={() => onToggleClass(item.key)}
                      >
                        <span
                          className={`carto-legend-shell__class-label${item.isOther ? " carto-legend-shell__class-label--other" : ""}`}
                          title={item.label}
                        >
                          {item.label}
                        </span>
                        {!item.isOther ? (
                          <span className="carto-legend-shell__class-count">{item.count ?? 0}</span>
                        ) : null}
                        {visible ? (
                          <Eye size={11} className="carto-legend-shell__class-eye" />
                        ) : (
                          <EyeOff size={11} className="carto-legend-shell__class-eye" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import type maplibregl from "maplibre-gl";
import { CARTO_LAYERS, ZONAGE_LEGEND, type CartoLayerDef } from "./cartoLayers";
import {
  discoverGroupValues,
  mergeStaticGroupLegend,
  syncCartoOnMap,
  type CartoGroupItem,
} from "./cartoFilters";

type Props = {
  map: maplibregl.Map | null;
  layerVisible: Record<string, boolean>;
  onLayerVisibleChange: (layerId: string, on: boolean) => void;
};

export default function CartoLegendPanel({
  map,
  layerVisible,
  onLayerVisibleChange,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      CARTO_LAYERS.filter((l) => l.groupField).map((l) => [l.id, false])
    )
  );
  const [groupItems, setGroupItems] = useState<Record<string, CartoGroupItem[]>>({});
  const [visibleGroups, setVisibleGroups] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const def of CARTO_LAYERS) {
      if (def.staticGroupLegend) {
        init[def.id] = new Set(def.staticGroupLegend.map((i) => i.key));
      }
    }
    return init;
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshGroups = useCallback(() => {
    if (!map?.isStyleLoaded()) return;

    const nextItems: Record<string, CartoGroupItem[]> = {};
    for (const def of CARTO_LAYERS) {
      if (!def.groupField) continue;
      const discovered = discoverGroupValues(map, def);
      nextItems[def.id] = mergeStaticGroupLegend(def, discovered);
    }

    setGroupItems((prevItems) => {
      setVisibleGroups((prev) => {
        const next: Record<string, Set<string>> = { ...prev };
        for (const def of CARTO_LAYERS) {
          if (!def.groupField) continue;
          const items = nextItems[def.id] ?? [];
          const layerId = def.id;
          const oldKeys = new Set((prevItems[layerId] ?? []).map((i) => i.key));
          if (!prev[layerId]) {
            const initial = def.staticGroupLegend
              ? def.staticGroupLegend.map((i) => i.key)
              : items.map((i) => i.key);
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
  }, [map]);

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
    syncCartoOnMap(map, layerVisible, visibleGroups);
  }, [map, layerVisible, visibleGroups]);

  const toggleExpanded = (layerId: string) => {
    setExpanded((e) => ({ ...e, [layerId]: !e[layerId] }));
  };

  const toggleGroup = (layerId: string, key: string) => {
    setVisibleGroups((prev) => {
      const set = new Set(prev[layerId] ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, [layerId]: set };
    });
  };

  const toggleAllGroups = (layerId: string, on: boolean, items: CartoGroupItem[]) => {
    setVisibleGroups((prev) => ({
      ...prev,
      [layerId]: on ? new Set(items.map((i) => i.key)) : new Set(),
    }));
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none">
      {!panelOpen && (
        <button
          type="button"
          className="pointer-events-auto px-3 py-2 text-xs font-medium bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 hover:bg-white"
          onClick={() => setPanelOpen(true)}
        >
          Couches
        </button>
      )}

      {panelOpen && (
        <div
          className="pointer-events-auto flex flex-col bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 text-xs overflow-hidden"
          style={{
            width: 280,
            minWidth: 200,
            maxWidth: "min(320px, 90vw)",
            height: 360,
            minHeight: 160,
            maxHeight: "min(50vh, 420px)",
            resize: "both",
          }}
        >
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-gray-200 bg-gray-50/90 shrink-0 cursor-default">
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

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0">
            <div className="space-y-0.5">
              {CARTO_LAYERS.map((def) => {
                const discovered = groupItems[def.id] ?? [];
                const items =
                  discovered.length > 0
                    ? discovered
                    : (def.staticGroupLegend?.map((s) => ({
                        key: s.key,
                        label: s.label,
                        color: s.color,
                        count: 0,
                      })) ?? []);
                return (
                <LayerRow
                  key={def.id}
                  def={def}
                  layerOn={!!layerVisible[def.id]}
                  expanded={!!expanded[def.id]}
                  items={items}
                  activeKeys={visibleGroups[def.id]}
                  onLayerChange={(on) => onLayerVisibleChange(def.id, on)}
                  onToggleExpand={() => toggleExpanded(def.id)}
                  onToggleGroup={(key) => toggleGroup(def.id, key)}
                  onToggleAllGroups={(on) => toggleAllGroups(def.id, on, items)}
                />
                );
              })}
            </div>

            {layerVisible.zonage && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-[10px] font-medium text-gray-500 uppercase mb-1">
                  Zonage PLU
                </div>
                <div className="space-y-0.5">
                  {ZONAGE_LEGEND.map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ background: l.color }}
                      />
                      <span className="text-[11px] text-gray-700 truncate">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LayerRow({
  def,
  layerOn,
  expanded,
  items,
  activeKeys,
  onLayerChange,
  onToggleExpand,
  onToggleGroup,
  onToggleAllGroups,
}: {
  def: CartoLayerDef;
  layerOn: boolean;
  expanded: boolean;
  items: CartoGroupItem[];
  activeKeys?: Set<string>;
  onLayerChange: (on: boolean) => void;
  onToggleExpand: () => void;
  onToggleGroup: (key: string) => void;
  onToggleAllGroups: (on: boolean) => void;
}) {
  const hasSub = !!def.groupField;
  const groupsReady = activeKeys !== undefined || !!def.staticGroupLegend;

  return (
    <div className="border-b border-gray-100 last:border-0 pb-1 last:pb-0">
      <div className="flex items-center gap-0.5 min-w-0">
        {hasSub ? (
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 shrink-0 text-[10px]"
            aria-expanded={expanded}
            onClick={onToggleExpand}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <label className="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0 py-0.5">
          <input
            type="checkbox"
            className="shrink-0"
            checked={layerOn}
            onChange={(e) => onLayerChange(e.target.checked)}
          />
          <span
            className={`truncate text-[11px] ${layerOn ? "text-gray-900" : "text-gray-400"}`}
            title={def.title}
          >
            {def.title}
          </span>
        </label>
      </div>

      {hasSub && expanded && layerOn && (
        <div className="ml-4 mt-0.5 mb-1 border-l border-gray-200 pl-1.5 max-h-32 overflow-y-auto">
          {!groupsReady || (!def.staticGroupLegend && items.length === 0) ? (
            <p className="text-[10px] text-gray-400 italic py-0.5">Chargement…</p>
          ) : (
            <>
              <div className="flex gap-2 text-[10px] text-gray-500 mb-0.5 sticky top-0 bg-white/95">
                <button type="button" className="underline" onClick={() => onToggleAllGroups(true)}>
                  tout
                </button>
                <button type="button" className="underline" onClick={() => onToggleAllGroups(false)}>
                  aucun
                </button>
              </div>
              {items.map((item) => {
                const on = activeKeys?.has(item.key) ?? true;
                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-1.5 cursor-pointer py-0.5 min-w-0 ${on ? "" : "opacity-40"}`}
                  >
                    <input
                      type="checkbox"
                      className="shrink-0"
                      checked={on}
                      onChange={() => onToggleGroup(item.key)}
                    />
                    <span
                      className="inline-block w-2 h-2 rounded-sm shrink-0 border border-black/10"
                      style={{ background: item.color }}
                    />
                    <span
                      className="flex-1 truncate text-[10px] leading-tight"
                      title={item.label ?? item.key}
                    >
                      {item.label ?? item.key}
                    </span>
                    <span className="text-gray-400 tabular-nums text-[10px] shrink-0">
                      {item.count}
                    </span>
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

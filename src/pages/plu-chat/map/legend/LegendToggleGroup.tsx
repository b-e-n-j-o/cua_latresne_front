import type { LegendGroup } from "../types";

type Props = {
  groups: LegendGroup[];
  visible: Set<string>;
  onToggle: (key: string) => void;
  showCount?: boolean;
};

export default function LegendToggleGroup({
  groups,
  visible,
  onToggle,
  showCount = true,
}: Props) {
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((g) => {
        const on = visible.has(g.key);
        return (
          <button
            key={g.key}
            type="button"
            className={`plu-map-panel__legend-item${on ? "" : " plu-map-panel__legend-item--off"}`}
            onClick={() => onToggle(g.key)}
            title={g.label}
          >
            <span
              className="plu-map-panel__legend-dot"
              style={{ background: g.color, opacity: on ? 1 : 0.35 }}
            />
            <span className="plu-map-panel__legend-code">{g.label}</span>
            {showCount && (
              <span className="plu-map-panel__legend-pct">{g.count}</span>
            )}
          </button>
        );
      })}
    </>
  );
}

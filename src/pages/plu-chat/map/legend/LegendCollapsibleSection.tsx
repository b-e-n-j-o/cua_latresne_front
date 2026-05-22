import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  /** Nombre d'éléments (affiché à droite du titre) */
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function LegendCollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`plu-map-panel__legend-block${open ? " plu-map-panel__legend-block--open" : ""}`}>
      <button
        type="button"
        className="plu-map-panel__legend-section-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`legend-section-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <span
          className={`plu-map-panel__legend-chevron${open ? " plu-map-panel__legend-chevron--open" : ""}`}
          aria-hidden
        />
        <span className="plu-map-panel__legend-section-title">{title}</span>
        {count != null && count > 0 && (
          <span className="plu-map-panel__legend-section-count">{count}</span>
        )}
      </button>
      {open && (
        <div
          id={`legend-section-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="plu-map-panel__legend-section-body"
        >
          {children}
        </div>
      )}
    </div>
  );
}

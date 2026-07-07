import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./RightSidebarPatch.css";

export type RightSidebarPatchProps = {
  isOpen: boolean;
  onToggle: () => void;
  /** Légende des couches (CartoLegendPanel embedded) */
  legend?: ReactNode;
};

/** Barre droite : légende des couches uniquement (affichable / masquable). */
export default function RightSidebarPatch({ isOpen, onToggle, legend }: RightSidebarPatchProps) {
  if (!legend) return null;

  return (
    <aside
      className={`right-sidebar-patch${isOpen ? "" : " right-sidebar-patch--collapsed"}`}
      aria-label="Légende des couches"
    >
      <button
        type="button"
        className="right-sidebar-patch__toggle"
        onClick={onToggle}
        aria-label={isOpen ? "Masquer la légende" : "Afficher la légende"}
        aria-expanded={isOpen}
      >
        {isOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {isOpen && (
        <div className="right-sidebar-patch__inner">
          <section className="right-sidebar-patch__legend" aria-label="Légende des couches">
            <h3 className="right-sidebar-patch__legend-title">Légende des couches</h3>
            <div className="right-sidebar-patch__legend-body">{legend}</div>
          </section>
        </div>
      )}
    </aside>
  );
}

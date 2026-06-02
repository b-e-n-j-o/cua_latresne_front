import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import CartoHistoryPanel, { type CartoHistoryPanelProps } from "../right-sidebar/CartoHistoryPanel";
import "./CartoLeftSidebar.css";

export type CartoToolSection = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  fallback?: ReactNode;
};

type CartoLeftSidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
  toolSections: CartoToolSection[];
  history: CartoHistoryPanelProps;
  newCuTitle?: string;
  defaultNewCuOpen?: boolean;
  defaultHistoryOpen?: boolean;
};

function LeftSidebarBlock({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="carto-left-sidebar__block">
      <button
        type="button"
        className="carto-left-sidebar__block-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open ? <div className="carto-left-sidebar__block-body">{children}</div> : null}
    </section>
  );
}

function ToolSection({
  title,
  children,
  defaultOpen = false,
  icon,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border border-gray-200 rounded-md overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-semibold text-gray-700"
      >
        <div className="flex items-center gap-2">
          {icon ? <span className="text-gray-500">{icon}</span> : null}
          <span>{title}</span>
        </div>
        <span className="text-gray-400">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open ? <div className="p-3 bg-white">{children}</div> : null}
    </section>
  );
}

export default function CartoLeftSidebar({
  isOpen,
  onToggle,
  toolSections,
  history,
  newCuTitle = "Nouveau Certificat d'Urbanisme",
  defaultNewCuOpen = false,
  defaultHistoryOpen = false,
}: CartoLeftSidebarProps) {
  return (
    <aside
      className={`carto-left-sidebar${isOpen ? "" : " carto-left-sidebar--collapsed"}`}
      aria-label="Outils et historique"
    >
      <button
        type="button"
        className="carto-left-sidebar__toggle"
        onClick={onToggle}
        aria-label={isOpen ? "Masquer le panneau gauche" : "Afficher le panneau gauche"}
        aria-expanded={isOpen}
      >
        {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {isOpen ? (
        <div className="carto-left-sidebar__inner">
          <div className="carto-left-sidebar__scroll">
            <LeftSidebarBlock title={newCuTitle} defaultOpen={defaultNewCuOpen}>
              <div className="carto-left-sidebar__tools">
                {toolSections.length === 0 ? (
                  <p className="text-xs text-gray-500 italic text-center py-4">Aucun outil disponible</p>
                ) : (
                  toolSections.map((section) => (
                    <ToolSection
                      key={section.id}
                      title={section.title}
                      defaultOpen={section.defaultOpen}
                      icon={section.icon}
                    >
                      {section.content ?? section.fallback ?? (
                        <p className="text-xs text-gray-500 italic text-center py-4">
                          Contenu indisponible
                        </p>
                      )}
                    </ToolSection>
                  ))
                )}
              </div>
            </LeftSidebarBlock>

            <LeftSidebarBlock title="Historique" defaultOpen={defaultHistoryOpen}>
              <div className="carto-left-sidebar__history">
                <CartoHistoryPanel {...history} variant="left" />
              </div>
            </LeftSidebarBlock>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export type { CartoHistoryPanelProps };

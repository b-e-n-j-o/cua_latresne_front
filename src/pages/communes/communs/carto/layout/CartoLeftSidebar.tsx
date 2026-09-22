import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, Clock, MapPin, Search } from "lucide-react";
import CartoHistoryPanel, { type CartoHistoryPanelProps } from "./CartoHistoryPanel";
import "./CartoLeftSidebar.css";

export type CartoToolSection = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  fallback?: ReactNode;
};

export type CartoSidebarBlock = {
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
};

type CartoLeftSidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
  toolSections: CartoToolSection[];
  history: CartoHistoryPanelProps;
  /** Bloc séparé (ex. caractéristiques parcelle), entre CUA et historique. */
  parcelleBlock?: CartoSidebarBlock | null;
  /** Recherche parcelle, au-dessus du bloc « Nouveau CU ». */
  searchBlock?: CartoSidebarBlock | null;
  newCuTitle?: string;
  defaultNewCuOpen?: boolean;
  defaultParcelleOpen?: boolean;
  /** Historique ouvert par défaut (liste des dossiers en bas de sidebar). */
  defaultHistoryOpen?: boolean;
  /** Blocs additionnels entre parcelle et historique (ex. suivi dossier). */
  extraBlocks?: CartoSidebarBlock[];
  /** Intitulé du panneau historique épinglé en bas. */
  historyTitle?: string;
};

function LeftSidebarBlock({
  title,
  defaultOpen = false,
  children,
  tone = "default",
  icon,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  tone?: "search" | "parcelle" | "default";
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`carto-left-sidebar__block carto-left-sidebar__block--${tone}`}>
      <button
        type="button"
        className="carto-left-sidebar__block-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="carto-left-sidebar__block-trigger-label">
          {icon ? <span className="carto-left-sidebar__block-icon">{icon}</span> : null}
          <span className="carto-left-sidebar__block-title">{title}</span>
        </span>
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
    <section className="carto-left-sidebar__tool-section">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="carto-left-sidebar__tool-section-trigger"
      >
        <div className="flex items-center gap-2">
          {icon ? <span>{icon}</span> : null}
          <span>{title}</span>
        </div>
        <span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open ? <div className="carto-left-sidebar__tool-section-body">{children}</div> : null}
    </section>
  );
}

export default function CartoLeftSidebar({
  isOpen,
  onToggle,
  toolSections,
  history,
  parcelleBlock = null,
  searchBlock = null,
  newCuTitle = "Nouveau Certificat d'Urbanisme",
  defaultNewCuOpen = false,
  defaultParcelleOpen = true,
  defaultHistoryOpen = true,
  extraBlocks = [],
  historyTitle = "Historique des dossiers",
}: CartoLeftSidebarProps) {
  const [historyOpen, setHistoryOpen] = useState(defaultHistoryOpen);

  useEffect(() => {
    if (history.selectedSlug || history.selectedIdentiteProjectId) {
      setHistoryOpen(true);
    }
  }, [history.selectedSlug, history.selectedIdentiteProjectId]);

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          className="carto-left-sidebar__expand"
          onClick={onToggle}
          aria-label="Afficher le panneau gauche"
          title="Afficher le panneau"
        >
          <ChevronRight size={18} />
        </button>
      ) : null}

      <aside
        className={`carto-left-sidebar${isOpen ? "" : " carto-left-sidebar--collapsed"}`}
        aria-label="Outils et historique"
      >
        {isOpen ? (
        <div className="carto-left-sidebar__inner">
          <div className="carto-left-sidebar__header">
            <button
              type="button"
              className="carto-left-sidebar__header-toggle"
              onClick={onToggle}
              aria-label="Replier le panneau gauche"
              title="Replier"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
          <div className="carto-left-sidebar__scroll">
            {searchBlock ? (
              <LeftSidebarBlock
                title={searchBlock.title}
                defaultOpen={searchBlock.defaultOpen ?? true}
                tone="search"
                icon={<Search size={15} aria-hidden />}
              >
                <div className="carto-left-sidebar__search">{searchBlock.content}</div>
              </LeftSidebarBlock>
            ) : null}

            {toolSections.length > 0 ? (
              <LeftSidebarBlock title={newCuTitle} defaultOpen={defaultNewCuOpen}>
                <div className="carto-left-sidebar__tools">
                  {toolSections.map((section) => (
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
                  ))}
                </div>
              </LeftSidebarBlock>
            ) : null}

            {parcelleBlock ? (
              <LeftSidebarBlock
                title={parcelleBlock.title}
                defaultOpen={parcelleBlock.defaultOpen ?? defaultParcelleOpen}
                tone="parcelle"
                icon={<MapPin size={15} aria-hidden />}
              >
                <div className="carto-left-sidebar__parcelle">{parcelleBlock.content}</div>
              </LeftSidebarBlock>
            ) : null}

            {extraBlocks.map((block) => (
              <LeftSidebarBlock
                key={block.title}
                title={block.title}
                defaultOpen={block.defaultOpen ?? true}
              >
                {block.content}
              </LeftSidebarBlock>
            ))}

            <div className="carto-left-sidebar__history-split" aria-hidden="true">
              <span>Dossiers générés</span>
            </div>

            <section
              className={`carto-left-sidebar__history-pinned${historyOpen ? " carto-left-sidebar__history-pinned--open" : " carto-left-sidebar__history-pinned--collapsed"}`}
              aria-label={historyTitle}
            >
              <button
                type="button"
                className="carto-left-sidebar__history-pinned-trigger"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
              >
                <span className="carto-left-sidebar__history-pinned-trigger-label">
                  <Clock size={14} aria-hidden />
                  <span>
                    {historyTitle}
                    {history.rows.length > 0 ? (
                      <span className="carto-left-sidebar__history-count"> {history.rows.length}</span>
                    ) : null}
                  </span>
                </span>
                {historyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {historyOpen ? (
                <div className="carto-left-sidebar__history-pinned-body">
                  <CartoHistoryPanel {...history} variant="left" />
                </div>
              ) : null}
            </section>
          </div>
        </div>
        ) : null}
      </aside>
    </>
  );
}

export type { CartoHistoryPanelProps };

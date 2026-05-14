import { SectionLabel } from "./KereliaUi";
import { KERELIA_LOGO_SRC } from "../lib/constants";
import { cn } from "../lib/cn";

type MegaColumn = {
  label: string;
  title: string;
  description: string;
  links: string[];
};

const MEGA_COLUMNS: MegaColumn[] = [
  {
    label: "01 — URBANISME RÉGLEMENTAIRE",
    title: "Documents d'urbanisme",
    description:
      "Certificats d'urbanisme analytiques, cartes d'identité foncières, cartographie réglementaire 2D/3D, veille réglementaire automatisée.",
    links: [
      "Certificats d'Urbanisme (CUa)",
      "Cartes d'Identité Foncières",
      "LiDAR et topographie 3D",
      "Veille réglementaire",
    ],
  },
  {
    label: "02 — ÉTUDES ENVIRONNEMENTALES",
    title: "Pré-études et compensation",
    description:
      "Pré-études foncières, compensation écologique avec SIMETHIS et Eco Compensation, suivi par imagerie satellitaire.",
    links: ["Pré-études foncières", "Compensation écologique", "Hydrologie et bassins versants", "Suivi satellitaire"],
  },
  {
    label: "03 — LOGICIELS MÉTIER",
    title: "Bancarisation ERC",
    description: "Plateforme de suivi technique et financier des engagements ERC, module DREAL, API géospatiales.",
    links: ["Plateforme ERC", "Module supervision DREAL", "API géospatiales"],
  },
  {
    label: "04 — IA & DONNÉES",
    title: "Pipelines et modèles",
    description:
      "Pipelines de traitement géospatial, fine-tuning de modèles de vision, croisement multi-sources, développements sur mesure.",
    links: ["Pipelines géospatiaux", "Vision par ordinateur", "Croisement multi-sources", "Développements sur mesure"],
  },
];

export type KereliaSiteHeaderProps = {
  headerClassName: string;
  menuOpen: boolean;
  onToggleExpertiseMenu: () => void;
  onCloseMenu: () => void;
};

export function KereliaSiteHeader({
  headerClassName,
  menuOpen,
  onToggleExpertiseMenu,
  onCloseMenu,
}: KereliaSiteHeaderProps) {
  return (
    <>
      <header className={headerClassName} id="kh">
        <div className="kh__inner">
          <a href="/" className="kh__brand" aria-label="Kerelia accueil">
            <span className="kh__lockup">
              <img src={KERELIA_LOGO_SRC} alt="" />
            </span>
            <span className="kh__word">KERELIA</span>
          </a>
          <nav className="kh__nav" aria-label="Navigation principale">
            <button
              type="button"
              className="kh__nav-item"
              id="exp-trigger"
              aria-expanded={menuOpen}
              onClick={onToggleExpertiseMenu}
            >
              Expertise
            </button>
            <span className="kh__nav-sep" aria-hidden="true">
              |
            </span>
            <a className="kh__nav-item" href="#methodologie" onClick={onCloseMenu}>
              Urbanisme
            </a>
            <span className="kh__nav-sep" aria-hidden="true">
              |
            </span>
            <a className="kh__nav-item" href="#apropos" onClick={onCloseMenu}>
              Environnement
            </a>
            <span className="kh__nav-sep" aria-hidden="true">
              |
            </span>
            <a className="kh__nav-item" href="#etudes" onClick={onCloseMenu}>
              Projets
            </a>
          </nav>
          <a className="kh__cta" href="/login" onClick={onCloseMenu}>
            Identification
          </a>
          <button type="button" className="kh__close" id="exp-close" aria-label="Fermer" onClick={onCloseMenu}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
            </svg>
          </button>
          <button
            type="button"
            className="kh__burger"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            onClick={onToggleExpertiseMenu}
          >
            <svg viewBox="0 0 16 12" fill="none" aria-hidden="true">
              <path d="M0 1 H16 M0 6 H16 M0 11 H16" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      </header>

      <div className={cn("kmenu", menuOpen && "is-open")} id="kmenu" aria-hidden={!menuOpen}>
        <div className="kmenu__inner">
          {MEGA_COLUMNS.map((col) => (
            <div key={col.label}>
              <div className="kmenu__col-label">
                <SectionLabel variant="yellow">{col.label}</SectionLabel>
              </div>
              <h3 className="kmenu__col-title">{col.title}</h3>
              <p className="kmenu__col-desc">{col.description}</p>
              <ul className="kmenu__sublinks">
                {col.links.map((linkLabel) => (
                  <li key={linkLabel}>
                    <a href="#expertise" onClick={onCloseMenu}>
                      {linkLabel}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <nav className="kmenu__mobile-quick" aria-label="Navigation">
            <a className="kmenu__mobile-quick-link" href="#methodologie" onClick={onCloseMenu}>
              Méthodologie
            </a>
            <a className="kmenu__mobile-quick-link" href="#equipe" onClick={onCloseMenu}>
              Équipe
            </a>
            <a className="kmenu__mobile-quick-link" href="#etudes" onClick={onCloseMenu}>
              Projets
            </a>
            <a className="kmenu__mobile-quick-link" href="#contact" onClick={onCloseMenu}>
              Contact
            </a>
            <a
              className="kmenu__mobile-quick-link kmenu__mobile-quick-link--ident"
              href="/login"
              onClick={onCloseMenu}
            >
              Identification
            </a>
          </nav>
        </div>
      </div>
    </>
  );
}

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KERELIA_LOGO_SRC } from "../lib/constants";
import { cn } from "../lib/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
};

type NavSection = {
  id: string;
  label: string;
  sectionLabel: string;
  items: NavItem[];
};

// ─── Données nav ──────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    id: "urbanisme",
    label: "Urbanisme réglementaire",
    sectionLabel: "01 — URBANISME RÉGLEMENTAIRE",
    items: [
      { label: "Certificat d'urbanisme (CUa)", href: "/urbanisme/certificats-durbanisme" },
      { label: "Carte d'identité foncière (CIF)", href: "/urbanisme/carte-didentite-fonciere" },
      { label: "Veille réglementaire", href: "/urbanisme/veille-reglementaire" },
    ],
  },
  {
    id: "environnement",
    label: "Environnement",
    sectionLabel: "02 — ÉTUDES ENVIRONNEMENTALES",
    items: [
      { label: "Pré-études environnementales", href: "/environnement/etudes-environnementales" },
      { label: "Bancarisation et suivi ERC", href: "/environnement/bancarisation-suivi-erc" },
      { label: "Recherche foncière de compensation", href: "/environnement/scoring-compensation-ecologique" },
    ],
  },
  {
    id: "outils",
    label: "Ingénierie SIG",
    sectionLabel: "03 — OUTILS & DATA SIG",
    items: [
      { label: "Base de données géospatiales", href: "/outils/base-de-donnees-sig" },
      { label: "Outils SIG", href: "/outils/outils-pilotage-sig" },
      { label: "Visualisation MNT / LiDAR", href: "/outils/visualisation-mnt-lidar" },
    ],
  },
];

// ─── Composant flèche ─────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
      style={{
        width: 10,
        height: 6,
        marginLeft: 5,
        transition: "transform 0.2s ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    >
      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Dropdown d'une rubrique ───────────────────────────────────────────────────

type NavDropdownProps = {
  section: NavSection;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAfterNavigate?: () => void;
};

function NavDropdown({ section, isOpen, onToggle, onClose, onAfterNavigate }: NavDropdownProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  const handleItemClick = (href: string) => {
    onClose();
    onAfterNavigate?.();
    navigate(href);
  };

  return (
    <div className="kh__dropdown-wrap" ref={ref}>
      <button
        type="button"
        className={cn("kh__nav-item kh__nav-item--dropdown", isOpen && "is-active")}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        {section.label}
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div className="kh__dropdown" role="menu">
          <ul className="kh__dropdown-list" aria-label={section.sectionLabel}>
            {section.items.map((item) => (
              <li key={item.href}>
                <button
                  type="button"
                  role="menuitem"
                  className="kh__dropdown-item"
                  onClick={() => handleItemClick(item.href)}
                >
                  {item.label}
                  <svg viewBox="0 0 8 8" fill="none" aria-hidden="true" className="kh__dropdown-item-arrow">
                    <path
                      d="M1 7L7 1M7 1H2M7 1V6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Props header ─────────────────────────────────────────────────────────────

export type KereliaSiteHeaderProps = {
  headerClassName: string;
};

// ─── Header principal ─────────────────────────────────────────────────────────

export function KereliaSiteHeader({ headerClassName }: KereliaSiteHeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeDropdown = useCallback(() => setActiveDropdown(null), []);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
    setActiveDropdown(null);
  }, []);

  const toggleDropdown = useCallback((id: string) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  }, []);

  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) setActiveDropdown(null);
  }, [mobileNavOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeDropdown();
      setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeDropdown]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        closeMobileNav();
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [mobileNavOpen, closeMobileNav]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 834px)");
    const onChange = () => {
      if (mq.matches) closeMobileNav();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [closeMobileNav]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 833px)");
    const sync = () => {
      if (!mq.matches || !mobileNavOpen) {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        return;
      }
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    <header ref={headerRef} className={cn(headerClassName, mobileNavOpen && "is-mobile-nav-open")} id="kh">
      <div className="kh__inner">
        <a href="/" className="kh__brand" aria-label="Kerelia accueil">
          <span className="kh__lockup">
            <img src={KERELIA_LOGO_SRC} alt="" />
          </span>
          <span className="kh__word">KERELIA</span>
        </a>

        <nav id="kh-main-nav" className="kh__nav" aria-label="Navigation principale">
          {NAV_SECTIONS.map((section, i) => (
            <Fragment key={section.id}>
              {i > 0 && (
                <span className="kh__nav-sep" aria-hidden="true">
                  |
                </span>
              )}
              <NavDropdown
                section={section}
                isOpen={activeDropdown === section.id}
                onToggle={() => toggleDropdown(section.id)}
                onClose={closeDropdown}
                onAfterNavigate={closeMobileNav}
              />
            </Fragment>
          ))}
          <a
            className="kh__nav-mobile-login"
            href="/login"
            onClick={closeMobileNav}
            aria-label="Se connecter"
          >
            Se connecter
          </a>
        </nav>

        <a className="kh__cta kh__cta--login" href="/login" aria-label="Se connecter">
          Se connecter
        </a>

        <button
          type="button"
          className="kh__burger"
          aria-label={mobileNavOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileNavOpen}
          aria-controls="kh-main-nav"
          onClick={toggleMobileNav}
        >
          {mobileNavOpen ? (
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 12" fill="none" aria-hidden="true">
              <path d="M0 1 H16 M0 6 H16 M0 11 H16" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

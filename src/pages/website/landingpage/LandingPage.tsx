import { useEffect, useState } from "react";
import Lenis from "lenis";
import type { LenisOptions } from "lenis";
import "lenis/dist/lenis.css";
import kereliaLandingCss from "./kereliaLandingPage.css?raw";
import { useInViewOnce } from "./hooks/useInViewOnce";
import { cn } from "./lib/cn";
import {
  AboutSection,
  ContactCtaSection,
  EtudesSection,
  ExpertiseSection,
  HeroSection,
  MethodologySection,
  SiteFooterSection,
  SourcesStripSection,
  StatsSection,
} from "./landingPageSections";
import { KereliaSiteHeader } from "./components/KereliaSiteHeader";

/** Lenis — uniquement sur cette page : ajuste ces valeurs au feeling voulu */
const LANDING_LENIS_OPTIONS: LenisOptions = {
  duration: 1.2,
  lerp: 0.1,
  wheelMultiplier: 1,
  touchMultiplier: 1,
  smoothWheel: true,
  syncTouch: false,
  syncTouchLerp: 0.075,
  anchors: false,
};

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [headerOverLight, setHeaderOverLight] = useState(false);

  const { ref: statsSectionRef, visible: statsVisible } = useInViewOnce<HTMLElement>();
  const { ref: methodStepsRef, visible: methodVisible } = useInViewOnce<HTMLDivElement>();

  useEffect(() => {
    const id = "kerelia-landing-injected-styles";
    const el = document.createElement("style");
    el.id = id;
    el.textContent = kereliaLandingCss;
    document.head.appendChild(el);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Kerelia — Cabinet d'expertise géospatiale";
    return () => {
      document.title = prev;
    };
  }, []);

  /**
   * Évite le `scroll-behavior: smooth` CSS (index / kereliaLandingPage) en parallèle de Lenis,
   * qui pilote le lissage sur cette page uniquement.
   */
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    return () => {
      html.style.scrollBehavior = prev;
    };
  }, []);

  useEffect(() => {
    const lenis = new Lenis(LANDING_LENIS_OPTIONS);
    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    let rafId = 0;

    const updateHeaderMode = () => {
      setHeaderScrolled(window.scrollY > 80);
      const detectionY = 60;
      let isLight = false;
      document.querySelectorAll("section, footer").forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= detectionY && rect.bottom >= detectionY) {
          const bg = section.getAttribute("data-bg");
          const el = section;
          const hasLight =
            el.classList.contains("etudes") ||
            el.classList.contains("section-light") ||
            el.tagName === "FOOTER" ||
            bg === "light" ||
            bg === "yellow";
          if (hasLight) isLight = true;
        }
      });
      setHeaderOverLight(isLight);
    };

    const scheduleHeaderMode = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        updateHeaderMode();
      });
    };

    window.addEventListener("scroll", scheduleHeaderMode, { passive: true });
    window.addEventListener("resize", scheduleHeaderMode, { passive: true });
    updateHeaderMode();
    return () => {
      window.removeEventListener("scroll", scheduleHeaderMode);
      window.removeEventListener("resize", scheduleHeaderMode);
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /** Sur mobile le menu est en overlay plein largeur : on bloque le scroll arrière-plan. */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 833px)");
    const sync = () => {
      if (!mq.matches || !menuOpen) {
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
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((o) => !o);

  const headerClassName = cn(
    "kh",
    menuOpen && "is-menu-open",
    headerScrolled && "is-scrolled",
    headerOverLight && "kh--dark"
  );

  return (
    <div className="kerelia-landing">
      <KereliaSiteHeader
        headerClassName={headerClassName}
        menuOpen={menuOpen}
        onToggleExpertiseMenu={toggleMenu}
        onCloseMenu={closeMenu}
      />

      <main id="main" className={menuOpen ? "is-pushed" : undefined}>
        <HeroSection />
        <StatsSection sectionRef={statsSectionRef} statsVisible={statsVisible} />
        <SourcesStripSection />
        <EtudesSection />
        <ExpertiseSection />
        <MethodologySection stepsRef={methodStepsRef} methodVisible={methodVisible} />
        <AboutSection />
        <ContactCtaSection />
        <SiteFooterSection />
      </main>
    </div>
  );
}

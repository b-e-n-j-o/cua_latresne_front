import { useEffect, useState } from "react";
import "lenis/dist/lenis.css";
import kereliaLandingCss from "./kereliaLandingPage.css?raw";
import { useInViewOnce } from "./hooks/useInViewOnce";
import { useLandingLenis } from "./hooks/useLandingLenis";
import { cn } from "./lib/cn";
import {
  AboutSection,
  ContactCtaSection,
  DomainesInterventionSection,
  EtudesSection,
  HeroSection,
  MethodologySection,
  SiteFooterSection,
  SourcesPartnershipsSection,
} from "./landingPageSections";
import { FloatingDemoCta } from "./components/FloatingDemoCta";
import { KereliaSiteHeader } from "./components/KereliaSiteHeader";

export default function LandingPage() {
  const { lenisRef, lenis } = useLandingLenis();
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [headerOverLight, setHeaderOverLight] = useState(false);

  const { ref: sourcesSectionRef, visible: sourcesVisible } = useInViewOnce<HTMLElement>();
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
    lenis?.on("scroll", scheduleHeaderMode);
    updateHeaderMode();
    return () => {
      window.removeEventListener("scroll", scheduleHeaderMode);
      window.removeEventListener("resize", scheduleHeaderMode);
      lenis?.off("scroll", scheduleHeaderMode);
      cancelAnimationFrame(rafId);
    };
  }, [lenis]);

  const headerClassName = cn(
    "kh",
    headerScrolled && "is-scrolled",
    headerOverLight && "kh--dark"
  );

  return (
    <div className="kerelia-landing">
      <KereliaSiteHeader headerClassName={headerClassName} />
      <FloatingDemoCta />

      <main id="main">
        <HeroSection />
        <SourcesPartnershipsSection sectionRef={sourcesSectionRef} visible={sourcesVisible} />
        <EtudesSection lenisRef={lenisRef} lenis={lenis} />
        <DomainesInterventionSection />
        <MethodologySection stepsRef={methodStepsRef} methodVisible={methodVisible} />
        <AboutSection />
        <ContactCtaSection />
        <SiteFooterSection />
      </main>
    </div>
  );
}

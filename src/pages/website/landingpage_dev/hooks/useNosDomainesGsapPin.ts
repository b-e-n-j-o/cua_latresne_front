import type Lenis from "lenis";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { gsap, ScrollTrigger } from "../lib/lenisScrollTrigger";

const DESKTOP_MQ = "(min-width: 900px)";
/** Distance de scroll vertical dans la zone pinnée. */
const PIN_SCROLL_VH = 3.15;
/** Inertie du défilement horizontal (plus élevé = plus fluide). */
const SCRUB_SMOOTHING = 1.45;
const LENIS_EASE_OUT = (t: number) => 1 - (1 - t) ** 3;
const PANEL_SELECTOR = "[data-pin-panel]";
/**
 * À ce % du scroll pin, la 4e carte est centrée — le reste sert au fondu + reprise verticale.
 */
const HORIZONTAL_COMPLETE_AT = 0.82;
/** Fondu uniquement après la dernière carte au centre (derniers ~12 % du parcours). */
const EXIT_FADE_START = 0.9;

function getCardsViewport(pin: HTMLElement) {
  return pin.querySelector<HTMLElement>(".etudes__viewport");
}

function setCardsViewportOpacity(viewport: HTMLElement | null, alpha: number) {
  if (!viewport) return;
  gsap.set(viewport, { autoAlpha: alpha });
}

type UseNosDomainesGsapPinArgs = {
  lenis: Lenis | null;
  panelCount: number;
  enabled?: boolean;
};

function measureTrackX(track: HTMLElement) {
  const panels = track.querySelectorAll<HTMLElement>(PANEL_SELECTOR);
  if (!panels.length) return { startX: 0, endX: 0 };

  const styles = getComputedStyle(track);
  const gap = parseFloat(styles.columnGap || styles.gap || "0") || 24;
  const panelW = panels[0].offsetWidth;
  const center = (window.innerWidth - panelW) / 2;
  const endX =
    panels.length <= 1 ? center : center - (panels.length - 1) * (panelW + gap);

  return { startX: center, endX };
}

export function useNosDomainesGsapPin({
  lenis,
  panelCount,
  enabled = true,
}: UseNosDomainesGsapPinArgs) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);
  const scrollDriverRef = useRef<ReturnType<typeof gsap.to> | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches
  );

  const scrollToProgress = useCallback(
    (progress: number, immediate = false) => {
      const st = scrollTriggerRef.current;
      if (!st || !lenis) return;
      const y = st.start + progress * (st.end - st.start);
      lenis.scrollTo(y, {
        immediate,
        duration: immediate ? undefined : 1.65,
        easing: LENIS_EASE_OUT,
      });
    },
    [lenis]
  );

  const goToPanel = useCallback(
    (index: number) => {
      const max = Math.max(0, panelCount - 1);
      const clamped = Math.max(0, Math.min(max, index));
      const panelProgress = max === 0 ? 0 : clamped / max;
      const scrollProgress = panelProgress * HORIZONTAL_COMPLETE_AT;
      scrollToProgress(scrollProgress);
    },
    [panelCount, scrollToProgress]
  );

  const skipToTarget = useCallback(
    (targetId: string) => {
      const target = document.getElementById(targetId);
      if (target && lenis) {
        lenis.scrollTo(target, {
          offset: 0,
          duration: 1.85,
          easing: LENIS_EASE_OUT,
        });
        return;
      }
      target?.scrollIntoView({ behavior: "smooth" });
    },
    [lenis]
  );

  useEffect(() => {
    if (!enabled || !lenis || panelCount < 1) return;

    const section = sectionRef.current;
    const pin = pinRef.current;
    const track = trackRef.current;
    if (!section || !pin || !track) return;

    const mq = window.matchMedia(DESKTOP_MQ);

    const killTimeline = () => {
      scrollDriverRef.current?.kill();
      scrollDriverRef.current = null;
      scrollTriggerRef.current?.kill();
      scrollTriggerRef.current = null;
    };

    const build = () => {
      killTimeline();
      if (!mq.matches) {
        gsap.set(track, { clearProps: "transform" });
        return;
      }

      const { startX, endX } = measureTrackX(track);
      gsap.set(track, { x: startX });

      const max = Math.max(0, panelCount - 1);
      const snap =
        max > 0
          ? {
              snapTo: (scrollProgress: number) => {
                const hProgress = Math.min(1, scrollProgress / HORIZONTAL_COMPLETE_AT);
                const panelProgress = Math.round(hProgress * max) / max;
                return panelProgress * HORIZONTAL_COMPLETE_AT;
              },
              duration: { min: 0.38, max: 0.82 },
              delay: 0.12,
              ease: "power3.inOut",
            }
          : false;

      const applyHorizontalScroll = (scrollProgress: number) => {
        const hProgress = Math.min(1, scrollProgress / HORIZONTAL_COMPLETE_AT);
        const x = startX + hProgress * (endX - startX);
        gsap.set(track, { x });
        const idx = max === 0 ? 0 : Math.round(hProgress * max);
        setActiveIndex(idx);
      };

      const viewport = getCardsViewport(pin);

      const resetCardsFade = () => {
        setCardsViewportOpacity(viewport, 1);
      };

      const updateCardsExitFade = (progress: number) => {
        if (!viewport) return;
        if (progress <= EXIT_FADE_START) {
          setCardsViewportOpacity(viewport, 1);
          return;
        }
        const t = (progress - EXIT_FADE_START) / (1 - EXIT_FADE_START);
        setCardsViewportOpacity(viewport, 1 - Math.min(1, t));
      };

      const softenPinEnter = () => {
        resetCardsFade();
        gsap.fromTo(
          pin,
          { y: 28, autoAlpha: 0.9 },
          { y: 0, autoAlpha: 1, duration: 0.72, ease: "power3.out", overwrite: "auto" }
        );
        if (viewport) {
          gsap.fromTo(
            viewport,
            { autoAlpha: 0.35 },
            { autoAlpha: 1, duration: 0.55, ease: "power2.out", overwrite: "auto" },
            0.12
          );
        }
      };

      const softenPinExit = () => {
        gsap.killTweensOf([pin, viewport]);
        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut", overwrite: "auto" },
          onComplete: () => {
            gsap.set([pin, viewport], { clearProps: "transform,opacity,visibility" });
          },
        });
        if (viewport) {
          tl.to(viewport, { autoAlpha: 0, duration: 0.5 }, 0);
        }
        tl.to(pin, { y: -8, duration: 0.45 }, 0);
      };

      const driver = { progress: 0 };

      scrollDriverRef.current = gsap.to(driver, {
        progress: 1,
        ease: "none",
        onUpdate: () => {
          applyHorizontalScroll(driver.progress);
          updateCardsExitFade(driver.progress);
        },
      });

      scrollTriggerRef.current = ScrollTrigger.create({
        id: "nos-domaines-horizontal",
        trigger: section,
        pin,
        pinSpacing: true,
        pinType: "transform",
        anticipatePin: 2.1,
        fastScrollEnd: false,
        start: "top top",
        end: () => `+=${window.innerHeight * PIN_SCROLL_VH}`,
        animation: scrollDriverRef.current,
        scrub: SCRUB_SMOOTHING,
        snap,
        invalidateOnRefresh: true,
        onEnter: softenPinEnter,
        onEnterBack: softenPinEnter,
        onLeave: softenPinExit,
        onLeaveBack: () => {
          resetCardsFade();
          gsap.set(pin, { clearProps: "transform,opacity,visibility" });
        },
      });

      gsap.set(pin, { autoAlpha: 1, y: 0 });
      gsap.set(track, { x: startX });
      resetCardsFade();
      driver.progress = 0;
      applyHorizontalScroll(0);
    };

    build();

    const onResize = () => {
      measureTrackX(track);
      ScrollTrigger.refresh();
    };

    const onMqChange = () => {
      setIsDesktop(mq.matches);
      build();
      ScrollTrigger.refresh();
    };

    mq.addEventListener("change", onMqChange);
    window.addEventListener("resize", onResize);

    const refreshId = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(refreshId);
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("resize", onResize);
      killTimeline();
    };
  }, [enabled, lenis, panelCount]);

  useEffect(() => {
    if (!enabled || !isDesktop || panelCount < 2) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const st = scrollTriggerRef.current;
      if (!st || !st.isActive) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToPanel(activeIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPanel(activeIndex - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, enabled, goToPanel, isDesktop, panelCount]);

  return {
    sectionRef,
    pinRef,
    trackRef,
    activeIndex,
    isDesktop,
    goToPanel,
    skipToTarget,
  };
}

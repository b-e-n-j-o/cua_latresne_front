import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import type { LenisOptions } from "lenis";
import { bindLenisScrollTrigger, unbindLenisScrollTrigger } from "../lib/lenisScrollTrigger";

export const LANDING_LENIS_OPTIONS: LenisOptions = {
  duration: 1.55,
  lerp: 0.078,
  wheelMultiplier: 0.92,
  touchMultiplier: 1,
  smoothWheel: true,
  syncTouch: false,
  syncTouchLerp: 0.075,
  anchors: false,
};

/** Lenis + ScrollTrigger sur la landing. */
export function useLandingLenis(options: LenisOptions = LANDING_LENIS_OPTIONS) {
  const lenisRef = useRef<Lenis | null>(null);
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const instance = new Lenis(options);
    lenisRef.current = instance;
    setLenis(instance);
    bindLenisScrollTrigger(instance);

    return () => {
      unbindLenisScrollTrigger(instance);
      instance.destroy();
      lenisRef.current = null;
      setLenis(null);
    };
  }, [options]);

  return { lenisRef, lenis };
}

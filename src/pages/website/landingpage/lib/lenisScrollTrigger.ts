import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

let lenisTickerFn: ((time: number) => void) | null = null;

/** Lie Lenis et ScrollTrigger (ticker GSAP + scrollerProxy). */
export function bindLenisScrollTrigger(lenis: Lenis) {
  lenis.on("scroll", ScrollTrigger.update);

  if (lenisTickerFn) {
    gsap.ticker.remove(lenisTickerFn);
  }
  lenisTickerFn = (time) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(lenisTickerFn);
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.scrollerProxy(document.documentElement, {
    scrollTop(value) {
      if (arguments.length) {
        lenis.scrollTo(value, { immediate: true });
      }
      return lenis.scroll;
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },
  });

  ScrollTrigger.addEventListener("refresh", () => lenis.resize());
}

export function unbindLenisScrollTrigger(lenis: Lenis) {
  lenis.off("scroll", ScrollTrigger.update);
  if (lenisTickerFn) {
    gsap.ticker.remove(lenisTickerFn);
    lenisTickerFn = null;
  }
  ScrollTrigger.scrollerProxy(document.documentElement, {});
  ScrollTrigger.getAll().forEach((t) => t.kill());
  ScrollTrigger.clearScrollMemory();
}

export { gsap, ScrollTrigger };

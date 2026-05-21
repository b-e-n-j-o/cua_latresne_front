/**
 * FranceMap.tsx
 * Lazy-load des frames déclenché par IntersectionObserver.
 * Les images ne sont téléchargées que quand la section approche du viewport.
 */
import { useEffect, useRef, useState } from "react";

const TOTAL_FRAMES      = 12;
const FRAME_DURATION_MS = 1200;
const PAUSE_ON_LAST_MS  = 1500;

const frames = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => `/images/france-map-frames/frame-${String(i).padStart(2, "0")}.png`
);

function preloadAll(srcs: string[]): Promise<void> {
  return Promise.all(
    srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload  = () => img.decode().then(resolve).catch(resolve);
          img.onerror = () => resolve();
          img.src = src;
        })
    )
  ).then(() => undefined);
}

export default function FranceMap() {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Démarre le preload seulement quand la section approche du viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        preloadAll(frames).then(() => {
          if (!cancelled) setReady(true);
        });
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  // Animation — démarre seulement quand ready
  useEffect(() => {
    if (!ready) return;
    const isLast = currentFrame === TOTAL_FRAMES - 1;
    const id = setTimeout(() => {
      setCurrentFrame((f) => (f + 1) % TOTAL_FRAMES);
    }, isLast ? PAUSE_ON_LAST_MS : FRAME_DURATION_MS);
    return () => clearTimeout(id);
  }, [currentFrame, ready]);

  return (
    <div className="about__map" ref={containerRef} style={{ position: "relative" }}>
      {frames.map((src, i) => (
        <img
          key={src}
          className="about__map-img"
          src={ready ? src : i === 0 ? src : undefined}
          alt={i === 0 ? "Expansion Kerelia — de la Nouvelle-Aquitaine à la couverture nationale" : ""}
          aria-hidden={i !== 0}
          width={480}
          height={520}
          decoding="async"
          style={{
            position: i === 0 ? "relative" : "absolute",
            top: 0,
            left: 0,
            opacity: ready && i === currentFrame ? 1 : i === 0 && !ready ? 1 : 0,
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />
      ))}
    </div>
  );
}
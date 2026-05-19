/**
 * FranceMap.tsx
 * Attend que toutes les frames soient décodées avant de démarrer l'animation.
 * Zéro saccade dès la première boucle.
 */
import { useEffect, useState } from "react";

const TOTAL_FRAMES      = 12;
const FRAME_DURATION_MS = 1200;
const PAUSE_ON_LAST_MS  = 1500;

const frames = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => `/images/france-map-frames/frame-${String(i).padStart(2, "0")}.png`
);

/** Précharge ET décode toutes les images, résout quand tout est prêt. */
function preloadAll(srcs: string[]): Promise<void> {
  return Promise.all(
    srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload  = () => img.decode().then(resolve).catch(resolve);
          img.onerror = () => resolve(); // ne pas bloquer si une image manque
          img.src = src;
        })
    )
  ).then(() => undefined);
}

export default function FranceMap() {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [ready, setReady] = useState(false);

  // Précharge tout avant de démarrer
  useEffect(() => {
    let cancelled = false;
    preloadAll(frames).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
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
    <div className="about__map" style={{ position: "relative" }}>
      {frames.map((src, i) => (
        <img
          key={src}
          className="about__map-img"
          src={src}
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
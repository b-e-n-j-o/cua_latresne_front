import { useEffect, useState } from "react";
import { partnerBannerLogos, partnerLogosBasePath } from "../LandingPageContent";

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefers(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return prefers;
}

export function PartnerLogoBanner() {
  const reduceMotion = usePrefersReducedMotion();
  const loop = reduceMotion ? [...partnerBannerLogos] : [...partnerBannerLogos, ...partnerBannerLogos];

  return (
    <>
      {!reduceMotion ? (
        <p className="sources__marquee-sr">
          Bandeau animé de logos d&apos;organismes publics et de référentiels de données territoriales
          (IGN, BRGM, OFB, Copernicus, Météo-France, etc.).
        </p>
      ) : null}
      <div
        className="sources__ribbon"
        role={reduceMotion ? "region" : undefined}
        aria-label={reduceMotion ? "Organismes et référentiels de données représentés" : undefined}
        aria-hidden={reduceMotion ? undefined : true}
      >
        <div className="sources__track">
          {loop.map((logo, i) => (
            <img
              key={`${logo.file}-${i}`}
              className="sources__logo"
              src={`${partnerLogosBasePath}/${logo.file}`}
              alt={reduceMotion ? logo.alt : ""}
              loading="eager"
              decoding="async"
            />
          ))}
        </div>
      </div>
    </>
  );
}

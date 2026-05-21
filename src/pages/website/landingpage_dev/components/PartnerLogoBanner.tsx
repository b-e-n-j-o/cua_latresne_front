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

function logoSrc(file: string): string {
  const base = partnerLogosBasePath.endsWith("/") ? partnerLogosBasePath.slice(0, -1) : partnerLogosBasePath;
  return `${base}/${encodeURIComponent(file)}`;
}

type BannerLogoProps = {
  file: string;
  alt: string;
  reduceMotion: boolean;
  index: number;
};

function BannerLogo({ file, alt, reduceMotion, index }: BannerLogoProps) {
  const [broken, setBroken] = useState(false);
  const initials = alt
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);

  if (broken) {
    return (
      <span className="sources__logo-fallback" title={alt} aria-label={alt}>
        <span className="sources__logo-fallback__text">{initials || "?"}</span>
      </span>
    );
  }

  return (
    <img
      className="sources__logo"
      src={logoSrc(file)}
      alt={reduceMotion ? alt : ""}
      loading={index < 8 ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
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
            <div key={`${logo.file}-${i}`} className="sources__logo-cell">
              <BannerLogo file={logo.file} alt={logo.alt} reduceMotion={reduceMotion} index={i % partnerBannerLogos.length} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

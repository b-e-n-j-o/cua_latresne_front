import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { DomaineInterventionCard, KereliaBtn, KereliaRule } from "./components/KereliaUi";
import { PartnerLogoBanner } from "./components/PartnerLogoBanner";
import { TeamSection } from "./components/TeamSection";
import {
  aboutCopy,
  contactCopy,
  domainesInterventionCopy,
  footerCopy,
  heroCopy,
  methodologyCopy,
  sourcesPartnershipsCopy,
} from "./LandingPageContent";
import type Lenis from "lenis";
import { NosDomainesPinnedSection } from "./components/NosDomainesPinnedSection";
import { cn } from "./lib/cn";
import {
  BORDEAUX_FRANCE_MAP_PIN,
  FRANCE_OUTLINE_SVG_SRC,
  HERO_BACKGROUND_IMAGE_SRC,
  KERELIA_LOGO_SRC,
} from "./lib/constants";

export function HeroSection() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      ref.current?.classList.add("is-ready");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section ref={ref} className="hero" data-bg="dark" data-screen-label="01 Hero">
      <div className="hero__bg" aria-hidden="true">
        <img src={HERO_BACKGROUND_IMAGE_SRC} alt="" decoding="async" fetchPriority="high" />
      </div>
      <div className="hero__scrim" aria-hidden="true" />
      <div className="hero__core">
        <h1 className="hero__headline">
          {heroCopy.headlineLines[0]}
          <br />
          {heroCopy.headlineLines[1]}
        </h1>
        <div className="hero__cta">
          <KereliaBtn variant="primary" href="#domaines-intervention">
            Voir les expertises →
          </KereliaBtn>
        </div>
      </div>

      <div className="hero__rail-bottom">
        <p className="hero__sub">{heroCopy.sub}</p>
        <div className="hero__meta-bl">
          {heroCopy.metaBl.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

type SourcesPartnershipsSectionProps = {
  sectionRef: RefObject<HTMLElement | null>;
  visible: boolean;
};

export function SourcesPartnershipsSection({ sectionRef, visible }: SourcesPartnershipsSectionProps) {
  const { title, intro, institutionalHeading, operationalHeading, partnerships } = sourcesPartnershipsCopy;

  return (
    <section
      ref={sectionRef}
      className={cn("sources-block", visible && "is-visible")}
      id="sources"
      data-bg="dark"
      data-screen-label="02 Sources & Partenariats"
    >
      <header className="sources-block__head sources-block__reveal">
        <h2 className="sources-block__title">{title}</h2>
        <KereliaRule center />
        <p className="sources-block__lead">{intro}</p>
      </header>

      <div className="sources-block__segment sources-block__reveal">
        <div className="sources-block__segment-head">
          <h3 className="sources-block__subheading">{institutionalHeading}</h3>
          <KereliaRule center />
        </div>
        <div className="sources-block__ribbon">
          <PartnerLogoBanner />
        </div>
      </div>

      <div className="sources-block__segment sources-block__reveal">
        <div className="sources-block__segment-head">
          <h3 className="sources-block__subheading">{operationalHeading}</h3>
          <KereliaRule center />
        </div>
        <div className="sources-block__ops">
          {partnerships.map((p) => (
            <article key={p.name} className="sources-block__partner">
              <h4 className="sources-block__partner-name">{p.name}</h4>
              <p className="sources-block__partner-body">{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DomainesInterventionSection() {
  return (
    <section
      className="domaines-intervention"
      id="domaines-intervention"
      data-bg="dark"
      data-screen-label="04 Domaines d'intervention"
    >
      <div className="domaines-intervention__head">
        <h2 className="domaines-intervention__title">{domainesInterventionCopy.title}</h2>
        <KereliaRule center />
      </div>

      <div className="domaines-intervention__cards--five">
        {domainesInterventionCopy.cards.map((card) => (
          <DomaineInterventionCard key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}

type MethodologySectionProps = {
  stepsRef: RefObject<HTMLDivElement | null>;
  methodVisible: boolean;
};

export function MethodologySection({ stepsRef, methodVisible }: MethodologySectionProps) {
  return (
    <section className="method" id="methodologie" data-bg="dark" data-screen-label="05 Méthodologie">
      <div className="method__head">
        <h2 className="method__title">{methodologyCopy.title}</h2>
        <KereliaRule center />
      </div>
      <div ref={stepsRef} className={cn("method__steps", methodVisible && "is-visible")} id="methodSteps">
        {methodologyCopy.steps.map((s) => (
          <div key={s.num} className="step">
            <span className="step__num">{s.num}</span>
            <div className="step__bar" />
            <h3 className="step__title">{s.title}</h3>
            <p className="step__desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

type EtudesSectionProps = {
  lenisRef: RefObject<Lenis | null>;
  lenis: Lenis | null;
};

export function EtudesSection({ lenis }: EtudesSectionProps) {
  return <NosDomainesPinnedSection lenis={lenis} />;
}

export function AboutSection() {
  return (
    <section className="about" id="apropos" data-bg="dark" data-screen-label="06 À propos">
      <div className="about__grid">
        <div>
          <h2 className="about__title">{aboutCopy.title}</h2>
          <KereliaRule />
          <p className="about__body">{aboutCopy.body}</p>
        </div>
        <div>
          <div
            className="about__map"
            style={
              {
                "--about-map-pin-x": `${BORDEAUX_FRANCE_MAP_PIN.leftPct}%`,
                "--about-map-pin-y": `${BORDEAUX_FRANCE_MAP_PIN.topPct}%`,
              } as CSSProperties
            }
          >
            <div className="about__map-stage">
              <img
                className="about__map-svg"
                src={FRANCE_OUTLINE_SVG_SRC}
                alt=""
                width={596}
                height={585}
                decoding="async"
              />
              <span
                className="about__map-pin"
                aria-hidden="true"
                title="Bordeaux"
              />
            </div>
          </div>
          <div className="about__caption">{aboutCopy.mapCaption}</div>
        </div>
        <div className="about__team">
          <TeamSection />
        </div>
      </div>
    </section>
  );
}

export function ContactCtaSection() {
  return (
    <section className="ctafinal" id="contact" data-bg="dark" data-screen-label="07 Contact">
      <div className="ctafinal__inner">
        <h2 className="ctafinal__title">
          {contactCopy.titleBeforeEm}
          <em>{contactCopy.titleEm}</em>
          {contactCopy.titleAfterEm}
        </h2>
        <p className="ctafinal__sub">{contactCopy.sub}</p>
        <div className="ctafinal__cta">
          <KereliaBtn variant="primary" href={`mailto:${contactCopy.email}`}>
            {contactCopy.primaryCta}
          </KereliaBtn>
          <KereliaBtn variant="ghost" href={`mailto:${contactCopy.email}`}>
            {contactCopy.email}
          </KereliaBtn>
        </div>
      </div>
    </section>
  );
}

export function SiteFooterSection() {
  return (
    <>
      <footer className="kfoot" data-bg="yellow" data-screen-label="08 Footer">
        <div className="kfoot__grid">
          <div>
            <h2 className="kfoot__title">{footerCopy.title}</h2>
            <KereliaBtn variant="dark" href={`mailto:${contactCopy.email}`}>
              {footerCopy.primaryCta}
            </KereliaBtn>
          </div>
          <div className="kfoot__aside">
            <ul className="kfoot__links">
              {footerCopy.nav.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
            <div className="kfoot__social">
              <a
                href={footerCopy.linkedinHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {footerCopy.linkedinLabel}
              </a>
              <a href={`mailto:${contactCopy.email}`}>{contactCopy.email}</a>
            </div>
            <img src={KERELIA_LOGO_SRC} className="kfoot__monogram" alt="" aria-hidden="true" />
          </div>
        </div>
      </footer>
      <div className="kfoot-band" aria-hidden="true" />
    </>
  );
}

import type Lenis from "lenis";
import { KereliaRule } from "./KereliaUi";
import { NosDomainePanelCard } from "./NosDomainePanelCard";
import { useNosDomainesGsapPin } from "../hooks/useNosDomainesGsapPin";
import {
  etudesSectionCopy,
  nosDomainesPinLabels,
  nosDomainesSectionMeta,
} from "../LandingPageContent";
import { cn } from "../lib/cn";

type NosDomainesPinnedSectionProps = {
  lenis: Lenis | null;
};

export function NosDomainesPinnedSection({ lenis }: NosDomainesPinnedSectionProps) {
  const { cards, title } = etudesSectionCopy;
  const panelCount = cards.length;

  const { sectionRef, pinRef, trackRef, activeIndex, isDesktop, goToPanel, skipToTarget } =
    useNosDomainesGsapPin({
      lenis,
      panelCount,
    });

  return (
    <section
      ref={sectionRef}
      className={cn("etudes", isDesktop && "etudes--gsap-pin")}
      id={nosDomainesSectionMeta.id}
      data-bg="light"
      data-screen-label={nosDomainesSectionMeta.screenLabel}
    >
      <div ref={pinRef} className="etudes__pin">
        <div className="etudes__head">
          <div>
            <h2 className="etudes__title">{title}</h2>
            <KereliaRule />
          </div>
          {isDesktop && (
            <button
              type="button"
              className="etudes__skip"
              onClick={() => skipToTarget(nosDomainesSectionMeta.skipTargetId)}
            >
              {nosDomainesSectionMeta.skipLabel}
            </button>
          )}
        </div>

        {isDesktop && (
          <div className="etudes__chrome">
            <div
              className="etudes__progress"
              role="tablist"
              aria-label="Panneaux Nos domaines"
            >
              <div className="etudes__dots">
                {cards.map((card, i) => (
                  <button
                    key={card.title}
                    type="button"
                    role="tab"
                    className={cn("etudes__dot", i === activeIndex && "is-active")}
                    aria-selected={i === activeIndex}
                    aria-label={`Panneau ${i + 1} sur ${panelCount} — ${nosDomainesPinLabels[i]}`}
                    onClick={() => goToPanel(i)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {isDesktop ? (
          <div className="etudes__viewport">
            <div ref={trackRef} className="etudes__track">
              {cards.map((card, i) => (
                <div
                  key={card.title}
                  data-pin-panel
                  className={cn("etudes__panel", i === activeIndex && "is-active")}
                >
                  <NosDomainePanelCard card={card} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="etudes__grid etudes__grid--stack">
            {cards.map((card) => (
              <NosDomainePanelCard key={card.title} card={card} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

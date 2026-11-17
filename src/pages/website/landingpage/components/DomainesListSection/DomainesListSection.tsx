import { Fragment, useState } from "react";
import type Lenis from "lenis";
import { DOMAINES, SEPARATOR_BEFORE_INDEX, domainesListCopy, type DomaineItem } from "../../content";
import { DomaineModal } from "./DomaineModal";
import "./DomainesListSection.css";

type DomainesListSectionProps = {
  lenis: Lenis | null;
};

export function DomainesListSection({ lenis }: DomainesListSectionProps) {
  const [activeModal, setActiveModal] = useState<DomaineItem | null>(null);

  return (
    <section
      className="domaines-list"
      id={domainesListCopy.sectionId}
      data-bg="dark"
      data-screen-label={domainesListCopy.screenLabel}
    >
      <div className="domaines-list__head">
        <h2 className="domaines-list__title">{domainesListCopy.title}</h2>
        <div className="domaines-list__rule" aria-hidden="true" />
      </div>

      <ol className="domaines-list__rows" aria-label={domainesListCopy.listAriaLabel}>
        {DOMAINES.map((domaine, index) => (
          <Fragment key={domaine.num}>
            {index === SEPARATOR_BEFORE_INDEX && (
              <li className="domaines-list__separator" aria-hidden="true">
                <span className="domaines-list__separator-label">{domainesListCopy.separatorLabel}</span>
              </li>
            )}

            <li>
              <button
                className="domaines-list__row"
                onClick={() => setActiveModal(domaine)}
                aria-haspopup="dialog"
              >
                <span className="domaines-list__row-num">{domaine.num}</span>

                <span className="domaines-list__row-center">
                  <span className="domaines-list__row-titre">{domaine.titre}</span>
                  <span className="domaines-list__row-sous-titre">{domaine.sousTitre}</span>
                </span>

                <span className="domaines-list__row-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          </Fragment>
        ))}
      </ol>

      <DomaineModal domaine={activeModal} onClose={() => setActiveModal(null)} lenis={lenis} />
    </section>
  );
}
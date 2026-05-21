import { useEffect, useCallback } from "react";
import type Lenis from "lenis";
import type { DomaineItem } from "./DomainesContent";

interface DomaineModalProps {
  domaine: DomaineItem | null;
  onClose: () => void;
  lenis: Lenis | null;
}

export function DomaineModal({ domaine, onClose, lenis }: DomaineModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!domaine) return;

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    lenis?.stop();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      lenis?.start();
    };
  }, [domaine, handleKeyDown, lenis]);

  if (!domaine) return null;

  return (
    <div
      className="domaine-modal__overlay"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={domaine.titre}
    >
      <article
        className="domaine-modal__panel"
        data-lenis-prevent
        onClick={(e) => e.stopPropagation()}
      >
        <header className="domaine-modal__header">
          <div className="domaine-modal__meta">
            <span className="domaine-modal__num">{domaine.num}</span>
            <button
              className="domaine-modal__close"
              onClick={onClose}
              aria-label="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
              </svg>
            </button>
          </div>
          <h2 className="domaine-modal__title">{domaine.titre}</h2>
          <p className="domaine-modal__sous-titre">{domaine.sousTitre}</p>
          <div className="domaine-modal__rule" aria-hidden="true" />
        </header>

        <div className="domaine-modal__body">
          <p className="domaine-modal__intro">{domaine.modal.intro}</p>
          <div className="domaine-modal__paragraphs">
            {domaine.modal.body.map((p, i) => (
              <p key={i} className="domaine-modal__p">{p}</p>
            ))}
          </div>
        </div>

        {domaine.modal.imageSrc && (
          <figure className="domaine-modal__figure">
            <img
              src={domaine.modal.imageSrc}
              alt={domaine.modal.imageAlt ?? ""}
              className="domaine-modal__img"
              decoding="async"
            />
          </figure>
        )}
      </article>
    </div>
  );
}

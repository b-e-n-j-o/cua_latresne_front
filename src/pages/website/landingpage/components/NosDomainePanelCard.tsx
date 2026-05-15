import { useState } from "react";
import type { NosDomainePanelModel } from "../LandingPageContent";
import { KereliaTertiary } from "./KereliaUi";

type NosDomainePanelCardProps = {
  card: NosDomainePanelModel;
};

export function NosDomainePanelCard({ card }: NosDomainePanelCardProps) {
  const [useTopoFallback, setUseTopoFallback] = useState(false);

  return (
    <article className="ecard2">
      <div className={`ecard2__media ${useTopoFallback ? card.topoClass : ""}`}>
        {!useTopoFallback && (
          <video
            className="ecard2__video"
            src={card.videoSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            onError={() => setUseTopoFallback(true)}
          />
        )}
      </div>
      <div className="ecard2__body">
        <span className="pill">{card.pill}</span>
        <h3 className="ecard2__title">{card.title}</h3>
        <p className="ecard2__desc">{card.desc}</p>
        <div className="ecard2__foot">
          <p className="ecard2__status">{card.status}</p>
          <KereliaTertiary href={card.ctaHref}>{card.ctaLabel}</KereliaTertiary>
        </div>
      </div>
    </article>
  );
}

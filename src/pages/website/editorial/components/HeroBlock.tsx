import type { HeroBlock } from "../types";

export function HeroBlockView({ block }: { block: HeroBlock }) {
  return (
    <header className="kerelia-editorial__hero">
      {block.kicker ? <span className="kerelia-editorial__kicker">{block.kicker}</span> : null}
      <h1 className="kerelia-editorial__title">{block.title}</h1>
      {block.subtitle ? <p className="kerelia-editorial__subtitle">{block.subtitle}</p> : null}
      {block.image ? (
        <figure className="kerelia-editorial__figure">
          <img src={block.image.src} alt={block.image.alt} />
          {block.image.caption ? <figcaption>{block.image.caption}</figcaption> : null}
        </figure>
      ) : null}
    </header>
  );
}

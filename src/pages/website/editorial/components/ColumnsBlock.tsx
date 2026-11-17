import type { ColumnsBlock } from "../types";
import { RichTextView } from "./RichText";

export function ColumnsBlockView({ block }: { block: ColumnsBlock }) {
  const imageFirst = block.imageSide === "left";
  return (
    <section className={`kerelia-editorial__columns${imageFirst ? " is-image-first" : ""}`}>
      <div>
        {block.title ? <h2 className="kerelia-editorial__h2">{block.title}</h2> : null}
        {block.paragraphs.map((paragraph, index) => (
          <p key={index} className="kerelia-editorial__p">
            <RichTextView value={paragraph} />
          </p>
        ))}
      </div>
      <figure className="kerelia-editorial__figure">
        <img src={block.image.src} alt={block.image.alt} />
        {block.image.caption ? <figcaption>{block.image.caption}</figcaption> : null}
      </figure>
    </section>
  );
}

import type { SectionBlock } from "../types";
import { RichTextView } from "./RichText";

export function SectionBlockView({ block }: { block: SectionBlock }) {
  return (
    <section className="kerelia-editorial__section">
      {block.title ? <h2 className="kerelia-editorial__h2">{block.title}</h2> : null}
      {block.paragraphs.map((paragraph, index) => (
        <p key={index} className="kerelia-editorial__p">
          <RichTextView value={paragraph} />
        </p>
      ))}
    </section>
  );
}

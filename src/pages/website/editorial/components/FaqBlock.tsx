import type { FaqBlock } from "../types";
import { RichTextView } from "./RichText";

export function FaqBlockView({ block }: { block: FaqBlock }) {
  return (
    <section className="kerelia-editorial__section">
      {block.title ? <h2 className="kerelia-editorial__h2">{block.title}</h2> : null}
      <div className="kerelia-editorial__faq">
        {block.items.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>
              <RichTextView value={item.answer} />
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

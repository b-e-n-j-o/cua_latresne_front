import type { ListBlock } from "../types";
import { RichTextView } from "./RichText";

export function ListBlockView({ block }: { block: ListBlock }) {
  return (
    <section className="kerelia-editorial__section">
      {block.title ? <h2 className="kerelia-editorial__h2">{block.title}</h2> : null}
      <ul className="kerelia-editorial__list">
        {block.items.map((item, index) => (
          <li key={index}>
            <RichTextView value={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

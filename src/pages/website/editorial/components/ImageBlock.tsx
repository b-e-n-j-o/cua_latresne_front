import type { ImageBlock } from "../types";

export function ImageBlockView({ block }: { block: ImageBlock }) {
  return (
    <figure className="kerelia-editorial__figure">
      <img src={block.src} alt={block.alt} />
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}

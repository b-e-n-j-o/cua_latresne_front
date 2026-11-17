import type { CtaBlock } from "../types";

export function CtaBlockView({ block }: { block: CtaBlock }) {
  return (
    <p className="kerelia-editorial__cta">
      <a href={block.href}>{block.label}</a>
    </p>
  );
}

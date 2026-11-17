import type { StatsBlock } from "../types";

export function StatsBlockView({ block }: { block: StatsBlock }) {
  return (
    <section className="kerelia-editorial__section">
      {block.title ? <h2 className="kerelia-editorial__h2">{block.title}</h2> : null}
      <div className="kerelia-editorial__stats">
        {block.items.map((item) => (
          <div key={item.value + item.label} className="kerelia-editorial__stat">
            <span className="kerelia-editorial__stat-value">{item.value}</span>
            <p>{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

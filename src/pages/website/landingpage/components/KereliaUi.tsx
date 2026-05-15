import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";

type SectionLabelVariant = "default" | "yellow" | "dark";

type SectionLabelProps = {
  children?: ReactNode;
  variant?: SectionLabelVariant;
  className?: string;
  style?: CSSProperties;
};

export function SectionLabel({ children, variant = "default", className, style }: SectionLabelProps) {
  return (
    <span
      className={cn(
        "k-section-label",
        variant === "yellow" && "k-section-label--yellow",
        variant === "dark" && "k-section-label--dark",
        className
      )}
      style={style}
    >
      <span className="k-section-label__dot" />
      {children}
    </span>
  );
}

type KereliaRuleProps = { center?: boolean };

export function KereliaRule({ center }: KereliaRuleProps) {
  return <div className={cn("k-rule", center && "k-rule--center")} />;
}

type KereliaBtnVariant = "primary" | "ghost" | "dark";

type KereliaBtnProps = {
  variant: KereliaBtnVariant;
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function KereliaBtn({ variant, href, children, className, onClick }: KereliaBtnProps) {
  const cls =
    variant === "primary"
      ? "k-btn-primary"
      : variant === "ghost"
        ? "k-btn-ghost"
        : "k-btn-dark";
  return (
    <a className={cn(cls, className)} href={href} onClick={onClick}>
      {children}
    </a>
  );
}

type KereliaTertiaryProps = {
  href: string;
  children: ReactNode;
  onClick?: () => void;
};

export function KereliaTertiary({ href, children, onClick }: KereliaTertiaryProps) {
  return (
    <a className="k-tertiary" href={href} onClick={onClick}>
      {children}
    </a>
  );
}

const TAG_DOT_STYLE: CSSProperties = {
  display: "inline-block",
  width: 6,
  height: 6,
  background: "var(--color-yellow)",
  borderRadius: "50%",
  marginRight: 8,
  verticalAlign: "middle",
};

export function ExpertiseTagDot() {
  return <span className="k-section-label__dot" style={TAG_DOT_STYLE} />;
}

export type DomaineInterventionCardModel = {
  tag: string;
  title: string;
  bullets: string[];
  wide?: boolean;
};

type DomaineInterventionCardProps = {
  card: DomaineInterventionCardModel;
};

export function DomaineInterventionCard({ card }: DomaineInterventionCardProps) {
  return (
    <article className={cn("ecard5", card.wide && "ecard5--wide")}>
      <div className="ecard5__head">
        <span className="ecard5__num">
          <ExpertiseTagDot />
          {card.tag}
        </span>
      </div>
      <h3 className="ecard5__title">{card.title}</h3>
      <ul className="ecard5__list">
        {card.bullets.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
      <div className="ecard5__foot">
        <KereliaTertiary href="#">En savoir plus →</KereliaTertiary>
      </div>
    </article>
  );
}

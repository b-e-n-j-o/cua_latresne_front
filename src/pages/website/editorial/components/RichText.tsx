import type { RichSpan, RichText } from "../types";

function Span({ span }: { span: RichSpan }) {
  if (typeof span === "string") return <>{span}</>;
  const inner = span.strong ? <strong>{span.text}</strong> : <>{span.text}</>;
  if (span.href) {
    return (
      <a href={span.href} className="kerelia-editorial__link">
        {inner}
      </a>
    );
  }
  return inner;
}

export function RichTextView({ value }: { value: RichText }) {
  return (
    <>
      {value.map((span, index) => (
        <Span key={index} span={span} />
      ))}
    </>
  );
}

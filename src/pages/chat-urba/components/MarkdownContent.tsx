type Props = {
  content: string;
};

export default function MarkdownContent({ content }: Props) {
  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed">
      {content}
    </div>
  );
}

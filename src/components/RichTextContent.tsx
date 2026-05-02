import Link from "next/link";

type RichTextContentProps = {
  value: string;
  className?: string;
  clamp?: boolean;
};

function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={`${match.index}-em`}>{token.slice(1, -1)}</em>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (linkMatch) {
        parts.push(
          <Link
            key={`${match.index}-link`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-carnival-blue underline-offset-2 hover:underline"
          >
            {linkMatch[1]}
          </Link>,
        );
      } else {
        parts.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export function RichTextContent({ value, className = "", clamp = false }: RichTextContentProps) {
  const lines = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }

    flushList();

    if (!line.trim()) {
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={`h4-${blocks.length}`} className="mt-3 font-semibold text-foreground">
          {renderInline(line.slice(4))}
        </h4>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mt-4 text-base font-semibold text-foreground">
          {renderInline(line.slice(3))}
        </h3>,
      );
      continue;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2">
        {renderInline(line)}
      </p>,
    );
  }

  flushList();

  if (blocks.length === 0) return null;

  return (
    <div className={`${clamp ? "line-clamp-6" : ""} break-words leading-6 ${className}`}>
      {blocks}
    </div>
  );
}

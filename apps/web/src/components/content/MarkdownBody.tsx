import { renderMarkdown } from '../../lib/markdown';

interface MarkdownBodyProps {
  markdown: string;
  className?: string;
}

export function MarkdownBody({ markdown, className = '' }: MarkdownBodyProps) {
  return (
    <div
      className={`blog-content retro-text text-base sm:text-lg leading-relaxed ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
    />
  );
}

import { renderMarkdown } from '../../lib/markdown';
import { SanitizedHtml } from '../../lib/sanitized-html';

interface MarkdownBodyProps {
  markdown: string;
  className?: string;
}

export function MarkdownBody({ markdown, className = '' }: MarkdownBodyProps) {
  return (
    <SanitizedHtml
      className={`blog-content retro-text text-base sm:text-lg leading-relaxed ${className}`.trim()}
      html={renderMarkdown(markdown)}
    />
  );
}

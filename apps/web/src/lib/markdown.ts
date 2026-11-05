import { escapeHtml, markdownImageHtml, markdownLinkHtml } from './safeMarkdown';

const LINK_TOKEN = '\uE000';
const IMG_TOKEN = '\uE001';

function inline(raw: string): string {
  return escapeHtml(raw)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function renderTable(rows: string[]): string {
  const body = rows.filter((row) => !isSeparatorRow(row));
  if (body.length === 0) return '';
  const [head, ...rest] = body;
  const headCells = splitRow(head!).map((cell) => `<th>${inline(cell)}</th>`).join('');
  const bodyRows = rest
    .map((row) => `<tr>${splitRow(row).map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="md-table-wrap"><table class="md-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

function isBlockStart(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^#{1,3} /.test(trimmed) ||
    trimmed === '---' ||
    trimmed.startsWith('|') ||
    /^[-*] /.test(trimmed) ||
    /^\d+\. /.test(trimmed)
  );
}

/** Lightweight markdown → HTML for notice/blog/transparency content. */
export function renderMarkdown(md: string): string {
  const links: string[] = [];
  const images: string[] = [];

  let text = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) => {
    const i = images.length;
    images.push(markdownImageHtml(alt, src, 'md-img'));
    return `${IMG_TOKEN}${i}${IMG_TOKEN}`;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const i = links.length;
    links.push(markdownLinkHtml(label, href, 'md-link'));
    return `${LINK_TOKEN}${i}${LINK_TOKEN}`;
  });

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1]!.length;
      blocks.push(`<h${level} class="md-h${level}">${inline(heading[2]!)}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed === '---') {
      blocks.push('<hr class="md-hr" />');
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(lines[i] ?? '');
        i += 1;
      }
      const table = renderTable(rows);
      if (table) blocks.push(table);
      continue;
    }

    if (/^[-*] /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test((lines[i] ?? '').trim())) {
        items.push(`<li>${inline((lines[i] ?? '').trim().replace(/^[-*] /, ''))}</li>`);
        i += 1;
      }
      blocks.push(`<ul class="md-ul">${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test((lines[i] ?? '').trim())) {
        items.push(`<li>${inline((lines[i] ?? '').trim().replace(/^\d+\. /, ''))}</li>`);
        i += 1;
      }
      blocks.push(`<ol class="md-ol">${items.join('')}</ol>`);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && (lines[i] ?? '').trim() && !isBlockStart(lines[i] ?? '')) {
      para.push((lines[i] ?? '').trim());
      i += 1;
    }
    blocks.push(`<p class="md-p">${para.map(inline).join('<br/>')}</p>`);
  }

  let html = blocks.join('');
  for (let n = 0; n < images.length; n += 1) {
    html = html.replace(escapeHtml(`${IMG_TOKEN}${n}${IMG_TOKEN}`), images[n]!);
  }
  for (let n = 0; n < links.length; n += 1) {
    html = html.replace(escapeHtml(`${LINK_TOKEN}${n}${LINK_TOKEN}`), links[n]!);
  }
  return html;
}

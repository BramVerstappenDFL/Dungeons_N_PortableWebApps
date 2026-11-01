// Minimal renderer for the SRD's markdown-ish text (paragraphs, bold/italic, simple tables).
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>');

function toHtml(src: string): string {
  return src
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => l.trim().startsWith('|'))) {
        const rows = lines
          .filter((l) => !/^\|\s*-/.test(l.trim()))
          .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
        const [head, ...body] = rows;
        const hasHead = head.some((h) => h);
        const tr = (r: string[], tag: string) => `<tr>${r.map((x) => `<${tag}>${inline(x)}</${tag}>`).join('')}</tr>`;
        return `<div class="table-wrap"><table>${hasHead ? `<thead>${tr(head, 'th')}</thead>` : ''}<tbody>${body.map((r) => tr(r, 'td')).join('')}</tbody></table></div>`;
      }
      if (lines.every((l) => /^\s*[-*] /.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

export function Markdown({ text }: { text: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: toHtml(text) }} />;
}

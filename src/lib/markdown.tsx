// Renders the small Markdown subset used in blog posts straight to React elements. No HTML is
// ever parsed or injected, so a post cannot contain scripts; links and images are checked too.
//
//   ## Kop   ### Subkop   **vet**   *cursief*   [tekst](https://…)   ![omschrijving](m_…)
//   - lijst   1. genummerd   > citaat   lege regel = nieuwe alinea
import type { ReactNode } from 'react';
import { imageSrcSet, imageUrl } from './images';

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;
const SAFE_IMAGE = /^(m_[a-z0-9]{16}|[a-z0-9-]+|https:\/\/images\.unsplash\.com\/\S+)$/;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[2]) out.push(<strong key={key}>{match[2]}</strong>);
    else if (match[4]) out.push(<em key={key}>{match[4]}</em>);
    else if (match[6]) {
      const href = match[7];
      if (SAFE_LINK.test(href)) {
        const external = /^https?:\/\//i.test(href);
        out.push(
          <a key={key} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="underline underline-offset-4 hover:opacity-70">
            {match[6]}
          </a>,
        );
      } else out.push(match[6]);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) {
      blocks.push(
        m[1].length === 2 ? (
          <h2 key={key} className="font-display mt-12 text-3xl leading-tight">
            {inline(m[2], key)}
          </h2>
        ) : (
          <h3 key={key} className="font-display mt-10 text-2xl leading-tight">
            {inline(m[2], key)}
          </h3>
        ),
      );
      i++;
    } else if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      if (SAFE_IMAGE.test(m[2])) {
        blocks.push(
          <figure key={key} className="mt-10">
            <img src={imageUrl(m[2])} srcSet={imageSrcSet(m[2])} sizes="(min-width: 768px) 720px, 100vw" alt={m[1]} loading="lazy" className="w-full" />
            {m[1] && <figcaption className="mt-3 text-sm text-stone-dark">{m[1]}</figcaption>}
          </figure>,
        );
      }
      i++;
    } else if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const ordered = /^\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/).test(lines[i])) {
        items.push(lines[i].replace(/^([-*]|\d+[.)])\s+/, ''));
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key} className={`mt-6 space-y-2 pl-6 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, j) => (
            <li key={j}>{inline(item, `${key}-${j}`)}</li>
          ))}
        </List>,
      );
    } else if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(
        <blockquote key={key} className="mt-8 border-l-2 border-accent pl-5 text-xl leading-relaxed">
          {inline(quote.join(' '), key)}
        </blockquote>,
      );
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|!\[|[-*]\s|\d+[.)]\s|>)/.test(lines[i])) para.push(lines[i++]);
      blocks.push(
        <p key={key} className="mt-6">
          {inline(para.join(' '), key)}
        </p>,
      );
    }
  }
  return <>{blocks}</>;
}

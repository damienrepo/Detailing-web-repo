// Renders e-mails as responsive, table-based HTML (works in Gmail, Outlook, Apple Mail and on phones)
// plus a plain-text version. Every value is HTML-escaped; admin texts only get line breaks.
import type { EmailDesign } from '../shared/email';
import { formatAddress, SITE } from '../shared/site';
import { imagePath } from './seo';

export type EmailBlock =
  | { type: 'summary'; title: string; items: { label: string; value: string }[]; totals: { label: string; value: string; strong?: boolean; muted?: boolean }[] }
  | { type: 'box'; title: string; lines: string[] }
  | { type: 'details'; title?: string; rows: [string, string][] }
  | { type: 'code'; label: string; value: string };

export type EmailContent = {
  subject: string;
  preheader: string;
  heading: string;
  intro: string;
  button?: { label: string; url: string };
  blocks: EmailBlock[];
  closing?: string;
  /** Small print at the bottom, e.g. why the recipient gets this mail. */
  note?: string;
};

type Theme = {
  page: string;
  header: string;
  headerText: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  panel: string;
  footer: string;
  scheme: 'light' | 'dark';
};

const THEMES: Record<EmailDesign['template'], Theme> = {
  klassiek: { page: '#f3f1ec', header: '#0e0e0f', headerText: '#f3f1ec', card: '#ffffff', text: '#0e0e0f', muted: '#5f5c57', line: '#e8e5de', panel: '#f8f7f3', footer: '#5f5c57', scheme: 'light' },
  licht: { page: '#ffffff', header: '#ffffff', headerText: '#0e0e0f', card: '#ffffff', text: '#0e0e0f', muted: '#5f5c57', line: '#ece9e2', panel: '#f8f7f3', footer: '#8d8a84', scheme: 'light' },
  foto: { page: '#0e0e0f', header: '#0e0e0f', headerText: '#f3f1ec', card: '#161618', text: '#f3f1ec', muted: '#a8a49d', line: '#2c2c30', panel: '#1f1f22', footer: '#8d8a84', scheme: 'dark' },
};

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const LOGO_FONT = "Montserrat, 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Escaped text with blank lines as paragraphs and single newlines as <br>. */
function paragraphs(text: string, style: string) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;${style}">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Black or white text, whichever reads better on the accent colour. */
function onAccent(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? '#0e0e0f' : '#ffffff';
}

/** "Detail2Go" with the digits in the accent colour, as live text (never blocked like images). */
function wordmark(color: string, accent: string, size: number) {
  const name = esc(SITE.name).replace(/(\d+)/g, `<span style="color:${accent}">$1</span>`);
  return `<span style="font-family:${LOGO_FONT};font-size:${size}px;line-height:1;font-weight:700;letter-spacing:-0.3px;color:${color}">${name}</span>`;
}

const absolute = (ref: string, appUrl: string) => {
  const p = imagePath(ref);
  return p.startsWith('/') ? appUrl + p : p;
};

function renderBlock(block: EmailBlock, t: Theme, accent: string, radius: string): string {
  const cell = `font-family:${FONT};font-size:15px;line-height:22px;color:${t.text}`;
  const title = (s: string) =>
    `<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:1.2px;text-transform:uppercase;color:${t.muted}">${esc(s)}</p>`;

  if (block.type === 'summary') {
    const items = block.items
      .map(
        (i) => `<tr>
          <td style="${cell};padding:10px 0;border-bottom:1px solid ${t.line}">${esc(i.label)}</td>
          <td align="right" style="${cell};padding:10px 0 10px 16px;border-bottom:1px solid ${t.line};white-space:nowrap">${esc(i.value)}</td>
        </tr>`,
      )
      .join('');
    const totals = block.totals
      .map(
        (row) => `<tr>
          <td style="${cell};padding:${row.strong ? '12px' : '6px'} 0 0;${row.strong ? 'font-weight:700;font-size:17px' : ''}${row.muted ? `;color:${t.muted};font-size:13px` : ''}">${esc(row.label)}</td>
          <td align="right" style="${cell};padding:${row.strong ? '12px' : '6px'} 0 0 16px;white-space:nowrap;${row.strong ? 'font-weight:700;font-size:17px' : ''}${row.muted ? `;color:${t.muted};font-size:13px` : ''}">${esc(row.value)}</td>
        </tr>`,
      )
      .join('');
    return `<tr><td class="px" style="padding:8px 40px 24px">
      ${title(block.title)}
      <table role="presentation" width="100%" style="border-collapse:collapse">${items}${totals}</table>
    </td></tr>`;
  }

  if (block.type === 'box') {
    return `<tr><td class="px" style="padding:0 40px 24px">
      <table role="presentation" width="100%" style="border-collapse:collapse;background:${t.panel};border-left:3px solid ${accent};border-radius:${radius}">
        <tr><td style="padding:18px 20px">
          ${title(block.title)}
          ${block.lines.map((l) => `<p style="margin:0 0 6px;${cell}">${esc(l).replace(/\n/g, '<br>')}</p>`).join('')}
        </td></tr>
      </table>
    </td></tr>`;
  }

  if (block.type === 'details') {
    const rows = block.rows
      .map(
        ([k, v]) => `<tr>
          <td valign="top" style="${cell};color:${t.muted};padding:6px 16px 6px 0;width:38%">${esc(k)}</td>
          <td valign="top" style="${cell};padding:6px 0">${esc(v).replace(/\n/g, '<br>')}</td>
        </tr>`,
      )
      .join('');
    return `<tr><td class="px" style="padding:0 40px 24px">
      ${block.title ? title(block.title) : ''}
      <table role="presentation" width="100%" style="border-collapse:collapse">${rows}</table>
    </td></tr>`;
  }

  return `<tr><td class="px" style="padding:0 40px 24px">
    <table role="presentation" width="100%" style="border-collapse:collapse;background:${t.panel};border-radius:${radius}">
      <tr><td align="center" style="padding:16px 20px">
        <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${t.muted}">${esc(block.label)}</p>
        <p style="margin:0;font-family:'Courier New',monospace;font-size:20px;letter-spacing:2px;font-weight:700;color:${t.text}">${esc(block.value)}</p>
      </td></tr>
    </table>
  </td></tr>`;
}

export function renderEmail(content: EmailContent, design: EmailDesign, appUrl: string): { html: string; text: string } {
  const t = THEMES[design.template];
  const accent = /^#[0-9a-f]{6}$/i.test(design.accent) ? design.accent : '#d9a72a';
  const radius = design.rounded ? '10px' : '0';
  const buttonRadius = design.rounded ? '999px' : '0';

  const topBar = design.template === 'licht' ? `<tr><td style="height:4px;line-height:4px;font-size:0;background:${accent}">&nbsp;</td></tr>` : '';
  const header =
    design.template === 'foto'
      ? `<tr><td align="center" style="padding:28px 24px 22px;background:${t.header}">${wordmark(t.headerText, accent, 26)}</td></tr>
         <tr><td style="background:${t.header};font-size:0;line-height:0">
           <img src="${esc(absolute(design.headerImage, appUrl))}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0">
         </td></tr>`
      : design.template === 'licht'
        ? `<tr><td class="px" style="padding:32px 40px 8px;background:${t.header}">${wordmark(t.headerText, accent, 24)}</td></tr>`
        : `<tr><td class="px" style="padding:26px 40px;background:${t.header};border-radius:${radius} ${radius} 0 0">${wordmark(t.headerText, accent, 24)}</td></tr>`;

  const button = content.button
    ? `<tr><td class="px" style="padding:4px 40px 28px">
        <table role="presentation" class="btn" style="border-collapse:separate"><tr>
          <td align="center" bgcolor="${accent}" style="background:${accent};border-radius:${buttonRadius}">
            <a href="${esc(content.button.url)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:15px;font-weight:700;line-height:18px;color:${onAccent(accent)};text-decoration:none;border-radius:${buttonRadius}">${esc(content.button.label)} &rarr;</a>
          </td>
        </tr></table>
      </td></tr>`
    : '';

  const social = design.showSocial
    ? [SITE.social.instagram && `<a href="${esc(SITE.social.instagram)}" style="color:${t.footer};text-decoration:underline">Instagram</a>`, SITE.social.tiktok && `<a href="${esc(SITE.social.tiktok)}" style="color:${t.footer};text-decoration:underline">TikTok</a>`]
        .filter(Boolean)
        .join(' &nbsp;·&nbsp; ')
    : '';
  const address = formatAddress();
  const footerStyle = `margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:20px;color:${t.footer}`;

  const html = `<!doctype html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="${t.scheme}">
<meta name="supported-color-schemes" content="${t.scheme}">
<title>${esc(content.subject)}</title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { color:inherit; }
  @media (max-width:620px) {
    .wrap { width:100% !important; }
    .px { padding-left:22px !important; padding-right:22px !important; }
    .h1 { font-size:26px !important; line-height:32px !important; }
    .btn, .btn tbody, .btn tr, .btn td, .btn a { display:block !important; width:100% !important; text-align:center !important; box-sizing:border-box; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${t.page}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${t.page};opacity:0">${esc(content.preheader)}${'&#8204;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" style="background:${t.page}">
  <tr><td align="center" style="padding:24px 10px 40px">
    <table role="presentation" class="wrap" width="600" style="width:600px;max-width:600px">
      ${topBar}
      ${header}
      <tr><td style="background:${t.card};${design.template === 'klassiek' ? `border-radius:0 0 ${radius} ${radius}` : design.template === 'licht' ? '' : `border-radius:0 0 ${radius} ${radius}`}">
        <table role="presentation" width="100%">
          <tr><td class="px" style="padding:36px 40px 8px">
            <h1 class="h1" style="margin:0 0 16px;font-family:${FONT};font-size:30px;line-height:36px;font-weight:700;letter-spacing:-0.4px;color:${t.text}">${esc(content.heading)}</h1>
            ${paragraphs(content.intro, `font-family:${FONT};font-size:16px;line-height:25px;color:${t.text}`)}
          </td></tr>
          ${button}
          ${content.blocks.map((b) => renderBlock(b, t, accent, radius)).join('')}
          ${
            content.closing
              ? `<tr><td class="px" style="padding:0 40px 8px">${paragraphs(content.closing, `font-family:${FONT};font-size:15px;line-height:23px;color:${t.muted}`)}</td></tr>`
              : ''
          }
          <tr><td class="px" style="padding:8px 40px 36px">
            <p style="margin:0;font-family:${FONT};font-size:15px;line-height:23px;color:${t.text}">Met vriendelijke groet,<br><strong>${esc(SITE.fullName)}</strong></p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td class="px" align="center" style="padding:28px 40px 0">
        <p style="margin:0 0 10px">${wordmark(t.footer, accent, 16)}</p>
        ${design.footerText ? `<p style="${footerStyle}">${esc(design.footerText)}</p>` : ''}
        <p style="${footerStyle}">
          <a href="tel:${esc(SITE.phoneHref)}" style="color:${t.footer};text-decoration:none">${esc(SITE.phone)}</a> &nbsp;·&nbsp;
          <a href="mailto:${esc(SITE.email)}" style="color:${t.footer};text-decoration:none">${esc(SITE.email)}</a>
        </p>
        ${address ? `<p style="${footerStyle}">${esc(address)}</p>` : ''}
        ${social ? `<p style="${footerStyle}">${social}</p>` : ''}
        ${content.note ? `<p style="margin:14px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${t.footer}">${esc(content.note)}</p>` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { html, text: renderText(content) };
}

function renderText(content: EmailContent) {
  const parts = [content.heading, content.intro.trim()];
  if (content.button) parts.push(`${content.button.label}: ${content.button.url}`);
  for (const b of content.blocks) {
    if (b.type === 'summary') {
      parts.push([b.title, ...b.items.map((i) => `${i.label}  ${i.value}`), ...b.totals.map((r) => `${r.label}  ${r.value}`)].join('\n'));
    } else if (b.type === 'box') {
      parts.push([b.title, ...b.lines].join('\n'));
    } else if (b.type === 'details') {
      parts.push([...(b.title ? [b.title] : []), ...b.rows.map(([k, v]) => `${k}: ${v}`)].join('\n'));
    } else {
      parts.push(`${b.label}: ${b.value}`);
    }
  }
  if (content.closing) parts.push(content.closing.trim());
  parts.push(`Met vriendelijke groet,\n${SITE.fullName}\n${SITE.phone} · ${SITE.email}`);
  return parts.filter(Boolean).join('\n\n');
}

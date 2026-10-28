import type { Locale } from "@/i18n/config";
import { escapeHtml } from "@/lib/content/render";

/**
 * Branded email layout (Phase 7): black header with the gold KT mark, dark
 * body, gold button, and a plain-text version of the same content. Emails
 * always use the dark brand look, whatever theme the reader picked on the site.
 *
 * Pure (no server-only imports) so scripts can render it. Every string is
 * escaped here; callers pass plain text, never HTML.
 */

export type EmailItem = { title: string; url: string; excerpt?: string | null; meta?: string | null };

export type EmailContent = {
  locale: Locale;
  siteUrl: string;
  siteName: string;
  /** Hidden preview line shown by inbox lists. */
  preheader?: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Article links (newsletter and digest emails). */
  items?: EmailItem[];
  /** Small print under the content, e.g. "If you didn't ask for this…". */
  note?: string;
  /** Shown above the raw link when there is a button. */
  linkFallback?: string;
  footer: string;
  unsubscribe?: { label: string; url: string };
};

const COLORS = {
  black: "#0a0a0a",
  obsidian: "#111111",
  raised: "#1a1a1a",
  gold: "#c9a54c",
  ivory: "#f5f2ea",
  grey: "#a19d93",
  rule: "#2a2722",
};

const FONT = {
  en: "Georgia, 'Times New Roman', serif",
  enSans: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  ur: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Noto Naskh Arabic', Tahoma, serif",
};

/** Only http(s) links are ever put in an href. */
function safeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : "#";
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const { locale } = content;
  const rtl = locale === "ur";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const bodyFont = rtl ? FONT.ur : FONT.enSans;
  const headingFont = rtl ? FONT.ur : FONT.en;
  const lineHeight = rtl ? "2" : "1.6";
  const e = escapeHtml;

  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px;color:${COLORS.ivory};font-size:16px;line-height:${lineHeight};">${e(p)}</p>`)
    .join("");

  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="background:${COLORS.gold};border-radius:4px;">` +
      `<a href="${e(safeUrl(content.button.url))}" style="display:inline-block;padding:12px 24px;color:${COLORS.black};font-family:${bodyFont};font-size:16px;font-weight:600;text-decoration:none;">${e(content.button.label)}</a>` +
      `</td></tr></table>`
    : "";

  const items = (content.items ?? [])
    .map(
      (item) =>
        `<tr><td style="padding:16px 0;border-top:1px solid ${COLORS.rule};">` +
        (item.meta ? `<p style="margin:0 0 4px;color:${COLORS.gold};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">${e(item.meta)}</p>` : "") +
        `<a href="${e(safeUrl(item.url))}" style="color:${COLORS.ivory};font-family:${headingFont};font-size:19px;line-height:${rtl ? "1.9" : "1.35"};text-decoration:none;">${e(item.title)}</a>` +
        (item.excerpt ? `<p style="margin:6px 0 0;color:${COLORS.grey};font-size:14px;line-height:${lineHeight};">${e(item.excerpt)}</p>` : "") +
        `</td></tr>`,
    )
    .join("");

  const fallback =
    content.button && content.linkFallback
      ? `<p style="margin:0 0 16px;color:${COLORS.grey};font-size:13px;line-height:1.6;">${e(content.linkFallback)}<br><a href="${e(safeUrl(content.button.url))}" style="color:${COLORS.gold};word-break:break-all;" dir="ltr">${e(content.button.url)}</a></p>`
      : "";

  const note = content.note ? `<p style="margin:0 0 16px;color:${COLORS.grey};font-size:14px;line-height:${lineHeight};">${e(content.note)}</p>` : "";

  const unsubscribe = content.unsubscribe
    ? `<br><a href="${e(safeUrl(content.unsubscribe.url))}" style="color:${COLORS.gold};">${e(content.unsubscribe.label)}</a>`
    : "";

  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.black};">${e(content.preheader)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${e(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.black};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.black};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="max-width:600px;background:${COLORS.obsidian};border:1px solid ${COLORS.rule};">
<tr><td style="background:${COLORS.black};padding:20px 28px;border-bottom:2px solid ${COLORS.gold};text-align:${align};">
<a href="${e(safeUrl(content.siteUrl))}" style="text-decoration:none;" dir="ltr">
<span style="display:inline-block;border:1px solid ${COLORS.gold};color:${COLORS.gold};font-family:${FONT.en};font-size:18px;line-height:1;padding:9px 8px;vertical-align:middle;">KT</span>
<span style="display:inline-block;margin-inline-start:12px;margin-left:12px;color:${COLORS.ivory};font-family:${FONT.en};font-size:20px;vertical-align:middle;">${e(content.siteName)}</span>
</a>
</td></tr>
<tr><td style="padding:32px 28px 16px;text-align:${align};font-family:${bodyFont};" lang="${locale}">
<h1 style="margin:0 0 20px;color:${COLORS.ivory};font-family:${headingFont};font-size:26px;font-weight:normal;line-height:${rtl ? "1.9" : "1.3"};">${e(content.heading)}</h1>
${paragraphs}${button}${items ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;">${items}</table>` : ""}${fallback}${note}
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid ${COLORS.rule};text-align:${align};font-family:${bodyFont};color:${COLORS.grey};font-size:12px;line-height:${lineHeight};" lang="${locale}">
${e(content.footer)}${unsubscribe}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    content.siteName.toUpperCase(),
    "",
    content.heading,
    "",
    ...content.paragraphs.flatMap((p) => [p, ""]),
    ...(content.button ? [`${content.button.label}: ${content.button.url}`, ""] : []),
    ...(content.items ?? []).flatMap((item) => [
      ...(item.meta ? [item.meta] : []),
      item.title,
      ...(item.excerpt ? [item.excerpt] : []),
      item.url,
      "",
    ]),
    ...(content.note ? [content.note, ""] : []),
    "--",
    content.footer,
    ...(content.unsubscribe ? [`${content.unsubscribe.label}: ${content.unsubscribe.url}`] : []),
  ].join("\n");

  return { html, text };
}

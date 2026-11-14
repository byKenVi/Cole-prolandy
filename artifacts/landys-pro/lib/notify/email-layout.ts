/**
 * Branded, accessible email layout (table-based for Outlook/Gmail).
 * Large type (17px body), one obvious button, plain-text fallback built by the
 * template alongside.
 */

export type EmailDetail = { label: string; value: string };
export type EmailButton = { label: string; href: string; tone?: "primary" | "secondary" };

export type EmailContent = {
  preheader: string;
  heading: string;
  /** Paragraphs; plain text, escaped here. */
  intro: string[];
  details?: EmailDetail[];
  /** Quoted block (e.g. the homeowner's description). */
  quote?: { label: string; text: string } | null;
  buttons?: EmailButton[];
  /** Small paragraphs under the buttons. */
  notes?: string[];
  footer?: string;
};

// Landy's palette (see app/globals.css): forest green, copper, cream.
const COLORS = {
  page: "#F6F1E7",
  card: "#FFFFFF",
  ink: "#2F2A24",
  muted: "#5E564A",
  line: "#E5DDCD",
  brand: "#2F4A3C",
  gold: "#B4632E",
  goldText: "#FFFFFF",
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font:400 17px/1.55 Arial,Helvetica,sans-serif;color:${COLORS.ink};">${escapeHtml(text)}</p>`;
}

function button(b: EmailButton): string {
  const primary = (b.tone ?? "primary") === "primary";
  const style = primary
    ? `background:${COLORS.gold};color:${COLORS.goldText};border:2px solid ${COLORS.gold};`
    : `background:${COLORS.card};color:${COLORS.ink};border:2px solid ${COLORS.line};`;
  return `<tr><td style="padding:0 0 12px;">
    <a href="${escapeHtml(b.href)}" style="${style}display:block;text-align:center;text-decoration:none;font:700 18px/1.2 Arial,Helvetica,sans-serif;padding:16px 20px;border-radius:12px;">${escapeHtml(b.label)}</a>
  </td></tr>`;
}

export function renderEmail(content: EmailContent): string {
  const details = content.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border:1px solid ${COLORS.line};border-radius:12px;border-collapse:separate;">
        ${content.details
          .map(
            (d, i) => `<tr>
          <td style="padding:12px 14px;${i ? `border-top:1px solid ${COLORS.line};` : ""}font:400 15px/1.4 Arial,Helvetica,sans-serif;color:${COLORS.muted};width:38%;vertical-align:top;">${escapeHtml(d.label)}</td>
          <td style="padding:12px 14px;${i ? `border-top:1px solid ${COLORS.line};` : ""}font:700 16px/1.4 Arial,Helvetica,sans-serif;color:${COLORS.ink};vertical-align:top;">${escapeHtml(d.value)}</td>
        </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const quote = content.quote
    ? `<div style="margin:0 0 20px;padding:14px 16px;background:#FBF7EF;border-left:4px solid ${COLORS.gold};border-radius:8px;">
        <p style="margin:0 0 6px;font:700 14px/1.3 Arial,Helvetica,sans-serif;color:${COLORS.muted};">${escapeHtml(content.quote.label)}</p>
        <p style="margin:0;font:400 16px/1.5 Arial,Helvetica,sans-serif;color:${COLORS.ink};white-space:pre-line;">${escapeHtml(content.quote.text)}</p>
      </div>`
    : "";

  const buttons = content.buttons?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;">${content.buttons.map(button).join("")}</table>`
    : "";

  const notes = (content.notes ?? [])
    .map(
      (n) =>
        `<p style="margin:0 0 10px;font:400 15px/1.5 Arial,Helvetica,sans-serif;color:${COLORS.muted};">${escapeHtml(n)}</p>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(content.heading)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(content.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 6px 14px;font:700 22px/1 Georgia,'Times New Roman',serif;color:${COLORS.brand};">Landy's <span style="font:700 12px/1 Arial,Helvetica,sans-serif;letter-spacing:.08em;color:${COLORS.gold};vertical-align:middle;">PRO</span></td></tr>
    <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:16px;padding:28px 22px;">
      <h1 style="margin:0 0 16px;font:700 25px/1.25 Georgia,'Times New Roman',serif;color:${COLORS.ink};">${escapeHtml(content.heading)}</h1>
      ${content.intro.map(paragraph).join("")}
      ${details}
      ${quote}
      ${buttons}
      ${notes}
    </td></tr>
    <tr><td style="padding:16px 8px 0;font:400 13px/1.5 Arial,Helvetica,sans-serif;color:${COLORS.muted};text-align:center;">
      ${escapeHtml(content.footer ?? "You are receiving this because you are listed as a pro on landys.co. Questions? Just reply to this email.")}
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

/** Plain-text twin of the HTML email. */
export function renderEmailText(content: EmailContent): string {
  const lines: string[] = [content.heading, "", ...content.intro.flatMap((p) => [p, ""])];
  if (content.details?.length) {
    for (const d of content.details) lines.push(`${d.label}: ${d.value}`);
    lines.push("");
  }
  if (content.quote) lines.push(`${content.quote.label}:`, `"${content.quote.text}"`, "");
  for (const b of content.buttons ?? []) lines.push(`${b.label}: ${b.href}`);
  if (content.buttons?.length) lines.push("");
  for (const n of content.notes ?? []) lines.push(n, "");
  lines.push("--", content.footer ?? "Landy's Pro - landys.co");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

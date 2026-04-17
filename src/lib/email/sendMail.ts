import nodemailer from "nodemailer";

function extractEmailAddress(header: string): string | null {
  const t = header.trim();
  const m = t.match(/<([^>]+)>/);
  const raw = (m ? m[1] : t).trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return raw;
  return null;
}

/** Many hosts accept the message but Gmail/others drop or spam if From ≠ authenticated identity. */
function warnIfFromDiffersFromSmtpUser(cfg: {
  from: string;
  user: string;
}): void {
  const fromAddr = extractEmailAddress(cfg.from);
  const userAddr = extractEmailAddress(cfg.user);
  if (!fromAddr || !userAddr || fromAddr === userAddr) return;
  console.warn(
    `[Outgoing email] From (${fromAddr}) differs from SMTP username (${userAddr}). ` +
      "Use the same address, or enable “Send mail as” / domain verification for that From at your provider. " +
      "Otherwise messages often never reach the inbox.",
  );
}

function htmlToPlainTextFallback(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Readable log after the mail server accepts the message. Search logs for: "Outgoing email" */
function logSmtpDelivery(
  meta: {
    subjectSnippet: string;
    from: string;
    envelopeTo: string;
    envelopeCc?: string;
    envelopeBcc?: string;
    replyTo?: string;
  },
  info: nodemailer.SentMessageInfo,
): void {
  const accepted = Array.isArray(info.accepted) ? info.accepted : [];
  const rejected = Array.isArray(info.rejected) ? info.rejected : [];
  const response =
    typeof info.response === "string" ? info.response : String(info.response ?? "");
  const when = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  const lines: string[] = [];
  lines.push("");
  lines.push("────────────────── Outgoing email (SMTP) ──────────────────");
  lines.push(`When:       ${when}`);
  lines.push(`From:       ${meta.from}`);
  if (meta.replyTo) {
    lines.push(`Reply-To:   ${meta.replyTo}`);
  }
  lines.push(`To:         ${meta.envelopeTo}`);
  if (meta.envelopeCc) lines.push(`Cc:         ${meta.envelopeCc}`);
  if (meta.envelopeBcc) lines.push(`Bcc:        ${meta.envelopeBcc}`);
  lines.push(`Subject:    ${meta.subjectSnippet}`);
  lines.push(`Server:     ${response || "—"}`);
  if (info.messageId) {
    lines.push(`Message id: ${String(info.messageId).replace(/[\r\n]/g, "")}`);
  }
  lines.push("");
  lines.push(
    accepted.length > 0
      ? `SMTP accepted (handoff to provider): ${accepted.join(", ")}`
      : "SMTP accepted (no recipient list returned by server).",
  );
  if (rejected.length > 0) {
    lines.push(`Rejected:   ${rejected.join(", ")}`);
  }
  lines.push("");
  lines.push(
    "Next: Recipients must still receive mail from their provider (Gmail, etc.). Check Spam/Promotions,",
  );
  lines.push(
    "and verify SPF/DKIM/DMARC for your From domain. If From ≠ SMTP login, the provider may drop mail.",
  );
  lines.push("────────────────────────────────────────────────────────────");
  console.info(lines.join("\n"));
  if (rejected.length > 0) {
    console.error(
      `[Outgoing email] Some addresses were rejected by SMTP: ${rejected.join(", ")}`,
    );
  }
}

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function mailFromDisplay(): string | undefined {
  const addr = process.env.MAIL_FROM_ADDRESS?.trim();
  const name = process.env.MAIL_FROM_NAME?.trim();
  if (name && addr) return `${name} <${addr}>`;
  if (addr) return addr;
  return undefined;
}

export function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim() || process.env.MAIL_HOST?.trim();
  const user = process.env.SMTP_USER?.trim() || process.env.MAIL_USERNAME?.trim();
  const pass = process.env.SMTP_PASS?.trim() || process.env.MAIL_PASSWORD?.trim();
  const portRaw = process.env.SMTP_PORT?.trim() || process.env.MAIL_PORT?.trim();
  const port = portRaw ? parseInt(portRaw, 10) : 587;
  if (!host || !user || !pass || Number.isNaN(port)) return null;

  const smtpSecureRaw = process.env.SMTP_SECURE?.trim().toLowerCase();
  const hasSmtpSecure = smtpSecureRaw === "1" || smtpSecureRaw === "true" || smtpSecureRaw === "0" || smtpSecureRaw === "false";
  let secure = smtpSecureRaw === "1" || smtpSecureRaw === "true";
  const enc = (process.env.MAIL_ENCRYPTION || "").trim().toLowerCase();
  if (!hasSmtpSecure) {
    if (enc === "ssl") secure = true;
    else if (enc === "tls") secure = false;
    else if (port === 465) secure = true;
  }

  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    mailFromDisplay() ||
    user;
  return { host, port, secure, user, pass, from };
}

export function isMailConfigured(): boolean {
  return getMailConfig() !== null;
}

function joinAddr(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const s = v.map((x) => x.trim()).filter(Boolean).join(", ");
    return s || undefined;
  }
  const t = v.trim();
  return t || undefined;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename?: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
  }>;
}): Promise<void> {
  const cfg = getMailConfig();
  if (!cfg) {
    throw new Error(
      "Email is not configured. Set MAIL_HOST, MAIL_PORT, MAIL_USERNAME, and MAIL_PASSWORD (or SMTP_* equivalents) in your environment.",
    );
  }
  warnIfFromDiffersFromSmtpUser(cfg);

  const smtpDebug = process.env.MAIL_SMTP_DEBUG?.trim() === "1";
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    ...(smtpDebug ? { debug: true, logger: true } : {}),
  });
  const cc = joinAddr(opts.cc);
  const bcc = joinAddr(opts.bcc);
  const replyTo = process.env.MAIL_REPLY_TO?.trim();
  const text = htmlToPlainTextFallback(opts.html);
  const info = await transporter.sendMail({
    from: cfg.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: text || undefined,
    ...(replyTo ? { replyTo } : {}),
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    ...(Array.isArray(opts.attachments) && opts.attachments.length > 0
      ? { attachments: opts.attachments }
      : {}),
  });
  logSmtpDelivery(
    {
      subjectSnippet: String(opts.subject).slice(0, 200),
      from: cfg.from,
      envelopeTo: opts.to,
      envelopeCc: cc,
      envelopeBcc: bcc,
      replyTo: replyTo || undefined,
    },
    info,
  );
  const rejected = Array.isArray(info.rejected) ? info.rejected : [];
  if (rejected.length > 0) {
    throw new Error(
      `SMTP rejected recipient(s): ${rejected.join(", ")}. Check addresses and provider rules.`,
    );
  }
}

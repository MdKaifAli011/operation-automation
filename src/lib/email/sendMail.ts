import nodemailer from "nodemailer";

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? parseInt(portRaw, 10) : 587;
  if (!host || !user || !pass || Number.isNaN(port)) return null;
  const secure = process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    user;
  return { host, port, secure, user, pass, from };
}

export function isMailConfigured(): boolean {
  return getMailConfig() !== null;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const cfg = getMailConfig();
  if (!cfg) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your environment.",
    );
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transporter.sendMail({
    from: cfg.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

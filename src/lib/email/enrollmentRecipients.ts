/**
 * Enrollment team addresses for BCC (e.g. demo invites, fee+enrollment bundle).
 * Set ENROLLMENT_TEAM_BCC in .env (comma, semicolon, or newline separated).
 * The `{{enrollmentLink}}` value in emails comes from `getEnrollmentFormLink()`
 * (`enrollmentFormLink.ts`), not from this module.
 */
export function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw.split(/[,;\n]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

export function getEnrollmentTeamBccEmails(): string[] {
  const raw =
    process.env.ENROLLMENT_TEAM_BCC?.trim() ||
    process.env.MAIL_ENROLLMENT_BCC?.trim() ||
    "";
  return parseEmailList(raw);
}

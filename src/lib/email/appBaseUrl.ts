/** Public origin for absolute links in outbound email (brochure PDF path, etc.). */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    "";
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

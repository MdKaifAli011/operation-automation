import { getAppBaseUrl } from "@/lib/email/appBaseUrl";

/**
 * Where `{{enrollmentLink}}` is resolved for pipeline emails (enrollment-only,
 * fee+enrollment bundle, etc.). The same rendered HTML goes to the student (To)
 * and enrollment team (BCC), so everyone sees this URL.
 *
 * Set one of (first match wins):
 * - ENROLLMENT_FORM_LINK — preferred
 * - ENROLLMENT_FORM_URL — legacy alias
 * - NEXT_PUBLIC_ENROLLMENT_FORM_LINK
 * - NEXT_PUBLIC_ENROLLMENT_FORM_URL
 *
 * If unset, falls back to `{APP_BASE_URL}/enroll-student` (see getAppBaseUrl).
 */
export function getEnrollmentFormLink(): string {
  const raw =
    process.env.ENROLLMENT_FORM_LINK?.trim() ||
    process.env.ENROLLMENT_FORM_URL?.trim() ||
    process.env.NEXT_PUBLIC_ENROLLMENT_FORM_LINK?.trim() ||
    process.env.NEXT_PUBLIC_ENROLLMENT_FORM_URL?.trim() ||
    "";
  if (!raw) {
    return `${getAppBaseUrl()}/enroll-student`;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const base = getAppBaseUrl();
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

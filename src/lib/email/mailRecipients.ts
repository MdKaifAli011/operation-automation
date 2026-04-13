/** Dedupes BCC against To/CC so the same address is not repeated. */
export function normalizeMailRecipients(
  to: string,
  cc?: string,
  bccList: string[] = [],
): { to: string; cc?: string; bcc?: string } {
  const toLower = to.trim().toLowerCase();
  const ccTrim = cc?.trim();
  const ccFinal =
    ccTrim && ccTrim.toLowerCase() !== toLower ? ccTrim : undefined;
  const ccLower = ccFinal?.toLowerCase() ?? "";
  const bccFiltered = bccList.filter((x) => {
    const z = x.trim().toLowerCase();
    return z && z !== toLower && z !== ccLower;
  });
  const bcc = bccFiltered.length > 0 ? bccFiltered.join(", ") : undefined;
  return { to: to.trim(), cc: ccFinal, bcc };
}

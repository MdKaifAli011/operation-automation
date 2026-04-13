/**
 * Pure string post-processing for rendered email HTML (client + server safe).
 * Used by send-email and the Email Templates preview so WYSIWYG matches delivery.
 */

const FEE_BANK_PLACEHOLDER_RE = /\{\{\s*feeBankDetailsHtml\s*\}\}/;

/** If the template omits {{feeBankDetailsHtml}}, append the bank block after the body. */
export function ensureFeeBankDetailsInRenderedHtml(
  templateBody: string,
  renderedHtml: string,
  feeBankDetailsHtml: string,
): string {
  const bank = feeBankDetailsHtml.trim();
  if (!bank) return renderedHtml;

  if (FEE_BANK_PLACEHOLDER_RE.test(String(templateBody))) {
    return renderedHtml;
  }
  if (renderedHtml.includes("{{feeBankDetailsHtml}}")) {
    return renderedHtml.replace(/\{\{\s*feeBankDetailsHtml\s*\}\}/g, bank);
  }
  const spacer = `<div style="margin-top:22px;"></div>`;
  return `${renderedHtml}${spacer}${bank}`;
}

const BROCHURE_BUNDLE_HTML_RE = /\{\{\s*brochureBundleHtml\s*\}\}/;

/** If the template omits {{brochureBundleHtml}}, append the document bundle. */
export function ensureBrochureBundleHtmlInRenderedHtml(
  templateBody: string,
  renderedHtml: string,
  brochureBundleHtml: string,
): string {
  const block = brochureBundleHtml.trim();
  if (!block) return renderedHtml;
  if (BROCHURE_BUNDLE_HTML_RE.test(String(templateBody))) return renderedHtml;
  if (renderedHtml.includes("{{brochureBundleHtml}}")) {
    return renderedHtml.replace(/\{\{\s*brochureBundleHtml\s*\}\}/g, block);
  }
  return `${renderedHtml}<div style="margin-top:20px;"></div>${block}`;
}

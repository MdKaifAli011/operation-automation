/**
 * Pure string post-processing for rendered email HTML (client + server safe).
 * Used by send-email and the Email Templates preview so WYSIWYG matches delivery.
 */

/** If the template omits {{feeBankDetailsHtml}}, append the bank block after the body. */
export function ensureFeeBankDetailsInRenderedHtml(
  templateBody: string,
  renderedHtml: string,
  feeBankDetailsHtml: string,
): string {
  const bank = feeBankDetailsHtml.trim();
  if (!bank) return renderedHtml;

  // Always try to replace the placeholder in rendered HTML
  if (renderedHtml.includes("{{feeBankDetailsHtml}}")) {
    return renderedHtml.replace(/\{\{\s*feeBankDetailsHtml\s*\}\}/g, bank);
  }
  
  // If placeholder not found in rendered HTML, append it before the footer
  // Look for the footer section (dark background div)
  const footerMatch = renderedHtml.match(/<div style="background:#0f2a4a;border-radius:0 0 14px 14px/);
  if (footerMatch) {
    const insertIndex = renderedHtml.indexOf(footerMatch[0]);
    const spacer = `<div style="margin-top:22px;"></div>`;
    return renderedHtml.slice(0, insertIndex) + spacer + bank + renderedHtml.slice(insertIndex);
  }
  
  const spacer = `<div style="margin-top:22px;"></div>`;
  return `${renderedHtml}${spacer}${bank}`;
}

/** If the template omits {{feeSummaryHtml}}, append the fee details block after the body. */
export function ensureFeeDetailsInRenderedHtml(
  templateBody: string,
  renderedHtml: string,
  feeDetailsHtml: string,
): string {
  const feeBlock = feeDetailsHtml.trim();
  if (!feeBlock) return renderedHtml;

  // Always try to replace the placeholder in rendered HTML
  if (renderedHtml.includes("{{feeSummaryHtml}}")) {
    return renderedHtml.replace(/\{\{\s*feeSummaryHtml\s*\}\}/g, feeBlock);
  }
  
  // If placeholder not found in rendered HTML, append it before the footer
  // Look for the footer section (dark background div)
  const footerMatch = renderedHtml.match(/<div style="background:#0f2a4a;border-radius:0 0 14px 14px/);
  if (footerMatch) {
    const insertIndex = renderedHtml.indexOf(footerMatch[0]);
    const spacer = `<div style="margin-top:22px;"></div>`;
    return renderedHtml.slice(0, insertIndex) + spacer + feeBlock + renderedHtml.slice(insertIndex);
  }
  
  const spacer = `<div style="margin-top:22px;"></div>`;
  return `${renderedHtml}${spacer}${feeBlock}`;
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

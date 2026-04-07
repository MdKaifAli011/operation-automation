/**
 * Replace `{{key}}` placeholders. Unknown keys stay unchanged.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, rawKey) => {
    const key = String(rawKey);
    if (key in vars) return vars[key] ?? "";
    return full;
  });
}

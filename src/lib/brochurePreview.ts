/** Normalize a brochure URL for preview (relative paths, https, or scheme-less). */
export function normalizeBrochurePreviewUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("/")) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function brochurePathLooksLikeImage(publicPath: string): boolean {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(publicPath);
}

export function brochureUrlLooksLikeImage(url: string): boolean {
  return /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(url);
}

/** PDF or image can use iframe/img; Office docs usually need download. */
export function brochureSrcIsLikelyEmbeddable(src: string): boolean {
  const s = src.trim().toLowerCase();
  if (brochurePathLooksLikeImage(src) || brochureUrlLooksLikeImage(src)) {
    return true;
  }
  if (/\.pdf(\?|#|$)/i.test(s)) return true;
  return false;
}

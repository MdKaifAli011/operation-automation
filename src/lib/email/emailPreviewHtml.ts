/**
 * Wrap rendered email HTML in a minimal document for iframe preview (client-only).
 */
export function buildEmailPreviewHtml(fragmentHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #212121; background: #fff; padding: 0; -webkit-font-smoothing: antialiased; }
    .inner { padding: 20px 18px 24px; }
    .inner pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; margin: 0; color: #37474f; }
    .inner a { color: #1565c0; text-decoration: underline; text-underline-offset: 2px; }
    .inner p { margin: 0 0 14px; }
    .inner p:last-child { margin-bottom: 0; }
    .inner strong { font-weight: 600; color: #1565c0; }
  </style></head><body><div class="inner">${fragmentHtml}</div></body></html>`;
}

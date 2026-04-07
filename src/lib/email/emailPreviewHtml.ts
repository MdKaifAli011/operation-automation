/**
 * Wrap rendered email HTML in a minimal document for iframe preview (client-only).
 */
export function buildEmailPreviewHtml(fragmentHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.55; color: #212121; background: #eceff1; padding: 12px; -webkit-font-smoothing: antialiased; }
    .wrap { max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #e0e0e0; }
    .inner { padding: 24px 20px; }
    .inner pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; margin: 0; }
    .inner a { color: #1565c0; }
    .inner p { margin: 0 0 12px; }
    .inner p:last-child { margin-bottom: 0; }
  </style></head><body><div class="wrap"><div class="inner">${fragmentHtml}</div></div></body></html>`;
}

/**
 * UUID v4 for browser/client code.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS or localhost).
 * Plain HTTP (e.g. LAN IP) omits it; this falls back to `getRandomValues` or a weak last resort.
 */
export function randomUuid(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 18)}`;
}

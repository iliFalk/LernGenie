/**
 * crypto.randomUUID() is only exposed in a secure context (https or localhost).
 * The app is served over plain http from a LAN address, which is not a secure
 * context: `crypto.randomUUID` is undefined there and calling it throws.
 *
 * This helper keeps the native implementation when it exists and otherwise
 * builds a v4 UUID from crypto.getRandomValues(), which is available in every
 * context. The fallback is used when the app is opened at e.g.
 * http://192.168.178.100:3001.
 */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set the version (4) and variant (RFC 4122) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

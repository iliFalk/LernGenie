/**
 * navigator.clipboard is only available in a secure context (https or
 * localhost). The app is served over plain http from a LAN address, so
 * `navigator.clipboard` is undefined there and calling `.writeText()` throws.
 *
 * This helper uses the Clipboard API when it exists and otherwise falls back to
 * a hidden textarea plus document.execCommand("copy"), which works in every
 * context. The fallback runs inside the click handler, so the browser still
 * treats it as a user gesture.
 */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(area);
  }
}

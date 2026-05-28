/**
 * URL hardening for user-supplied values that we render as `href`.
 *
 * Without this, a user (or malicious bulk-import) could store
 * `javascript:alert(document.cookie)` as a jobLink — clicking would execute.
 * We only allow http/https, and only after URL constructor validates the shape.
 */

export type SafeUrl = {
  href: string;
  hostname: string;
};

export function safeHttpUrl(raw: string | null | undefined): SafeUrl | null {
  if (!raw || typeof raw !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return { href: parsed.toString(), hostname: parsed.hostname };
}

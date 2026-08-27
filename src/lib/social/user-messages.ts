/**
 * Translates raw backend/integration errors into calm, user-facing language.
 *
 * Customers must never see configuration, credential, token or infrastructure
 * vocabulary. Anything technical is redacted here and only ever surfaced in the
 * administrator diagnostics area.
 */

const TECHNICAL_PATTERNS = [
  /api[\s_-]?key/i,
  /client[\s_-]?(id|secret)/i,
  /credential/i,
  /oauth/i,
  /access[\s_-]?token/i,
  /refresh[\s_-]?token/i,
  /jwt/i,
  /environment variable/i,
  /env\b/i,
  /secret/i,
  /supabase/i,
  /ayrshare/i,
  /webhook/i,
  /endpoint/i,
  /not configured/i,
  /configuration/i,
  /administrator/i,
  /developer/i,
  /redirect[\s_-]?uri/i,
  /scope/i,
  /\b(4\d\d|5\d\d)\b/,
];

export interface FriendlyError {
  /** Safe headline shown on the card. */
  message: string;
  /** Human-readable explanation behind a "More details" disclosure. */
  details: string;
}

export function friendlyConnectionError(raw: unknown, platformName: string): FriendlyError {
  const text = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "";
  const technical = !text || TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));

  if (technical) {
    return {
      message: `${platformName} connection isn't available right now.`,
      details:
        "We couldn't reach this platform on your behalf yet. It's not something you need to fix — please try again a little later.",
    };
  }

  return {
    message: "We couldn't connect right now.",
    details: text,
  };
}

export function friendlySyncError(raw: unknown, platformName: string): FriendlyError {
  const base = friendlyConnectionError(raw, platformName);
  return {
    message: `We couldn't refresh ${platformName} just now.`,
    details: base.details,
  };
}

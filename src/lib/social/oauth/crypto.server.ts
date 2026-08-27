/**
 * Credential encryption for stored platform authorizations. Server-only.
 *
 * Authorization credentials are never stored in plaintext and never leave the
 * server. The encryption key is derived from server-side key material that the
 * browser has no access to.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function cryptoKey(): Buffer {
  const seed =
    process.env["SOCIALPULSE_TOKEN_KEY"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_DB_URL"];
  if (!seed) throw new Error("No server key material available to encrypt platform credentials.");
  return createHash("sha256").update(seed).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", cryptoKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/** URL-safe random string used for handshake state and PKCE verifiers. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

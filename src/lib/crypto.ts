// ════════════════════════════════════════════════════════════════════════════
//  crypto — encrypt secrets at rest (SERVER ONLY)
//  AES-256-GCM, keyed by TOKEN_ENCRYPTION_KEY. Used for OAuth refresh tokens.
//  Fail-open + backward-compatible:
//   - No key set → returns plaintext (so setup still works; same as before).
//   - Legacy plaintext values (no "enc:v1:" prefix) are returned as-is on decrypt.
//  Ciphertext format: enc:v1:<iv b64>:<authTag b64>:<ciphertext b64>
// ════════════════════════════════════════════════════════════════════════════
import crypto from "crypto";

const ALGO   = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) return null;
  // Accept a 64-char hex key (32 bytes) directly, else derive 32 bytes via SHA-256.
  return /^[0-9a-fA-F]{64}$/.test(k) ? Buffer.from(k, "hex") : crypto.createHash("sha256").update(k).digest();
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  if (!key || !plain) return plain;
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct     = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = getKey();
  if (!key) return stored; // can't decrypt without the key
  try {
    const [, , ivB, tagB, ctB] = stored.split(":");
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return stored;
  }
}

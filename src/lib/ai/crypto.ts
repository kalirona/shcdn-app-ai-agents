import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const KEY_ENV = "AI_API_KEY_ENCRYPTION_KEY";

function getEncryptionKey(): Buffer {
  const secret = process.env[KEY_ENV];
  if (!secret) {
    throw new Error(`${KEY_ENV} must be set. Generate with: openssl rand -base64 32`);
  }
  return createHash("sha256").update(secret).digest();
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptApiKey(ciphertext: string): string {
  try {
    const buf = Buffer.from(ciphertext, "base64url");
    if (buf.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error("Invalid ciphertext length");
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (error) {
    console.error("[ai-crypto] Failed to decrypt API key:", error);
    throw new Error("Failed to decrypt API key. Check AI_API_KEY_ENCRYPTION_KEY.");
  }
}

/**
 * Check if a string looks like an encrypted API key (base64url with proper length).
 */
export function isEncryptedApiKey(value: string | null): boolean {
  if (!value || typeof value !== "string") return false;
  try {
    const buf = Buffer.from(value, "base64url");
    return buf.length >= IV_LENGTH + TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

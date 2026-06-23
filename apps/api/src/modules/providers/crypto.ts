import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const b64 = process.env.AGENTRY_CREDENTIALS_KEY;
  if (!b64) throw new Error("AGENTRY_CREDENTIALS_KEY is not set -- required to store/read provider secrets");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("AGENTRY_CREDENTIALS_KEY must decode to exactly 32 bytes (openssl rand -base64 32)");
  return key;
}

/** Encrypts a plaintext secret (e.g. a provider API key) for storage in
 * `provider_configs.encrypted_secret`. Format: "iv:authTag:ciphertext" (all hex).
 * Protects against DB/backup leakage, not against API-host compromise --
 * see docs/12-security-and-auth.md for the explicit threat-model line. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf-8");
}

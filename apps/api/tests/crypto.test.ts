import { beforeAll, describe, expect, it } from "vitest";

describe("provider secret encryption", () => {
  beforeAll(() => {
    process.env.AGENTRY_CREDENTIALS_KEY = "zmhigIpNWft1GWylHOIX79mDbm4ad1492W6KoIzWBPQ="; // test-only 32-byte key
  });

  it("round-trips a plaintext secret through encrypt/decrypt", async () => {
    const { encryptSecret, decryptSecret } = await import("../src/modules/providers/crypto.js");
    const plaintext = "sk-super-secret-api-key-123";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("stores ciphertext as iv:authTag:ciphertext hex triples", async () => {
    const { encryptSecret } = await import("../src/modules/providers/crypto.js");
    const encrypted = encryptSecret("anything");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) expect(part).toMatch(/^[0-9a-f]+$/);
  });
});

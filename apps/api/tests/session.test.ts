import { describe, expect, it } from "vitest";
import { hashToken } from "../src/auth/session.js";

describe("hashToken", () => {
  it("is deterministic sha256 hex", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

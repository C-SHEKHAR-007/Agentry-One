import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devMocksEnabled, signState, verifyState } from "../src/auth/oauthState.js";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("OAuth state signing", () => {
  beforeEach(() => {
    vi.stubEnv("AGENTRY_CREDENTIALS_KEY", KEY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("round-trips a signed payload", () => {
    const state = signState({ platform: "x", projectId: "p1" });
    expect(verifyState(state)).toMatchObject({ platform: "x", projectId: "p1" });
  });

  it("rejects the old unsigned base64 JSON format", () => {
    const forged = Buffer.from(JSON.stringify({ platform: "x", projectId: "victim" })).toString("base64url");
    expect(verifyState(forged)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [, sig] = signState({ projectId: "mine" }).split(".");
    const body = Buffer.from(JSON.stringify({ projectId: "victim", iat: Date.now() })).toString("base64url");
    expect(verifyState(`${body}.${sig}`)).toBeNull();
  });

  it("rejects state signed with a different key", () => {
    const state = signState({ projectId: "p1" });
    vi.stubEnv("AGENTRY_CREDENTIALS_KEY", Buffer.alloc(32, 9).toString("base64"));
    expect(verifyState(state)).toBeNull();
  });

  it("rejects expired state", () => {
    vi.useFakeTimers();
    const state = signState({ projectId: "p1" });
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(verifyState(state)).toBeNull();
  });

  it("rejects missing or malformed state", () => {
    expect(verifyState(undefined)).toBeNull();
    expect(verifyState("")).toBeNull();
    expect(verifyState("not-a-state")).toBeNull();
  });
});

describe("devMocksEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless explicitly enabled", () => {
    vi.stubEnv("AGENTRY_DEV_MOCKS", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(devMocksEnabled()).toBe(false);
  });

  it("is on when opted into outside production", () => {
    vi.stubEnv("AGENTRY_DEV_MOCKS", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(devMocksEnabled()).toBe(true);
  });

  it("can never be enabled in production", () => {
    vi.stubEnv("AGENTRY_DEV_MOCKS", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(devMocksEnabled()).toBe(false);
  });
});

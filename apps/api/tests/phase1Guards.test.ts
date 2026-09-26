import { afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { assertSafeOutboundUrl, UnsafeUrlError } from "../src/http/ssrf.js";
import { validateCron, ScheduleError } from "../src/modules/templates/scheduler.js";
import { validateStepInput } from "../src/modules/workflows/inputValidation.js";
import { validateEnv } from "../src/config.js";
import { ARTIFACTS_DIR, resolveArtifactPath } from "../src/modules/artifacts/storage.js";
import { parse, ValidationError, z } from "../src/http/validate.js";

describe("assertSafeOutboundUrl (SSRF guard)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://[fe80::1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://0.0.0.0:4000/",
  ])("always blocks metadata / link-local targets: %s", async (url) => {
    await expect(assertSafeOutboundUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it.each(["http://10.0.0.5/", "http://192.168.1.10:8080/", "http://172.20.0.1/"])(
    "blocks private networks that aren't allowlisted: %s",
    async (url) => {
      await expect(assertSafeOutboundUrl(url)).rejects.toThrow(/private address/);
    },
  );

  it("allows loopback for the default local-provider allowlist (Ollama)", async () => {
    await expect(assertSafeOutboundUrl("http://127.0.0.1:11434")).resolves.toBeInstanceOf(URL);
  });

  it("allows an explicitly allowlisted private host", async () => {
    vi.stubEnv("PROVIDER_PRIVATE_HOSTS", "10.0.0.5");
    await expect(assertSafeOutboundUrl("http://10.0.0.5/v1")).resolves.toBeInstanceOf(URL);
  });

  it("allows public IP literals", async () => {
    await expect(assertSafeOutboundUrl("https://8.8.8.8/")).resolves.toBeInstanceOf(URL);
  });

  it("rejects non-http schemes and embedded credentials", async () => {
    await expect(assertSafeOutboundUrl("file:///etc/passwd")).rejects.toThrow(/http or https/);
    await expect(assertSafeOutboundUrl("ftp://8.8.8.8/")).rejects.toThrow(/http or https/);
    await expect(assertSafeOutboundUrl("https://u:p@8.8.8.8/")).rejects.toThrow(/credentials/);
    await expect(assertSafeOutboundUrl("not a url")).rejects.toThrow(/valid URL/);
  });
});

describe("validateCron", () => {
  it("accepts a normal schedule", () => {
    expect(() => validateCron("0 9 * * 2")).not.toThrow();
  });
  it("rejects garbage", () => {
    expect(() => validateCron("every tuesday")).toThrow(ScheduleError);
  });
  it("rejects sub-minute schedules", () => {
    expect(() => validateCron("*/5 * * * * *")).toThrow(/once per minute/);
  });
});

describe("validateStepInput", () => {
  const step = {
    key: "generate",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", minLength: 1 },
        steps: { type: "integer", default: 2, minimum: 1, maximum: 4 },
      },
    },
  } as never;

  it("accepts valid input and fills defaults", () => {
    const input: Record<string, unknown> = { prompt: "a cat" };
    expect(validateStepInput("sketch", step, input)).toBeNull();
    expect(input.steps).toBe(2);
  });

  it("reports missing and out-of-range fields", () => {
    expect(validateStepInput("sketch", step, {})).toMatch(/prompt/);
    expect(validateStepInput("sketch", step, { prompt: "x", steps: 50 })).toMatch(/<= 4/);
  });

  it("skips validation when a step has no schema", () => {
    expect(validateStepInput("x", { key: "run", inputSchema: undefined } as never, { anything: 1 })).toBeNull();
  });
});

describe("validateEnv", () => {
  const good = {
    DATABASE_URL: "postgresql://x",
    AGENTRY_API_KEY: "a-long-enough-api-key",
    AGENTRY_CREDENTIALS_KEY: Buffer.alloc(32, 1).toString("base64"),
  };

  it("accepts a complete configuration", () => {
    expect(() => validateEnv(good)).not.toThrow();
  });
  it("names every missing/invalid variable", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*AGENTRY_API_KEY[\s\S]*AGENTRY_CREDENTIALS_KEY/);
    expect(() => validateEnv({ ...good, AGENTRY_CREDENTIALS_KEY: "c2hvcnQ=" })).toThrow(/32 bytes/);
  });
  it("refuses dev mocks in production", () => {
    expect(() => validateEnv({ ...good, NODE_ENV: "production", AGENTRY_DEV_MOCKS: "true" })).toThrow(/AGENTRY_DEV_MOCKS/);
  });
});

describe("resolveArtifactPath", () => {
  it("resolves keys inside ARTIFACTS_DIR", () => {
    expect(resolveArtifactPath(path.join(ARTIFACTS_DIR, "wf", "a.png"))).toBe(path.join(ARTIFACTS_DIR, "wf", "a.png"));
    expect(resolveArtifactPath("wf/a.png")).toBe(path.join(ARTIFACTS_DIR, "wf", "a.png"));
  });
  it("refuses keys that escape ARTIFACTS_DIR", () => {
    expect(resolveArtifactPath("/etc/shadow")).toBeNull();
    expect(resolveArtifactPath("../../etc/passwd")).toBeNull();
    expect(resolveArtifactPath(ARTIFACTS_DIR + "-evil/x")).toBeNull();
  });
});

describe("parse", () => {
  it("throws a 400 ValidationError with field paths", () => {
    try {
      parse(z.object({ name: z.string().min(1) }), { name: "" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).statusCode).toBe(400);
      expect((err as ValidationError).message).toMatch(/^name:/);
    }
  });
});

describe("assertSafeOutboundUrl IPv4-mapped IPv6", () => {
  it.each(["http://[::ffff:a9fe:a9fe]/", "http://[::ffff:10.0.0.1]/", "http://[0:0:0:0:0:ffff:a9fe:a9fe]/"])(
    "judges %s as the IPv4 it carries",
    async (url) => {
      await expect(assertSafeOutboundUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
    },
  );
});

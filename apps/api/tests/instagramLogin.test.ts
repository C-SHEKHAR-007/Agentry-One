import Fastify from "fastify";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { instagramHelper } from "../src/modules/integrations/instagramHelper.js";
import { instagramLoginRoutes } from "../src/modules/integrations/routes.js";

// A stand-in for scripts/instagram_browser_login.py.
let helperUrl = "";
const received: Array<{ method: string; url: string; body: string }> = [];
const fakeHelper = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    received.push({ method: req.method!, url: req.url!, body });
    const json = (code: number, data: unknown) => res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(data));
    if (req.url === "/status") return json(200, { ready: true, service: "agentry-instagram-helper", session_status: "in_progress" });
    if (req.url === "/login/start") return json(200, { started: true, status: "in_progress" });
    if (req.url === "/login/status") return json(200, { status: "success", handle: "@agentry", error: null, elapsed: 12, secret: "x" });
    if (req.url === "/login/cancel") return json(200, { canceled: true });
    json(404, {});
  });
});

beforeAll(async () => {
  await new Promise<void>((r) => fakeHelper.listen(0, "127.0.0.1", r));
  helperUrl = `http://127.0.0.1:${(fakeHelper.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => fakeHelper.close(() => r())));

async function appWith(url: string, allowed = true) {
  const app = Fastify();
  await app.register(instagramLoginRoutes, {
    helper: instagramHelper(url, 1000),
    canUseProject: async (_req, reply, projectId) => {
      if (allowed && projectId === "p1") return true;
      reply.code(404).send({ error: "project_not_found" });
      return false;
    },
  });
  return app;
}

const BASE = "/integrations/instagram/browser-login";

describe("Instagram login helper proxy", () => {
  it("reports the helper's status", async () => {
    const app = await appWith(helperUrl);
    const res = await app.inject({ method: "GET", url: `${BASE}/status` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ online: true, ready: true, session: "in_progress" });
  });

  it("starts a login for a project the user can access", async () => {
    const app = await appWith(helperUrl);
    const res = await app.inject({ method: "POST", url: `${BASE}/start`, payload: { projectId: "p1" } });
    expect(res.statusCode).toBe(200);
    const call = received.find((r) => r.url === "/login/start")!;
    expect(call.method).toBe("POST");
    expect(JSON.parse(call.body)).toEqual({ projectId: "p1" });
  });

  it("refuses a project the user can't access, without calling the helper", async () => {
    const app = await appWith(helperUrl, false);
    const before = received.length;
    const res = await app.inject({ method: "POST", url: `${BASE}/start`, payload: { projectId: "p1" } });
    expect(res.statusCode).toBe(404);
    expect(received.length).toBe(before);
  });

  it("passes on only the progress fields", async () => {
    const app = await appWith(helperUrl);
    const res = await app.inject({ method: "GET", url: `${BASE}/session` });
    expect(res.json()).toEqual({ status: "success", handle: "@agentry", error: null, elapsed: 12 });
  });

  it("cancels", async () => {
    const app = await appWith(helperUrl);
    const res = await app.inject({ method: "POST", url: `${BASE}/cancel` });
    expect(res.json()).toEqual({ canceled: true });
    expect(received.at(-1)?.url).toBe("/login/cancel");
  });

  describe("when the helper isn't running", () => {
    const offline = "http://127.0.0.1:9"; // discard port: connection refused

    it("status says offline instead of failing", async () => {
      const app = await appWith(offline);
      const res = await app.inject({ method: "GET", url: `${BASE}/status` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ online: false, ready: false, session: "idle" });
    });

    it.each([
      ["POST", "start", { projectId: "p1" }],
      ["GET", "session", undefined],
      ["POST", "cancel", undefined],
    ] as const)("%s %s answers 503 helper_offline", async (method, path, payload) => {
      const app = await appWith(offline);
      const res = await app.inject({ method, url: `${BASE}/${path}`, payload });
      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe("helper_offline");
    });
  });
});

// Records every /api request each page makes: on load (first LOAD_MS) and
// while idle afterwards (IDLE_MS). Used to check a refactor doesn't add
// duplicate fetches or polling. Paths are normalised (ids -> :id, query
// values dropped) so runs can be diffed.
//
//   E2E_BASE_URL=http://localhost:5175 E2E_EMAIL=... E2E_PASSWORD=... \
//     node tools/request-audit.mjs out.json
//   node tools/request-audit.mjs --diff before.json after.json
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const norm = (url) => {
  const u = new URL(url);
  const path = u.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, ":id").replace(/\/(custom-[\w-]+)/g, "/:agent");
  const keys = [...u.searchParams.keys()].sort();
  return path + (keys.length ? `?${keys.join("&")}` : "");
};
const count = (list) => list.reduce((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});

if (process.argv[2] === "--diff") {
  const [a, b] = [JSON.parse(readFileSync(process.argv[3], "utf8")), JSON.parse(readFileSync(process.argv[4], "utf8"))];
  let problems = 0;
  for (const page of Object.keys({ ...a, ...b })) {
    for (const phase of ["load", "idle"]) {
      const x = a[page]?.[phase] ?? {}, y = b[page]?.[phase] ?? {};
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if ((x[k] ?? 0) !== (y[k] ?? 0)) {
          const more = (y[k] ?? 0) > (x[k] ?? 0);
          if (more) problems++;
          console.log(`${more ? "MORE" : "less"}  ${page.padEnd(28)} ${phase.padEnd(5)} ${k}: ${x[k] ?? 0} -> ${y[k] ?? 0}`);
        }
      }
    }
  }
  console.log(problems ? `\n${problems} request pattern(s) increased` : "\nno increases");
  process.exit(problems ? 1 : 0);
}

const base = process.env.E2E_BASE_URL ?? "http://localhost:5175";
const LOAD_MS = Number(process.env.LOAD_MS ?? 4000);
const IDLE_MS = Number(process.env.IDLE_MS ?? 20000);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base + "/login");
await page.locator('input[type="email"]').fill(process.env.E2E_EMAIL);
await page.locator('input[type="password"]').fill(process.env.E2E_PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(base + "/");

const get = async (p) => (await page.request.get(base + "/api" + p)).json();
const runs = await get("/template-runs?status=all&limit=1");
const wfs = await get("/workflows/recent?limit=1");
const tpls = await get("/templates");
const projects = await get("/projects");
const routes = [
  "/", "/studio", "/projects", projects[0] && `/projects/${projects[0].id}`, "/agents", "/agents/sketch-agent",
  "/agents/sketch-agent/submit", "/agents/create-skill", "/builder", tpls[0] && `/templates/${tpls[0].id}/edit`,
  tpls[0] && `/templates/${tpls[0].id}/run`, runs[0] && `/template-runs/${runs[0].id}`, "/runs", "/runs?type=agents",
  wfs[0] && `/workflows/${wfs[0].id}`, "/artifacts", "/prompts", "/integrations", "/analytics", "/costs", "/team",
  "/providers", "/settings", "/profile",
].filter(Boolean);

const out = {};
let bucket = null;
page.on("request", (r) => {
  if (bucket && new URL(r.url()).pathname.startsWith("/api/") && !r.url().includes("/stream")) bucket.push(norm(r.url()));
});
for (const route of routes) {
  const key = route.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id");
  const load = [], idle = [];
  bucket = load;
  await page.goto(base + route);
  await page.waitForTimeout(LOAD_MS);
  bucket = idle;
  await page.waitForTimeout(IDLE_MS);
  bucket = null;
  out[key] = { load: count(load), idle: count(idle) };
  console.log(key.padEnd(30), "load", load.length, "idle", idle.length);
}
writeFileSync(process.argv[2] ?? "request-audit.json", JSON.stringify(out, null, 2));
await browser.close();

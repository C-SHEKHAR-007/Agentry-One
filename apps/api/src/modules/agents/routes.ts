import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { wireQueueListeners } from "../../queue/listener.js";
import { AGENTS_DIR } from "./manifestScanner.js";
import { syncAgentRegistry } from "./registry.js";
import {
  AGENT_ID_RE,
  buildScaffoldFiles,
  validateScaffoldSpec,
  type ScaffoldSpec,
} from "./scaffold.js";

// Concurrent rescans share one in-flight scan instead of stacking.
let rescanInFlight: Promise<Awaited<ReturnType<typeof syncAgentRegistry>>> | null = null;

async function rescanRegistry() {
  if (!rescanInFlight) {
    rescanInFlight = syncAgentRegistry().finally(() => {
      rescanInFlight = null;
    });
  }
  const manifests = await rescanInFlight;
  for (const m of manifests) wireQueueListeners(m.entrypoint.queueName);
  return manifests;
}

export async function agentsRoutes(app: FastifyInstance) {
  app.get("/agents", async () => {
    const agents = await prisma.agent.findMany({ orderBy: { id: "asc" } });
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      version: a.version,
      description: a.description,
      status: a.status,
      discoveredAt: a.discoveredAt,
    }));
  });

  app.get<{ Params: { id: string } }>("/agents/:id", async (req, reply) => {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!agent) return reply.code(404).send({ error: "agent_not_found" });
    return agent;
  });

  app.post("/agents/rescan", async () => {
    const manifests = await rescanRegistry();
    return { agents: manifests.map((m) => ({ id: m.id, version: m.version })) };
  });

  app.post<{ Body: ScaffoldSpec }>("/agents/scaffold", async (req, reply) => {
    const spec = req.body;
    const errors = validateScaffoldSpec(spec);
    if (errors.length > 0) return reply.code(400).send({ error: errors.join("; ") });

    // Path safety: the id already matched the slug regex, but assert the
    // resolved directory stays inside AGENTS_DIR anyway.
    const agentsRoot = path.resolve(AGENTS_DIR);
    const dir = path.resolve(agentsRoot, spec.id);
    if (!AGENT_ID_RE.test(spec.id) || !dir.startsWith(agentsRoot + path.sep)) {
      return reply.code(400).send({ error: "invalid agent id" });
    }

    try {
      // Non-recursive: EEXIST means an agent (or any dir) with this id exists.
      await mkdir(dir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EEXIST") {
        return reply.code(409).send({ error: `agents/${spec.id} already exists` });
      }
      if (code === "EACCES" || code === "EROFS") {
        return reply.code(500).send({
          error:
            "agents directory is read-only (docker-compose mounts it :ro) -- scaffolding requires the API running from the repo (local dev)",
        });
      }
      throw err;
    }

    const files = buildScaffoldFiles(spec);
    await mkdir(path.join(dir, "schemas"), { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      await writeFile(path.join(dir, rel), content, "utf-8");
    }

    await rescanRegistry();
    const agent = await prisma.agent.findUnique({ where: { id: spec.id } });

    return reply.code(201).send({
      agent,
      files: Object.keys(files).map((f) => `agents/${spec.id}/${f}`),
      workerCommand: `python agents/${spec.id}/worker.py`,
    });
  });
}

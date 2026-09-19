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
import { getDefaultUserId } from "../projects/defaultUser.js";

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

  app.post<{
    Body: {
      name: string;
      description?: string;
      systemPrompt: string;
      capabilityKey?: string;
      modelId?: string;
      inputTypes?: string[];
      outputTypes?: string[];
      inputSchema?: any;
      outputSchema?: any;
      humanGate?: boolean;
    };
  }>("/agents/custom", async (req, reply) => {
    const {
      name,
      description = "",
      systemPrompt,
      capabilityKey = "text-generation",
      modelId,
      inputTypes = ["text"],
      outputTypes = ["text"],
      inputSchema,
      outputSchema,
      humanGate = false,
    } = req.body;

    if (!name || !systemPrompt) {
      return reply.code(400).send({ error: "name and systemPrompt are required" });
    }

    // Generate slugified ID
    const id = "custom-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();

    const queueName = capabilityKey === "web-search" ? "agent.web-search" : "agent.dynamic";

    const manifest = {
      id,
      name,
      version: "1.0",
      description,
      isCustom: true,
      entrypoint: { queueName },
      steps: [
        {
          key: "run",
          description: description || `Run ${name}`,
          humanGate: Boolean(humanGate),
          requiresCapability: capabilityKey,
          consumesArtifactKinds: inputTypes,
          producesArtifactKinds: outputTypes,
          inputSchema: inputSchema || {
            type: "object",
            properties: {
              prompt: { type: "string", title: "Prompt / Input" },
            },
          },
          outputSchema: outputSchema || {
            type: "object",
            properties: {
              text: { type: "string" },
            },
          },
          ui_config: {
            system_prompt: systemPrompt,
            model_id: modelId,
            input_types: inputTypes,
            output_types: outputTypes,
          },
        },
      ],
    };

    const agent = await prisma.agent.create({
      data: {
        id,
        name,
        version: "1.0",
        description,
        manifest: manifest as any,
        status: "active",
      },
    });

    const userId = (req as any).principal?.kind === "user" ? (req as any).principal.user.id : getDefaultUserId();
    await prisma.notification.create({
      data: {
        userId,
        type: "success",
        title: "Agent Created",
        message: `Agent "${name}" was created successfully.`,
        link: `/agents/${id}`
      }
    });

    wireQueueListeners(queueName);
    return reply.code(201).send(agent);
  });

  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      modelId?: string;
      inputTypes?: string[];
      outputTypes?: string[];
      inputSchema?: any;
    };
  }>("/agents/:id", async (req, reply) => {
    const existing = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: "agent_not_found" });

    const manifest = existing.manifest as any;
    if (req.body.name) manifest.name = req.body.name;
    if (req.body.description !== undefined) manifest.description = req.body.description;
    if (req.body.systemPrompt && manifest.steps?.[0]?.ui_config) {
      manifest.steps[0].ui_config.system_prompt = req.body.systemPrompt;
    }
    if (req.body.modelId && manifest.steps?.[0]?.ui_config) {
      manifest.steps[0].ui_config.model_id = req.body.modelId;
    }
    if (req.body.outputTypes && manifest.steps?.[0]) {
      manifest.steps[0].producesArtifactKinds = req.body.outputTypes;
    }

    const updated = await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name || existing.name,
        description: req.body.description !== undefined ? req.body.description : existing.description,
        manifest,
      },
    });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/agents/:id", async (req, reply) => {
    await prisma.agent.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}


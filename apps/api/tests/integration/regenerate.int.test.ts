import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/db/client.js";

// Starting an agent enqueues a real job; record what it would have been given instead.
const started: Array<{ agentId: string; params: Record<string, unknown> }> = [];
vi.mock("../../src/modules/workflows/service.js", () => ({
  startWorkflow: async (projectId: string, agentId: string, params: Record<string, unknown>) => {
    started.push({ agentId, params });
    return prisma.workflow.create({ data: { projectId, agentId, agentVersion: "1.0.0", inputParams: params as object, status: "running" } });
  },
}));

const { retryTemplateRun } = await import("../../src/modules/templates/service.js");
const { loadRunFamily, stepVersions } = await import("../../src/modules/templates/runVersions.js");

// Integration test: needs a migrated Postgres at DATABASE_URL and writes seed
// rows to it -- run with `npm run test:integration` against a disposable DB.
describe("regenerate one output and variants", () => {
  const tag = randomUUID().slice(0, 8);
  let runId = "";
  let captionStepId = "";
  let publishStepId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `regen-${tag}@test.local` } });
    const project = await prisma.project.create({ data: { userId: user.id, name: `regen ${tag}` } });
    for (const id of [`writer-${tag}`, `publisher-${tag}`]) {
      await prisma.agent.create({ data: { id, version: "1.0.0", name: id, description: "", manifest: { steps: [] } } });
    }
    const template = await prisma.template.create({ data: { projectId: project.id, name: "Post" } });
    const step = (stepOrder: number, agentId: string, inputMapping: object) =>
      prisma.templateStep.create({
        data: { templateId: template.id, stepOrder, agentId, agentVersion: "1.0.0", agentStepKey: "run", producesArtifactKindsSnapshot: ["text"], inputSchemaSnapshot: {}, inputMapping },
      });
    const caption = await step(0, `writer-${tag}`, { prompt: { kind: "fromRunInput", field: "topic" } });
    const publish = await step(1, `publisher-${tag}`, { text: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } });
    captionStepId = caption.id;
    publishStepId = publish.id;

    // A finished run: both steps completed.
    const run = await prisma.templateRun.create({ data: { templateId: template.id, status: "completed", runInputs: { topic: "autumn sale" } } });
    runId = run.id;
    for (const s of [caption, publish]) {
      const wf = await prisma.workflow.create({ data: { projectId: project.id, agentId: s.agentId, agentVersion: "1.0.0", inputParams: {}, status: "completed" } });
      await prisma.templateRunStep.create({ data: { templateRunId: run.id, templateStepId: s.id, workflowId: wf.id, status: "completed" } });
    }
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { name: `regen ${tag}` } });
    await prisma.agent.deleteMany({ where: { id: { in: [`writer-${tag}`, `publisher-${tag}`] } } });
    await prisma.user.deleteMany({ where: { email: `regen-${tag}@test.local` } });
  });

  it("regenerates only the caption, with the note on its prompt, and keeps the publish step", async () => {
    const retry = await retryTemplateRun(runId, 0, { onlyStep: true, note: "make it shorter" });
    expect(started).toEqual([{ agentId: `writer-${tag}`, params: { prompt: "autumn sale\n\nRevision note: make it shorter" } }]);

    const steps = await prisma.templateRunStep.findMany({ where: { templateRunId: retry.id } });
    const caption = steps.find((s) => s.templateStepId === captionStepId)!;
    const publish = steps.find((s) => s.templateStepId === publishStepId)!;
    expect(caption).toMatchObject({ status: "running", note: "make it shorter", reusedFromStepId: null });
    expect(publish.status).toBe("completed");
    expect(publish.reusedFromStepId).not.toBeNull();
  });

  it("lists the caption's versions across the run family once they finish", async () => {
    await prisma.templateRunStep.updateMany({ where: { templateStepId: captionStepId, status: "running" }, data: { status: "completed" } });
    const versions = stepVersions(await loadRunFamily(runId));
    expect(versions[captionStepId]).toHaveLength(2);
    expect(versions[publishStepId]).toHaveLength(1);
  });

  it("refuses a note on a step without a prompt, and onlyStep on an unfinished run", async () => {
    await expect(retryTemplateRun(runId, 1, { onlyStep: true, note: "louder" })).rejects.toThrow(/no prompt/);
    await expect(retryTemplateRun(runId, undefined, { onlyStep: true })).rejects.toThrow(/pick the step/);
    const unfinished = await prisma.templateRun.create({ data: { templateId: (await prisma.templateStep.findUniqueOrThrow({ where: { id: captionStepId } })).templateId, status: "failed", runInputs: {} } });
    await prisma.templateRunStep.createMany({
      data: [
        { templateRunId: unfinished.id, templateStepId: captionStepId, status: "completed" },
        { templateRunId: unfinished.id, templateStepId: publishStepId, status: "failed" },
      ],
    });
    await expect(retryTemplateRun(unfinished.id, 0, { onlyStep: true })).rejects.toThrow(/only a finished run/);
  });
});

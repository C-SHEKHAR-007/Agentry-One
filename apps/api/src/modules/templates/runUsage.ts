import type { Prisma } from "@prisma/client";

// Each run step with its workflow's attempts (timings, model, tokens, cost),
// so the run page can show per-step telemetry without a request per step.
export const RUN_DETAIL_INCLUDE = {
  template: { select: { id: true, name: true, projectId: true } },
  steps: {
    include: {
      templateStep: true,
      workflow: {
        include: {
          agent: { select: { id: true, name: true } },
          steps: {
            orderBy: { sequence: "asc" as const },
            select: {
              job: {
                select: {
                  providerType: true,
                  providerModel: true,
                  runs: { orderBy: { attemptNumber: "asc" as const } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.TemplateRunInclude;

export type RunDetail = Prisma.TemplateRunGetPayload<{ include: typeof RUN_DETAIL_INCLUDE }>;

/** Flattens each step's attempts into one usage summary for the run page's
 * inspector, and totals it for the whole run. */
export function withRunUsage(run: RunDetail) {
  const steps = run.steps.map((s) => {
    const jobs = (s.workflow?.steps ?? []).map((ws) => ws.job).filter((j): j is NonNullable<typeof j> => j !== null);
    const attempts = jobs.flatMap((j) => j.runs);
    const last = attempts[attempts.length - 1];
    const sum = (f: (a: (typeof attempts)[number]) => number | null) => attempts.reduce((n, a) => n + (f(a) ?? 0), 0);
    const startedAt = attempts.find((a) => a.startedAt)?.startedAt ?? null;
    const finishedAt = last && last.status !== "running" ? last.finishedAt : null;
    return {
      id: s.id,
      status: s.status,
      workflowId: s.workflowId,
      reusedFromStepId: s.reusedFromStepId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      templateStep: s.templateStep,
      workflow: s.workflow
        ? { id: s.workflow.id, status: s.workflow.status, agentId: s.workflow.agentId, agentName: s.workflow.agent.name, createdAt: s.workflow.createdAt }
        : null,
      usage: {
        attempts: attempts.length,
        model: last?.model ?? jobs[0]?.providerModel ?? null,
        providerType: jobs[0]?.providerType ?? null,
        inputTokens: sum((a) => a.inputTokens),
        outputTokens: sum((a) => a.outputTokens),
        costUsd: Math.round(sum((a) => a.costUsd) * 10000) / 10000,
        startedAt,
        finishedAt,
        durationMs: startedAt && finishedAt ? finishedAt.getTime() - startedAt.getTime() : null,
        progressPercent: last?.progressPercent ?? null,
        progressMessage: last?.progressMessage ?? null,
        error: (last?.error as { message?: string } | null)?.message ?? null,
      },
    };
  });
  // A retry's totals are the work it did: reused steps ran (and were paid
  // for) in the original run.
  const ran = steps.filter((s) => !s.reusedFromStepId);
  const starts = ran.map((s) => s.usage.startedAt).filter((d): d is Date => d !== null);
  const ends = ran.map((s) => s.usage.finishedAt).filter((d): d is Date => d !== null);
  const settled = ran.every((s) => s.usage.finishedAt !== null || s.status === "pending");
  return {
    id: run.id,
    templateId: run.templateId,
    status: run.status,
    runInputs: run.runInputs,
    retryOfId: run.retryOfId,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    template: run.template,
    steps,
    totals: {
      inputTokens: ran.reduce((n, s) => n + s.usage.inputTokens, 0),
      outputTokens: ran.reduce((n, s) => n + s.usage.outputTokens, 0),
      costUsd: Math.round(ran.reduce((n, s) => n + s.usage.costUsd, 0) * 10000) / 10000,
      durationMs:
        settled && starts.length && ends.length
          ? Math.max(...ends.map((d) => d.getTime())) - Math.min(...starts.map((d) => d.getTime()))
          : null,
    },
  };
}

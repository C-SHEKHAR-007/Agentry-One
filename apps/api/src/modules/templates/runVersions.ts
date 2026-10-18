import { prisma } from "../../db/client.js";

/** One output of a step: the workflow that produced it, and the run it was made in. */
export interface StepVersion {
  workflowId: string;
  runId: string;
  createdAt: Date;
}

export interface FamilyRun {
  id: string;
  retryOfId: string | null;
  steps: { templateStepId: string; workflowId: string | null; status: string; reusedFromStepId: string | null; createdAt: Date }[];
}

/** Retries chain at most this deep; enough for any number of regenerates in practice. */
const MAX_FAMILY = 200;

/**
 * Every version of each step across a run and its retries ("v1, v2, …"),
 * oldest first, keyed by templateStepId. A version is a step that actually
 * ran and completed; a reused step points at an earlier version and adds none.
 */
export function stepVersions(family: FamilyRun[]): Record<string, StepVersion[]> {
  const out: Record<string, StepVersion[]> = {};
  for (const run of family) {
    for (const s of run.steps) {
      if (s.reusedFromStepId || !s.workflowId || s.status !== "completed") continue;
      (out[s.templateStepId] ??= []).push({ workflowId: s.workflowId, runId: run.id, createdAt: s.createdAt });
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return out;
}

/** The run's whole retry family: its root and every retry made from it, directly or not. */
export async function loadRunFamily(runId: string): Promise<FamilyRun[]> {
  const select = {
    id: true,
    retryOfId: true,
    steps: { select: { templateStepId: true, workflowId: true, status: true, reusedFromStepId: true, createdAt: true } },
  } as const;

  let rootId = runId;
  for (let i = 0; i < MAX_FAMILY; i++) {
    const r = await prisma.templateRun.findUnique({ where: { id: rootId }, select: { retryOfId: true } });
    if (!r?.retryOfId) break;
    rootId = r.retryOfId;
  }

  const root = await prisma.templateRun.findUnique({ where: { id: rootId }, select });
  if (!root) return [];
  const family: FamilyRun[] = [root];
  let frontier = [root.id];
  while (frontier.length && family.length < MAX_FAMILY) {
    const children = await prisma.templateRun.findMany({ where: { retryOfId: { in: frontier } }, select });
    family.push(...children);
    frontier = children.map((c) => c.id);
  }
  return family;
}

import type { InputMappingValue } from "../models";

type PlanStep = { stepOrder: number; inputMapping: Record<string, InputMappingValue> };

/** Which steps a retry runs again and which it reuses -- the same rule as the
 * API (templates/service.ts planRetry): `fromStepOrder` and everything
 * downstream reruns; without it, every step that didn't complete and
 * everything downstream. Only completed steps are reused. */
export function planRetry(steps: PlanStep[], completed: Set<number>, fromStepOrder?: number) {
  const rerun = new Set<number>(fromStepOrder === undefined ? steps.map((s) => s.stepOrder).filter((o) => !completed.has(o)) : [fromStepOrder]);
  const deps = (s: PlanStep) => Object.values(s.inputMapping).flatMap((v) => (v.kind === "fromStep" ? [v.stepOrder] : []));
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of steps) {
      if (rerun.has(s.stepOrder)) continue;
      if (deps(s).some((d) => rerun.has(d)) || !completed.has(s.stepOrder)) {
        rerun.add(s.stepOrder);
        grew = true;
      }
    }
  }
  return { rerun, reuse: new Set(steps.map((s) => s.stepOrder).filter((o) => !rerun.has(o))) };
}

/** A run can be retried once it has stopped and nothing in it is running. */
export const canRetry = (run: { status: string; steps: { status: string }[] }) =>
  ["completed", "failed", "cancelled"].includes(run.status) && !run.steps.some((s) => s.status === "running");

-- Retry a workflow run from its failed step: the new run points at the run
-- it retries, and each step it didn't run again points at the original step
-- whose output it reuses. Both are nullable, so existing rows are untouched.
ALTER TABLE "template_runs" ADD COLUMN "retry_of_id" TEXT;
ALTER TABLE "template_run_steps" ADD COLUMN "reused_from_step_id" TEXT;

ALTER TABLE "template_runs" ADD CONSTRAINT "template_runs_retry_of_id_fkey" FOREIGN KEY ("retry_of_id") REFERENCES "template_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "template_run_steps" ADD CONSTRAINT "template_run_steps_reused_from_step_id_fkey" FOREIGN KEY ("reused_from_step_id") REFERENCES "template_run_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "template_runs_retry_of_id_idx" ON "template_runs"("retry_of_id");

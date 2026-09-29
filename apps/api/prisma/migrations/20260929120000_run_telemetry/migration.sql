-- Per-attempt usage (model, tokens, cost) and the model a job was enqueued
-- against, plus an index for reading an attempt's log lines in order.
ALTER TABLE "jobs" ADD COLUMN "provider_model" TEXT;

ALTER TABLE "job_runs" ADD COLUMN "model" TEXT,
ADD COLUMN "input_tokens" INTEGER,
ADD COLUMN "output_tokens" INTEGER,
ADD COLUMN "cost_usd" DOUBLE PRECISION;

CREATE INDEX "logs_job_run_id_created_at_idx" ON "logs"("job_run_id", "created_at");

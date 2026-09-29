-- Speeds up "latest runs per workflow" on the workflow library page.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "template_runs_template_id_created_at_idx" ON "template_runs"("template_id", "created_at");


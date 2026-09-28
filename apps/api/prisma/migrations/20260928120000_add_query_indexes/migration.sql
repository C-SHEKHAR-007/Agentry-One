-- Indexes for hot query paths (Postgres does not index foreign keys by
-- itself): per-project listings, workflow/step/job lookups, the stale-workflow
-- reaper (status, created_at), stats (job_runs status, finished_at), event
-- timelines, and template-run settlement.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "artifacts_workflow_step_id_idx" ON "artifacts"("workflow_step_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "artifacts_created_at_idx" ON "artifacts"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "events_workflow_id_idx" ON "events"("workflow_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "events_job_id_idx" ON "events"("job_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "events"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_runs_job_id_idx" ON "job_runs"("job_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_runs_status_finished_at_idx" ON "job_runs"("status", "finished_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "provider_configs_capability_id_scope_is_default_idx" ON "provider_configs"("capability_id", "scope", "is_default");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "template_run_steps_template_run_id_idx" ON "template_run_steps"("template_run_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "template_run_steps_workflow_id_idx" ON "template_run_steps"("workflow_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "templates_project_id_idx" ON "templates"("project_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflow_schedules_template_id_idx" ON "workflow_schedules"("template_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflow_steps_workflow_id_idx" ON "workflow_steps"("workflow_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflows_project_id_idx" ON "workflows"("project_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflows_status_created_at_idx" ON "workflows"("status", "created_at");


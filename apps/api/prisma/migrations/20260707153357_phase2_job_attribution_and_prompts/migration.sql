-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "provider_config_id" TEXT,
ADD COLUMN     "provider_type" TEXT;

-- CreateIndex
CREATE INDEX "jobs_provider_type_idx" ON "jobs"("provider_type");

-- CreateIndex
CREATE UNIQUE INDEX "prompts_agent_id_key_version_key" ON "prompts"("agent_id", "key", "version");


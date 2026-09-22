-- Brings the migration history in line with schema.prisma. These objects
-- were added to the schema (and applied to dev databases via `prisma db push`)
-- without a migration, so `prisma migrate deploy` on a fresh database produced
-- a schema missing four tables. Written idempotently so it also applies
-- cleanly to databases that already have some of these objects.

-- AlterTable
ALTER TABLE "provider_configs" ADD COLUMN IF NOT EXISTS "discovery_supported" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "last_discovered_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workflow_steps" ALTER COLUMN "human_gate" SET DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_accounts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "models" (
    "id" TEXT NOT NULL,
    "provider_config_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "input_types" TEXT[] DEFAULT ARRAY['text']::TEXT[],
    "output_types" TEXT[] DEFAULT ARRAY['text']::TEXT[],
    "context_length" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow_schedules" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "cron_expr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_project_id_platform_handle_key" ON "social_accounts"("project_id", "platform", "handle");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "models_provider_config_id_model_id_key" ON "models"("provider_config_id", "model_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "models" ADD CONSTRAINT "models_provider_config_id_fkey" FOREIGN KEY ("provider_config_id") REFERENCES "provider_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


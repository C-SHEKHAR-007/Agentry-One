-- The IANA timezone a schedule's cron expression is read in (e.g.
-- "Asia/Kolkata"). Empty for schedules made before this column: they keep
-- running in the server's timezone, as before.
ALTER TABLE "workflow_schedules" ADD COLUMN "timezone" TEXT;

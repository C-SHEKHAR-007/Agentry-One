-- A note for one step of a "regenerate this output" retry (e.g. "warmer
-- colours"); it is appended to that step's prompt when the step starts.
ALTER TABLE "template_run_steps" ADD COLUMN "note" TEXT;

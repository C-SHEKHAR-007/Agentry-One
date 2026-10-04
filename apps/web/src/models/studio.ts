import type { Role } from "../lib/studioPlan";

export interface BriefBody {
  topic: string;
  tone?: string;
  formats: Role[];
  socialAccountId?: string;
}

/** POST /projects/:id/briefs: the generated workflow and its first run. */
export interface BriefResult {
  templateId: string;
  runId: string;
}

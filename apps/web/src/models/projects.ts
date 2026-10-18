/** A project's agent runs over the last 30 days. */
export interface ProjectActivity {
  runs30d: number;
  completed30d: number;
  failed30d: number;
  /** completed / (completed + failed); null when nothing has settled yet. */
  successRate: number | null;
  /** Runs per UTC day, oldest first, ending today (30 values). */
  daily: number[];
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  counts: { workflows: number; templates: number; artifacts: number };
  lastActivityAt: string | null;
  coverArtifactId: string | null;
  coverPreviewUrl?: string | null;
  activity: ProjectActivity;
}

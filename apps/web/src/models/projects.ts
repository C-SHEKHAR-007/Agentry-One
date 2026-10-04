export interface Project {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  counts: { workflows: number; templates: number; artifacts: number };
  lastActivityAt: string | null;
  coverArtifactId: string | null;
  coverPreviewUrl?: string | null;
}

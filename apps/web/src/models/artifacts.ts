export interface Artifact {
  id: string;
  workflowStepId?: string;
  kind: string;
  mimeType: string;
  sizeBytes: number | null;
  checksum: string | null;
  createdAt: string;
  metadata?: Record<string, any> | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
}

export interface ArtifactListItem extends Artifact {
  workflowId: string;
  projectId: string;
  projectName: string;
  agentId: string;
  /** The start of a text artifact's contents (null for other kinds). */
  textPreview?: string | null;
}

/** An artifact as listed for a run (GET /workflows/:id/artifacts), with URLs. */
export interface ArtifactItem {
  id: string;
  workflowId?: string;
  kind: string;
  mimeType: string;
  storageKey?: string;
  sizeBytes?: number | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  createdAt?: string;
  metadata?: Record<string, any> | null;
}

/** A short-lived signed URL (Azure SAS) for previewing/downloading. */
export interface SignedUrl {
  url: string;
  expiresAt: string;
}

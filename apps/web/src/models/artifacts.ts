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
}

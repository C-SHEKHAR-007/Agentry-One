export interface Setting {
  id: string;
  scope: string;
  key: string;
  value: unknown;
  projectId?: string | null;
  agentId?: string | null;
}

export interface SocialAccount {
  id: string;
  projectId?: string;
  platform: string;
  handle: string | null;
  status: string;
  createdAt?: string;
}

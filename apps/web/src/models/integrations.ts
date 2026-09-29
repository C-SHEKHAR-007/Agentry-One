/** The Instagram browser-login helper, as the API reports it. */
export interface InstagramHelperStatus {
  /** False when the helper isn't running. */
  online: boolean;
  ready: boolean;
  session: InstagramLoginState;
}

export type InstagramLoginState = "idle" | "in_progress" | "success" | "failed" | "closed";

export interface InstagramLoginProgress {
  status: InstagramLoginState;
  handle: string | null;
  error: string | null;
  /** Seconds since the login started. */
  elapsed: number;
}

/** POST /social-accounts/direct-login: credentials for one platform. */
export interface DirectLoginBody {
  projectId: string;
  platform: string;
  username?: string;
  password?: string;
  handle?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  botToken?: string;
  chatId?: string;
  webhookUrl?: string;
  pageId?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  status: string;
  handle?: string;
  message?: string;
}

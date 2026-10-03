/**
 * Every API route the web app calls, in one place. Nothing else builds API
 * URLs: endpoints (services/api + features/*.api.ts) take their paths from
 * here. Paths are relative to the axios base URL (/api); `files` and
 * `streams` are absolute because <img>/<video> and EventSource use them
 * directly.
 */
import { API_BASE } from "../http/client";

const q = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
};
const id = (v: string) => encodeURIComponent(v);
/** Query params for one page of a newest-first list (see models/paging). */
type PageParams = { limit?: number; cursor?: string | null };
const paged = ({ limit, cursor }: PageParams) => ({ paged: 1, limit, cursor });

export const routes = {
  auth: {
    me: "/auth/me",
    login: "/auth/login",
    logout: "/auth/logout",
    setup: "/auth/setup",
    setupStatus: "/auth/setup-status",
    profile: "/auth/profile",
    google: "/auth/google",
  },
  users: {
    list: "/users",
    create: "/users",
    detail: (userId: string) => `/users/${id(userId)}`,
  },
  projects: {
    list: "/projects",
    create: "/projects",
    detail: (projectId: string) => `/projects/${id(projectId)}`,
    templates: (projectId: string) => `/projects/${id(projectId)}/templates`,
    startWorkflow: (projectId: string) => `/projects/${id(projectId)}/workflows`,
    briefs: (projectId: string) => `/projects/${id(projectId)}/briefs`,
  },
  agents: {
    list: "/agents",
    detail: (agentId: string) => `/agents/${id(agentId)}`,
    rescan: "/agents/rescan",
    custom: "/agents/custom",
    scaffold: "/agents/scaffold",
    capabilities: "/capabilities",
  },
  models: {
    list: "/models",
    create: "/models",
    detail: (modelId: string) => `/models/${id(modelId)}`,
  },
  providers: {
    list: (capability?: string) => `/providers${q({ capability })}`,
    create: "/providers",
    detail: (providerId: string) => `/providers/${id(providerId)}`,
    models: (providerId: string) => `/providers/${id(providerId)}/models`,
    discover: (providerId: string) => `/providers/${id(providerId)}/discover-models`,
    setDefault: (providerId: string) => `/providers/${id(providerId)}/set-default`,
    setDefaultModel: (providerId: string) => `/providers/${id(providerId)}/set-default-model`,
  },
  workflows: {
    recent: (p: { limit?: number; status?: string } = {}) => `/workflows/recent${q(p)}`,
    recentPage: (p: PageParams & { status?: string }) => `/workflows/recent${q({ ...paged(p), status: p.status })}`,
    detail: (workflowId: string) => `/workflows/${id(workflowId)}`,
    steps: (workflowId: string) => `/workflows/${id(workflowId)}/steps`,
    events: (workflowId: string) => `/workflows/${id(workflowId)}/events`,
    logs: (workflowId: string) => `/workflows/${id(workflowId)}/logs`,
    artifacts: (workflowId: string) => `/workflows/${id(workflowId)}/artifacts`,
    cancel: (workflowId: string) => `/workflows/${id(workflowId)}/cancel`,
    advance: (workflowId: string, stepKey: string) => `/workflows/${id(workflowId)}/steps/${id(stepKey)}/advance`,
    reapStale: "/workflows/reap-stale",
  },
  templates: {
    library: (projectId?: string) => `/templates${q({ projectId })}`,
    detail: (templateId: string) => `/templates/${id(templateId)}`,
    validate: (templateId: string) => `/templates/${id(templateId)}/validate`,
    run: (templateId: string) => `/templates/${id(templateId)}/run`,
    schedules: (templateId: string) => `/templates/${id(templateId)}/schedules`,
    schedule: (templateId: string) => `/templates/${id(templateId)}/schedule`,
    deleteSchedule: (scheduleId: string) => `/schedules/${id(scheduleId)}`,
  },
  runs: {
    list: (p: { status?: string; limit?: number } = {}) => `/template-runs${q(p)}`,
    listPage: (p: PageParams & { status?: string }) => `/template-runs${q({ ...paged(p), status: p.status })}`,
    detail: (runId: string) => `/template-runs/${id(runId)}`,
    cancel: (runId: string) => `/template-runs/${id(runId)}/cancel`,
    retry: (runId: string) => `/template-runs/${id(runId)}/retry`,
  },
  artifacts: {
    list: (p: { limit?: number; projectId?: string; kind?: string } = {}) => `/artifacts${q(p)}`,
    listPage: (p: PageParams & { projectId?: string; kind?: string }) =>
      `/artifacts${q({ ...paged(p), projectId: p.projectId, kind: p.kind })}`,
    detail: (artifactId: string) => `/artifacts/${id(artifactId)}`,
    download: (artifactId: string) => `/artifacts/${id(artifactId)}/download`,
    sasPreview: (artifactId: string) => `/artifacts/${id(artifactId)}/sas/preview`,
    sasDownload: (artifactId: string) => `/artifacts/${id(artifactId)}/sas/download`,
  },
  prompts: {
    list: (p: { agentId?: string } = {}) => `/prompts${q(p)}`,
    create: "/prompts",
    detail: (promptId: string) => `/prompts/${id(promptId)}`,
  },
  socialAccounts: {
    list: (projectId: string) => `/social-accounts${q({ projectId })}`,
    directLogin: "/social-accounts/direct-login",
    detail: (accountId: string) => `/social-accounts/${id(accountId)}`,
    test: (accountId: string) => `/social-accounts/${id(accountId)}/test`,
  },
  integrations: {
    instagramBrowserLogin: {
      status: "/integrations/instagram/browser-login/status",
      start: "/integrations/instagram/browser-login/start",
      session: "/integrations/instagram/browser-login/session",
      cancel: "/integrations/instagram/browser-login/cancel",
    },
  },
  events: {
    recent: (limit = 15) => `/events${q({ limit })}`,
  },
  stats: {
    overview: "/stats/overview",
    agents: "/stats/agents",
    system: "/stats/system",
    series: (days: number) => `/stats/series${q({ days })}`,
    costs: (days: number) => `/stats/costs${q({ days })}`,
  },
  notifications: {
    list: "/notifications",
    create: "/notifications",
    detail: (notificationId: string) => `/notifications/${id(notificationId)}`,
    read: (notificationId: string) => `/notifications/${id(notificationId)}/read`,
    readAll: "/notifications/mark-all-read",
  },
  settings: {
    list: "/settings",
    put: "/settings",
  },
  system: {
    version: "/version",
    health: "/health",
  },
  /** Absolute URLs for elements that load files themselves (<img>, <video>, <a download>). */
  files: {
    download: (artifactId: string) => `${API_BASE}/artifacts/${id(artifactId)}/download`,
    attachment: (artifactId: string) => `${API_BASE}/artifacts/${id(artifactId)}/download?disposition=attachment`,
  },
  /** Absolute URLs the browser navigates to (full-page redirects). */
  pages: {
    googleSignIn: `${API_BASE}/auth/google`,
  },
  /** Absolute URLs for server-sent-event streams (EventSource). */
  streams: {
    activity: `${API_BASE}/events/stream`,
    notifications: `${API_BASE}/notifications/stream`,
    job: (jobId: string) => `${API_BASE}/jobs/${id(jobId)}/events`,
  },
} as const;

export interface StatsOverview {
  agents: { total: number };
  workflows: { running: number; awaitingReview: number; total: number };
  jobs: {
    active: number;
    completedToday: number;
    failedToday: number;
    completedYesterday: number;
  };
  successRate: number | null;
  avgDurationMs: number | null;
  artifacts: { total: number };
  costSavedEstUsd: number;
  series: { completedPerDay: { date: string; count: number }[] };
}

export interface CostBreakdown {
  totalUsd: number;
  savedUsd: number;
  unattributedJobs: number;
  perProvider: { providerType: string; jobs: number; usd: number }[];
  perDay: { date: string; usd: number; savedUsd: number; jobs: number }[];
  pricing: Record<string, { perJobUsd: number }>;
  referenceUsd: number;
  days: number;
}

export interface SystemHealth {
  api: boolean;
  db: boolean;
  redis: boolean;
  workers: { queue: string; agentId: string; online: boolean }[];
}

export interface StatsSeries {
  days: number;
  perDay: { date: string; completed: number; failed: number; avgDurationMs: number | null }[];
}

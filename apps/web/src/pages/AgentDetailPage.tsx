import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Clock,
  FileText,
  Headphones,
  Play,
  Plug,
  Sparkles,
  Star,
  Video as VideoIcon,
} from "lucide-react";
import { api } from "../api/client.js";
import type { ProviderConfig } from "../api/types";
import { useAgentStats, useArtifacts, useSasPreviewUrl } from "../api/queries";
import { formatDuration, formatPercent, timeAgo } from "../lib/format";
import { StatCard } from "../components/StatCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";

interface AgentStep {
  key: string;
  requiresCapability?: string;
  humanGate: boolean;
  producesArtifactKinds: string[];
  inputSchema: { properties?: Record<string, { title?: string; type?: string }>; required?: string[] };
}

interface AgentDetail {
  id: string;
  name: string;
  version: string;
  description: string;
  manifest: { steps: AgentStep[] };
}

/** Per-output component supporting images, text, audio, and videos */
function RecentOutputItem({
  artifactId,
  workflowId,
  kind,
  mimeType,
  previewUrl,
  metadata,
}: {
  artifactId: string;
  workflowId: string;
  kind: string;
  mimeType: string;
  previewUrl?: string | null;
  metadata?: Record<string, any> | null;
}) {
  const isImage = mimeType.startsWith("image/");
  const isAudio = mimeType.startsWith("audio/");
  const isVideo = mimeType.startsWith("video/");
  const isText = mimeType.startsWith("text/") || mimeType.includes("json") || kind === "text" || kind === "search_brief";

  const { data: sas } = useSasPreviewUrl(!previewUrl && isImage ? artifactId : undefined);
  const url = previewUrl || sas?.url;

  return (
    <Link to={`/workflows/${workflowId}`} className="group overflow-hidden rounded-lg border border-border bg-card/60 transition-all hover:border-primary/50 hover:shadow-md block">
      {isImage ? (
        url ? (
          <img
            src={url}
            alt={kind}
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="aspect-square w-full animate-pulse bg-secondary" />
        )
      ) : isAudio ? (
        <div className="aspect-square w-full p-4 bg-secondary/20 flex flex-col items-center justify-center gap-2 text-center">
          <span className="p-3 rounded-full bg-primary/20 text-primary">
            <Headphones className="h-6 w-6" />
          </span>
          <span className="text-xs font-medium truncate capitalize">{kind}</span>
          <span className="text-[10px] text-muted-foreground">Audio Track</span>
        </div>
      ) : isText ? (
        <div className="aspect-square w-full p-3.5 bg-secondary/15 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center gap-1.5 text-primary">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold capitalize truncate">{kind}</span>
          </div>
          <p className="font-mono text-[11px] text-foreground/80 line-clamp-4 leading-snug bg-background/60 p-2 rounded border border-border/40">
            {metadata?.preview || "Generated text response..."}
          </p>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Document</span>
        </div>
      ) : isVideo ? (
        <div className="aspect-square w-full p-4 bg-secondary/20 flex flex-col items-center justify-center gap-2 text-center">
          <span className="p-3 rounded-full bg-primary/20 text-primary">
            <VideoIcon className="h-6 w-6" />
          </span>
          <span className="text-xs font-medium truncate capitalize">{kind}</span>
          <span className="text-[10px] text-muted-foreground">Video MP4</span>
        </div>
      ) : (
        <div className="aspect-square w-full p-4 bg-secondary/20 flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-xs font-medium truncate capitalize">{kind}</span>
          <span className="text-[10px] text-muted-foreground">{mimeType}</span>
        </div>
      )}
    </Link>
  );
}

export function AgentDetailPage() {
  const { agentId } = useParams();
  const { data: agent } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.get<AgentDetail>(`/agents/${agentId}`),
  });
  const { data: agentStats } = useAgentStats();
  const stats = agentStats?.agents.find((a) => a.agentId === agentId);

  const capability = agent?.manifest.steps.find((s) => s.requiresCapability)?.requiresCapability;
  const { data: providers } = useQuery({
    queryKey: ["providers", capability],
    queryFn: () => api.get<ProviderConfig[]>(`/providers?capability=${capability}`),
    enabled: !!capability,
  });

  const { data: artifacts } = useArtifacts({ limit: 24 });
  const recentOutputs = (artifacts ?? [])
    .filter((a) => a.agentId === agentId)
    .slice(0, 8);

  if (!agent) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card glass className="relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-chart-3/10" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Sparkles className="h-7 w-7" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
                  <Badge variant="success">Installed</Badge>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < 4 ? "fill-warning text-warning" : "text-muted-foreground/40"}`}
                      />
                    ))}
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-muted-foreground">{agent.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  v{agent.version}
                  {stats?.lastRunAt ? ` · last run ${timeAgo(stats.lastRunAt)}` : ""}
                </p>
              </div>
            </div>
            <Link to={`/agents/${agent.id}/submit`}>
              <Button size="lg">
                <Play className="h-4 w-4" /> Run this agent
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Activity}
          label="Total Runs"
          value={stats?.runs ?? 0}
          color="hsl(var(--chart-1))"
        />
        <StatCard
          icon={CheckCircle2}
          label="Success Rate"
          value={formatPercent(stats?.successRate)}
          color="hsl(var(--chart-2))"
          delay={0.05}
        />
        <StatCard
          icon={Clock}
          label="Avg. Duration"
          value={formatDuration(stats?.avgDurationMs)}
          color="hsl(var(--chart-3))"
          delay={0.1}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Providers */}
        {capability && (
          <Card glass>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Providers · {capability}</CardTitle>
              <Link to="/providers" className="text-xs text-muted-foreground hover:text-primary">
                Manage
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {(providers ?? []).length === 0 && (
                <p className="text-sm text-warning">
                  No provider configured — submissions will be rejected until one is added.
                </p>
              )}
              {(providers ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Plug className="h-4 w-4 text-muted-foreground" />
                    {p.name}
                    <span className="text-xs text-muted-foreground">{p.providerType}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.isDefault && <Badge>default</Badge>}
                    {p.hasSecret && (
                      <Badge variant="outline" className="text-[10px]">
                        key set
                      </Badge>
                    )}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Steps */}
        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">Workflow Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agent.manifest.steps.map((step) => (
              <div key={step.key} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{step.key}</span>
                  {step.humanGate && <Badge variant="warning">human gate</Badge>}
                  {step.requiresCapability && (
                    <Badge variant="secondary">requires: {step.requiresCapability}</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Produces: {step.producesArtifactKinds.join(", ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Inputs: {Object.keys(step.inputSchema.properties ?? {}).join(", ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent outputs */}
      {recentOutputs.length > 0 && (
        <Card glass>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Outputs</CardTitle>
            <Link to="/artifacts" className="text-xs text-muted-foreground hover:text-primary">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {recentOutputs.map((a) => (
                <RecentOutputItem
                  key={a.id}
                  artifactId={a.id}
                  workflowId={a.workflowId}
                  kind={a.kind}
                  mimeType={a.mimeType}
                  previewUrl={a.previewUrl}
                  metadata={a.metadata}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

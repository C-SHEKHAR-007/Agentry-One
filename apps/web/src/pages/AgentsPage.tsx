import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { Agent } from "../api/types";
import { useAgentStats } from "../api/queries";
import { comingSoonAgents } from "../data/comingSoonAgents";
import { ComingSoonAgentCard, InstalledAgentCard } from "../components/AgentCard";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/ui/skeleton";

export function AgentsPage() {
  const [searchParams] = useSearchParams();
  const installedOnly = searchParams.get("filter") === "installed";

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });
  const { data: agentStats } = useAgentStats();
  const runsByAgent = new Map(
    (agentStats?.agents ?? []).map((a) => [a.agentId, a.runs]),
  );

  return (
    <div>
      <PageHeader
        title={installedOnly ? "Installed Agents" : "AI Marketplace"}
        description={
          installedOnly
            ? "Agents discovered from their manifest.json at API boot."
            : "Install, orchestrate, and run AI capabilities from one workspace. New agents appear automatically after an API restart — no platform code changes."
        }
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent, i) => (
          <InstalledAgentCard
            key={agent.id}
            agent={agent}
            runs={runsByAgent.get(agent.id)}
            delay={i * 0.05}
          />
        ))}
        {!installedOnly &&
          comingSoonAgents.map((agent, i) => (
            <ComingSoonAgentCard
              key={agent.id}
              agent={agent}
              delay={((agents?.length ?? 0) + i) * 0.05}
            />
          ))}
      </div>
    </div>
  );
}

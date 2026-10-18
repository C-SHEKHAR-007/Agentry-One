import { Link } from "react-router-dom";
import { AudioLines, Bot, FileText, FolderOpen, ImageIcon, PauseCircle, Search, Video, type LucideIcon } from "lucide-react";
import type { AgentManifestDetail } from "../../../../models/agents";
import type { ProviderConfig } from "../../../../models/providers";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent } from "../../../../components/ui/card";

const KIND_ICON: Record<string, LucideIcon> = { image: ImageIcon, text: FileText, audio: AudioLines, video: Video, search_brief: Search };
const KIND_LABEL: Record<string, string> = { search_brief: "search brief" };

export interface RunPreviewProps {
  agent: AgentManifestDetail;
  projectName?: string;
  /** The provider the run will use; undefined = the system default. */
  provider?: ProviderConfig;
  /** The model that provider uses unless told otherwise. */
  model?: string;
  /** True when the step needs a provider and none is active. */
  noProvider: boolean;
}

/** "What will run": the agent, project, provider and model, and the outputs
 * to expect, so nothing about the run is a surprise. */
export function RunPreview({ agent, projectName, provider, model, noProvider }: RunPreviewProps) {
  const steps = agent.manifest.steps;
  const kinds = [...new Set(steps.flatMap((s) => s.producesArtifactKinds ?? []))];
  const capability = steps[0]?.requiresCapability;
  const gated = steps.some((s) => s.humanGate);

  return (
    <Card glass>
      <CardContent className="space-y-4 pt-5 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What will run</p>

        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">{agent.name}</p>
            <p className="text-xs text-muted-foreground">
              {agent.version ? `v${agent.version} · ` : ""}{steps.length} step{steps.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
          <dt className="text-muted-foreground">Project</dt>
          <dd className="flex items-center gap-1.5 truncate">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {projectName ?? <span className="text-warning">Pick a project</span>}
          </dd>
          {capability && (
            <>
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="truncate">
                {noProvider ? (
                  <Link to="/providers" className="text-warning underline">
                    None active for {capability}
                  </Link>
                ) : provider ? (
                  `${provider.name} (${provider.providerType})`
                ) : (
                  "System default"
                )}
              </dd>
              <dt className="text-muted-foreground">Model</dt>
              <dd className="truncate font-mono">{model || <span className="font-sans text-muted-foreground">Provider default</span>}</dd>
            </>
          )}
        </dl>

        {steps.length > 1 && (
          <ol className="space-y-1 border-l border-border pl-3 text-xs">
            {steps.map((s) => (
              <li key={s.key}>
                <span className="font-medium">{s.name ?? s.key}</span>
                {s.requiresCapability && <span className="text-muted-foreground"> · {s.requiresCapability}</span>}
              </li>
            ))}
          </ol>
        )}

        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Expected outputs</p>
          {kinds.length ? (
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => {
                const Icon = KIND_ICON[k] ?? FileText;
                return (
                  <Badge key={k} variant="secondary">
                    <Icon className="h-3 w-3" /> {KIND_LABEL[k] ?? k}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Not declared by this agent</p>
          )}
        </div>

        {gated && (
          <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
            <PauseCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Pauses for your review before it finishes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

import { Bot, Clapperboard, FileText, Globe, ImageIcon, Mic, PenLine, Send, type LucideIcon } from "lucide-react";
import type { AgentManifestDetail } from "../../hooks/useTemplateDraft";

/** An icon that says what a step does, derived from its agent's manifest. */
export function stepIcon(agentId: string, agent?: AgentManifestDetail): LucideIcon {
  const ms = agent?.manifest.steps[0];
  const produces = ms?.producesArtifactKinds ?? [];
  if (ms?.requiresSocialAccount || /publish|social/.test(agentId)) return Send;
  if (/search/.test(agentId) || ms?.requiresCapability === "web-search") return Globe;
  if (produces.includes("video")) return Clapperboard;
  if (produces.includes("audio")) return Mic;
  if (produces.includes("image")) return ImageIcon;
  if (produces.includes("text")) return /writer|brief|copy|dynamic/.test(agentId) ? PenLine : FileText;
  return Bot;
}

const KIND_STYLES: Record<string, string> = {
  text: "bg-chart-3/15 text-chart-3",
  image: "bg-chart-2/15 text-chart-2",
  audio: "bg-warning/15 text-warning",
  video: "bg-primary/15 text-primary",
};

/** Small colour-coded chip for an artifact kind (text, image, audio, video). */
export function KindChip({ kind, className = "" }: { kind: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        KIND_STYLES[kind] ?? "bg-secondary text-secondary-foreground"
      } ${className}`}
    >
      {kind}
    </span>
  );
}

import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Ban,
  Eye,
  FileEdit,
  Rocket,
  CircleDashed,
} from "lucide-react";
import { Badge, type BadgeProps } from "./ui/badge";

// Single source of truth for status -> color/icon across the app.
const MAP: Record<string, { variant: BadgeProps["variant"]; icon: React.ElementType; spin?: boolean; label?: string }> = {
  running: { variant: "default", icon: Loader2, spin: true },
  queued: { variant: "warning", icon: Clock },
  pending: { variant: "secondary", icon: CircleDashed },
  completed: { variant: "success", icon: CheckCircle2 },
  failed: { variant: "destructive", icon: XCircle },
  cancelled: { variant: "outline", icon: Ban },
  awaiting_review: { variant: "warning", icon: Eye, label: "awaiting review" },
  draft: { variant: "secondary", icon: FileEdit },
  published: { variant: "success", icon: Rocket },
  active: { variant: "success", icon: CheckCircle2 },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = MAP[status] ?? { variant: "secondary" as const, icon: CircleDashed };
  const Icon = entry.icon;
  return (
    <Badge variant={entry.variant} className={className}>
      <Icon className={`h-3 w-3 ${entry.spin ? "animate-spin" : ""}`} />
      {entry.label ?? status}
    </Badge>
  );
}

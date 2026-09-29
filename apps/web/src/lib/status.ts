import { Ban, CheckCircle2, CircleDashed, Clock, Eye, FileEdit, Loader2, Rocket, XCircle, type LucideIcon } from "lucide-react";

/** The one status language used everywhere: badges, graph nodes, run lists,
 * the activity stream and logs. `tone` is a theme colour name. */
export interface StatusStyle {
  label: string;
  tone: "primary" | "success" | "destructive" | "warning" | "muted";
  icon: LucideIcon;
  /** Still moving: gets the live dot / glow. */
  live?: boolean;
}

const STATUS: Record<string, StatusStyle> = {
  running: { label: "Running", tone: "primary", icon: Loader2, live: true },
  queued: { label: "Queued", tone: "muted", icon: Clock, live: true },
  pending: { label: "Waiting", tone: "muted", icon: CircleDashed },
  cancelling: { label: "Cancelling", tone: "muted", icon: Loader2, live: true },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
  failed: { label: "Failed", tone: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", tone: "muted", icon: Ban },
  awaiting_review: { label: "Needs review", tone: "warning", icon: Eye },
  draft: { label: "Draft", tone: "muted", icon: FileEdit },
  published: { label: "Published", tone: "success", icon: Rocket },
  active: { label: "Active", tone: "success", icon: CheckCircle2 },
};

export function statusStyle(status: string | null | undefined): StatusStyle {
  const s = status ?? "pending";
  if (STATUS[s]) return STATUS[s];
  const text = s.replace(/_/g, " ");
  return { label: text.charAt(0).toUpperCase() + text.slice(1), tone: "muted", icon: CircleDashed };
}

/** Tailwind classes per tone (kept literal so Tailwind can see them). */
export const TONE = {
  primary: { text: "text-primary", bg: "bg-primary/15", border: "border-primary/60", solid: "bg-primary", ring: "ring-primary/30" },
  success: { text: "text-success", bg: "bg-success/15", border: "border-success/50", solid: "bg-success", ring: "ring-success/30" },
  destructive: {
    text: "text-destructive",
    bg: "bg-destructive/15",
    border: "border-destructive/60",
    solid: "bg-destructive",
    ring: "ring-destructive/30",
  },
  warning: { text: "text-warning", bg: "bg-warning/15", border: "border-warning/60", solid: "bg-warning", ring: "ring-warning/30" },
  muted: { text: "text-muted-foreground", bg: "bg-secondary", border: "border-border", solid: "bg-muted-foreground", ring: "ring-border" },
} as const;

export const LIVE_STATUSES = ["running", "queued", "pending", "cancelling", "awaiting_review"];

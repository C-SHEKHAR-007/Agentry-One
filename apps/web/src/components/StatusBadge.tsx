import { cn } from "../lib/utils";
import { statusStyle, TONE } from "../lib/status";

/** Live status dot: pulses while the thing it describes is still moving. */
export function StatusDot({ status, className }: { status: string; className?: string }) {
  const st = statusStyle(status);
  return <span className={cn("status-dot", TONE[st.tone].text, className)} data-live={st.live ? "true" : undefined} aria-hidden="true" />;
}

// Single source of truth for status -> colour/icon across the app (lib/status).
export function StatusBadge({ status, className, size = "md" }: { status: string; className?: string; size?: "sm" | "md" }) {
  const st = statusStyle(status);
  const tone = TONE[st.tone];
  const Icon = st.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent font-medium",
        size === "sm" ? "px-2 py-px text-[11px]" : "px-2.5 py-0.5 text-xs",
        tone.bg,
        tone.text,
        status === "running" && "animate-status-glow",
        className,
      )}
    >
      {st.live ? (
        <StatusDot status={status} className="h-1.5 w-1.5" />
      ) : (
        <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
      {st.label}
    </span>
  );
}

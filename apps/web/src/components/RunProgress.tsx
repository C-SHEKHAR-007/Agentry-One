import { Progress } from "./ui/progress";

// Staged copy keeps the run feeling alive even when the worker's own
// progress messages are sparse; a worker-provided message always wins.
function stageFor(percent: number | undefined): string {
  if (percent == null) return "Preparing AI...";
  if (percent < 10) return "Preparing AI...";
  if (percent < 90) return "Generating...";
  if (percent < 100) return "Finalizing...";
  return "Almost ready...";
}

export function RunProgress({
  percent,
  message,
}: {
  percent?: number;
  message?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm text-muted-foreground">{message || stageFor(percent)}</p>
        <span className="font-mono text-sm text-primary">{percent != null ? `${percent}%` : ""}</span>
      </div>
      <Progress value={percent} indeterminate={percent == null} />
    </div>
  );
}

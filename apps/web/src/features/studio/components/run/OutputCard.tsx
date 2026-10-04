import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, Download } from "lucide-react";
import { errorMessage } from "../../../../services/http/errors";
import type { Role } from "../../../../lib/studioPlan";
import { cn } from "../../../../lib/utils";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { ROLES } from "../roles";
import { Placeholder, StateIcon, StepMeta, StepStatusBody } from "./StepStates";
import { type RunStep, mediaUrls, stateOf, useArtifactText, useStepArtifacts } from "./shared";

export function OutputCard({ role, step, runLive, runId, wide }: { role: Role; step?: RunStep; runLive: boolean; runId: string; wide: boolean }) {
  const meta = ROLES[role];
  const Icon = meta.icon;
  const state = stateOf(step, runLive);
  const { data: artifacts, isError } = useStepArtifacts(step);
  const primary = artifacts?.[0];
  const { src, file } = mediaUrls(primary);

  return (
    <Card glass className={cn("flex min-w-0 flex-col overflow-hidden", wide && "xl:col-span-2")}>
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="flex-1 text-sm font-semibold">{meta.label}</h3>
        <StateIcon state={state} />
      </div>

      <div className="flex-1 p-4">
        <StepStatusBody role={role} step={step} state={state} runId={runId} />
        {state === "done" && !primary && <Placeholder text={isError ? "Couldn't load the output." : "Loading…"} />}

        {state === "done" && primary && (
          <div className="space-y-3">
            {primary.mimeType.startsWith("image/") && src && (
              <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-muted/30">
                <img src={src} alt="Generated visual" className="mx-auto max-h-80 w-full object-contain" />
              </a>
            )}
            {primary.mimeType.startsWith("audio/") && src && <audio controls src={src} className="w-full" />}
            {primary.mimeType.startsWith("video/") && src && <video controls src={src} className="mx-auto max-h-[460px] w-full rounded-lg border border-border bg-black" />}
            {primary.mimeType.startsWith("text/") && <TextOutput artifactId={primary.id} collapsible={role === "search"} />}
            <div className="flex items-center justify-between gap-2">
              <StepMeta step={step} />
              <a href={file} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function TextOutput({ artifactId, collapsible }: { artifactId: string; collapsible: boolean }) {
  const { data: text, isError, error } = useArtifactText(artifactId);
  const [expanded, setExpanded] = useState(!collapsible);
  const [copied, setCopied] = useState(false);

  if (isError) return <p className="text-xs text-destructive">{errorMessage(error, "Couldn't load text")}</p>;
  if (text === undefined) return <Placeholder text="Loading…" />;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <div className="relative">
      <pre
        className={cn(
          "whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-muted/40 p-3 pr-10 font-sans text-sm leading-relaxed text-foreground",
          !expanded && "max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]",
        )}
      >
        {text}
      </pre>
      <Button size="icon" variant="ghost" className="absolute right-1.5 top-1.5 h-7 w-7" onClick={copy} aria-label="Copy text">
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      {collapsible && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bot, Braces, Check, Copy, FileText, GitBranchPlus, GitCompare, History, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { Button, buttonVariants } from "../../../components/ui/button";
import { extractPlaceholders, textStats } from "../../../lib/promptText";
import { useDeletePromptMutation } from "../prompts.api";
import { errorMessage } from "../../../services/http/errors";
import type { PromptGroup } from "../grouping";
import { TemplateDiff, TemplateView } from "./TemplateView";
import { TabButton } from "./bits";

export function PromptDetail({
  group,
  agentName,
  onBack,
  onNewVersion,
  onDeletedLast,
}: {
  group: PromptGroup;
  agentName: string;
  onBack: () => void;
  onNewVersion: (template: string) => void;
  onDeletedLast: () => void;
}) {
  const [deletePrompt, deleteState] = useDeletePromptMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = Number(searchParams.get("v"));
  const current = group.versions.find((v) => v.version === requested) ?? group.latest;
  const previous = group.versions.find((v) => v.version < current.version) ?? null;
  const [view, setView] = useState<"template" | "changes">("template");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    if (!previous) setView("template");
  }, [current.id, previous]);

  const setVersion = (version: number) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (version === group.latest.version) next.delete("v");
        else next.set("v", String(version));
        return next;
      },
      { replace: true },
    );

  const placeholders = useMemo(() => extractPlaceholders(current.template), [current.template]);
  const stats = useMemo(() => textStats(current.template), [current.template]);
  const isLatest = current.id === group.latest.id;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.template);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  const remove = {
    isPending: deleteState.isLoading,
    mutate: () =>
      deletePrompt(current.id)
        .unwrap()
        .then(() => {
          toast.success(`Deleted ${group.key} v${current.version}`);
          if (group.versions.length === 1) onDeletedLast();
          else setVersion(group.versions.find((v) => v.id !== current.id)!.version);
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  return (
    <Card glass className="overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/70 p-5">
        <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground lg:hidden">
          <ArrowLeft className="h-3.5 w-3.5" /> All prompts
        </button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-all font-mono text-lg font-semibold">{group.key}</h2>
              <Badge className="tabular-nums">v{current.version}</Badge>
              {isLatest ? <Badge variant="success">Latest</Badge> : <Badge variant="warning">Older version</Badge>}
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              <Link to={`/agents/${group.agentId}`} className="hover:text-foreground hover:underline">
                {agentName}
              </Link>
              <span aria-hidden>·</span>
              <span>Saved {timeAgo(current.createdAt)}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onNewVersion(current.template)}>
              <GitBranchPlus className="h-4 w-4" /> New version
            </Button>
            <Link
              to={`/agents/${group.agentId}/submit?prompt=${current.id}`}
              className={buttonVariants({ size: "sm" })}
            >
              <Play className="h-4 w-4" /> Use in run
            </Link>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_240px]">
        {/* Body */}
        <div className="min-w-0 space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div role="tablist" aria-label="Prompt view" className="inline-flex rounded-md border border-border/70 p-0.5">
              <TabButton active={view === "template"} onClick={() => setView("template")} icon={FileText} label="Prompt" />
              <TabButton
                active={view === "changes"}
                onClick={() => setView("changes")}
                icon={GitCompare}
                label={previous ? `Changes from v${previous.version}` : "Changes"}
                disabled={!previous}
              />
            </div>
            <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
              {stats.words} words · {stats.lines} {stats.lines === 1 ? "line" : "lines"} · {stats.characters} chars
            </span>
          </div>

          {view === "changes" && previous ? (
            <TemplateDiff before={previous.template} after={current.template} />
          ) : (
            <TemplateView template={current.template} />
          )}

          {placeholders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Braces className="h-3.5 w-3.5" /> Placeholders:
              {placeholders.map((p) => (
                <code key={p} className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">
                  {p}
                </code>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end border-t border-border/60 pt-4">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">
                  Delete v{current.version}
                  {group.versions.length === 1 ? " (the only version) — this removes the prompt" : ""}?
                </span>
                <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Delete v{current.version}
              </Button>
            )}
          </div>
        </div>

        {/* Version history */}
        <aside className="border-t border-border/70 p-5 xl:border-l xl:border-t-0">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" /> History
          </h3>
          <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-border">
            {group.versions.map((v) => {
              const active = v.id === current.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setVersion(v.version)}
                    className={cn(
                      "relative flex w-full items-start gap-3 rounded-md py-2 pl-0 pr-2 text-left transition-colors hover:bg-secondary/50",
                      active && "bg-secondary/60",
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 bg-card",
                        active ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        v{v.version}
                        {v.id === group.latest.id && <span className="text-[11px] font-normal text-success">latest</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground">{timeAgo(v.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </Card>
  );
}

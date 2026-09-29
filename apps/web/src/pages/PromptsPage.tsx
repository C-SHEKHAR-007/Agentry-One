import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Braces,
  Brain,
  Check,
  Copy,
  FileText,
  GitBranchPlus,
  GitCompare,
  History,
  Layers,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { api } from "../api/client";
import type { Agent, Prompt } from "../api/types";
import { timeAgo } from "../lib/format";
import { extractPlaceholders, textStats } from "../lib/promptText";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button, buttonVariants } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { TemplateDiff, TemplateView } from "../components/prompts/TemplateView";
import { PromptEditorDialog, type EditorMode } from "../components/prompts/PromptEditorDialog";

/** All versions of one prompt (same agent + key), newest first. */
interface PromptGroup {
  id: string; // `${agentId}:${key}`
  agentId: string;
  key: string;
  versions: Prompt[];
  latest: Prompt;
  placeholders: string[];
}

type SortKey = "recent" | "name" | "versions";

function groupPrompts(prompts: Prompt[]): PromptGroup[] {
  const map = new Map<string, Prompt[]>();
  for (const p of prompts) {
    const id = `${p.agentId}:${p.key}`;
    map.set(id, [...(map.get(id) ?? []), p]);
  }
  return [...map.entries()].map(([id, versions]) => {
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    return {
      id,
      agentId: sorted[0].agentId,
      key: sorted[0].key,
      versions: sorted,
      latest: sorted[0],
      placeholders: extractPlaceholders(sorted[0].template),
    };
  });
}

export function PromptsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("prompt");
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: () => api.get<Agent[]>("/agents") });
  const {
    data: prompts,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["prompts"], queryFn: () => api.get<Prompt[]>("/prompts") });

  const agentName = useMemo(() => {
    const names = new Map(agents.map((a) => [a.id, a.name]));
    return (id: string) => names.get(id) ?? id;
  }, [agents]);

  const groups = useMemo(() => groupPrompts(prompts ?? []), [prompts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = groups.filter(
      (g) =>
        (!agentFilter || g.agentId === agentFilter) &&
        (!q ||
          g.key.includes(q) ||
          agentName(g.agentId).toLowerCase().includes(q) ||
          g.versions.some((v) => v.template.toLowerCase().includes(q))),
    );
    return filtered.sort((a, b) => {
      if (sort === "name") return a.key.localeCompare(b.key);
      if (sort === "versions") return b.versions.length - a.versions.length || a.key.localeCompare(b.key);
      return new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime();
    });
  }, [groups, query, agentFilter, sort, agentName]);

  const selected = groups.find((g) => g.id === selectedId) ?? null;

  const select = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("prompt", id);
        else next.delete("prompt");
        next.delete("v");
        return next;
      },
      { replace: true },
    );

  // On wide screens, always show something in the detail pane.
  useEffect(() => {
    if (!selectedId && visible.length > 0 && window.matchMedia("(min-width: 1024px)").matches) {
      select(visible[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, visible]);

  // "/" focuses search, like most library/search UIs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const totalVersions = prompts?.length ?? 0;
  const agentsUsed = new Set(groups.map((g) => g.agentId)).size;
  const agentsWithPrompts = agents.filter((a) => groups.some((g) => g.agentId === a.id));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Prompt Library"
        description="Save the prompts that work, keep every version, and reuse them from any agent's run form."
        actions={
          <Button onClick={() => setEditor({ kind: "new" })}>
            <Plus className="h-4 w-4" /> New prompt
          </Button>
        }
      />

      {isError ? (
        <EmptyState
          icon={Brain}
          title="Couldn't load prompts"
          description="The prompt library is unavailable right now."
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="hidden h-[480px] lg:block" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No saved prompts yet"
          description="Save a prompt here, or use “Save current prompt” on any agent's run form."
          action={
            <Button onClick={() => setEditor({ kind: "new" })}>
              <Plus className="h-4 w-4" /> New prompt
            </Button>
          }
        />
      ) : (
        <>
          {/* Toolbar */}
          <div className={cn("mb-5 flex flex-col gap-3 lg:flex-row lg:items-center", selected && "hidden lg:flex")}>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search prompts by name, agent or text…"
                aria-label="Search prompts"
                className="pl-9 pr-10"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[11px] text-muted-foreground sm:block">
                /
              </kbd>
            </div>
            <div className="flex gap-3">
              <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} aria-label="Filter by agent" className="w-full sm:w-48">
                <option value="">All agents</option>
                {agentsWithPrompts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort prompts" className="w-full sm:w-44">
                <option value="recent">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="versions">Most versions</option>
              </Select>
            </div>
            <div className="hidden items-center gap-4 text-xs text-muted-foreground xl:flex">
              <Stat icon={FileText} value={groups.length} label="prompts" />
              <Stat icon={History} value={totalVersions} label="versions" />
              <Stat icon={Bot} value={agentsUsed} label="agents" />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
            {/* List */}
            <div className={cn("space-y-2.5 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1", selected && "hidden lg:block")}>
              {visible.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No prompts match"
                  description="Try a different search or agent filter."
                  action={
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setQuery("");
                        setAgentFilter("");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                visible.map((g) => (
                  <PromptListItem key={g.id} group={g} agentName={agentName(g.agentId)} active={g.id === selectedId} onSelect={() => select(g.id)} />
                ))
              )}
            </div>

            {/* Detail */}
            <div className={cn(!selected && "hidden lg:block")}>
              {selected ? (
                <PromptDetail
                  key={selected.id}
                  group={selected}
                  agentName={agentName(selected.agentId)}
                  onBack={() => select(null)}
                  onNewVersion={(template) =>
                    setEditor({
                      kind: "version",
                      agentId: selected.agentId,
                      key: selected.key,
                      template,
                      nextVersion: selected.latest.version + 1,
                    })
                  }
                  onDeletedLast={() => select(null)}
                />
              ) : (
                <Card glass className="flex h-full min-h-[320px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">Select a prompt to see it here.</p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      <PromptEditorDialog
        mode={editor}
        onClose={() => setEditor(null)}
        agents={agents}
        prompts={prompts ?? []}
        onSaved={(p) => select(`${p.agentId}:${p.key}`)}
      />
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold tabular-nums text-foreground">{value}</span> {label}
    </span>
  );
}

function PromptListItem({
  group,
  agentName,
  active,
  onSelect,
}: {
  group: PromptGroup;
  agentName: string;
  active: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Keep a deep-linked or keyboard-selected prompt visible in the list.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group w-full rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/50 bg-primary/[0.07] shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
          : "border-border/70 bg-card/60 hover:border-border hover:bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-foreground">{group.key}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Bot className="h-3 w-3 shrink-0" /> {agentName}
          </p>
        </div>
        <Badge variant={active ? "default" : "secondary"} className="shrink-0 tabular-nums">
          v{group.latest.version}
        </Badge>
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{group.latest.template}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80">
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {group.versions.length} {group.versions.length === 1 ? "version" : "versions"}
        </span>
        {group.placeholders.length > 0 && (
          <span className="flex items-center gap-1">
            <Braces className="h-3 w-3" />
            {group.placeholders.length} {group.placeholders.length === 1 ? "placeholder" : "placeholders"}
          </span>
        )}
        <span className="ml-auto">Updated {timeAgo(group.latest.createdAt)}</span>
      </div>
    </button>
  );
}

function PromptDetail({
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
  const queryClient = useQueryClient();
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

  const remove = useMutation({
    mutationFn: () => api.delete(`/prompts/${current.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      toast.success(`Deleted ${group.key} v${current.version}`);
      if (group.versions.length === 1) onDeletedLast();
      else setVersion(group.versions.find((v) => v.id !== current.id)!.version);
    },
    onError: (err) => toast.error(err.message),
  });

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

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

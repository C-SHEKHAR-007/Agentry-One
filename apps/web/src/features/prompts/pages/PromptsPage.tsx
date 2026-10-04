import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bot, Brain, FileText, History, Plus, Search } from "lucide-react";
import { cn } from "../../../lib/utils";
import { PageHeader } from "../../../components/common/PageHeader";
import { Card } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { useAgentsQuery } from "../../agents/agents.api";
import { usePromptsQuery } from "../prompts.api";
import { groupPrompts } from "../grouping";
import { PromptListItem } from "../components/PromptListItem";
import { PromptDetail } from "../components/PromptDetail";
import { Stat } from "../components/bits";
import { PromptEditorDialog, type EditorMode } from "../components/PromptEditorDialog";

type SortKey = "recent" | "name" | "versions";

export function PromptsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("prompt");
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: agents = [] } = useAgentsQuery();
  const {
    data: prompts,
    isLoading,
    isError,
    refetch,
  } = usePromptsQuery();

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

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CornerDownLeft,
  FolderKanban,
  KeyRound,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  Workflow as WorkflowIcon,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { api } from "../../api/client";
import type { RecentWorkflow, RunSummary } from "../../api/types";
import { runCode, timeAgo } from "../../lib/format";
import { cn } from "../../lib/utils";
import { StatusDot } from "../StatusBadge";
import { NAV_FOOTER, NAV_SECTIONS } from "./nav";

interface Entry {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  group: string;
  hint?: string;
  status?: string;
  /** Extra text matched by the search (ids, project names). */
  keywords?: string;
}

const ACTIONS: Entry[] = [
  { id: "a-run", label: "Run a workflow", to: "/builder", icon: Zap, group: "Actions", hint: "Pick one and run it" },
  { id: "a-new-wf", label: "Create workflow", to: "/builder?new=1", icon: Plus, group: "Actions" },
  { id: "a-new-agent", label: "Create agent", to: "/agents/create-skill", icon: Bot, group: "Actions" },
  { id: "a-studio", label: "Generate content", to: "/studio", icon: Sparkles, group: "Actions", hint: "Content Studio" },
  { id: "a-runs", label: "Search runs", to: "/runs", icon: Search, group: "Actions" },
  { id: "a-connect", label: "Connect an account", to: "/integrations", icon: Share2, group: "Actions" },
  { id: "a-provider", label: "Add an AI provider", to: "/providers", icon: KeyRound, group: "Actions" },
];

const PAGES: Entry[] = [...NAV_SECTIONS.flatMap((s) => s.items), ...NAV_FOOTER]
  .filter((i) => i.to)
  .map((i) => ({ id: `p-${i.to}`, label: i.label, to: i.to!, icon: i.icon, group: "Pages" }));

/** ⌘K: jump anywhere, start common actions, reopen recent runs. With an empty
 * query it shows actions and recent runs; typing searches everything,
 * including run ids (RUN_8F92A1) and project names. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: agents } = useQuery<{ id: string; name: string }[]>({ queryKey: ["agents"], queryFn: () => api.get("/agents"), enabled: open });
  const { data: projects } = useQuery<{ id: string; name: string }[]>({ queryKey: ["projects"], queryFn: () => api.get("/projects"), enabled: open });
  const { data: workflows } = useQuery<{ id: string; name: string; project: { name: string } }[]>({
    queryKey: ["templates", "library"],
    queryFn: () => api.get("/templates"),
    enabled: open,
  });
  const { data: runs } = useQuery<RunSummary[]>({
    queryKey: ["template-runs", "all", 6],
    queryFn: () => api.get("/template-runs?status=all&limit=6"),
    enabled: open,
  });
  const { data: agentRuns } = useQuery<RecentWorkflow[]>({
    queryKey: ["workflows", "recent", 6, "all"],
    queryFn: () => api.get("/workflows/recent?limit=6"),
    enabled: open,
  });

  const recent = useMemo<Entry[]>(() => {
    const items = [
      ...(runs ?? []).map((r) => ({
        id: `r-${r.id}`,
        label: r.template.name,
        to: `/template-runs/${r.id}`,
        icon: WorkflowIcon,
        group: "Recent runs",
        hint: `${runCode(r.id)} · ${timeAgo(r.createdAt)}`,
        status: r.status,
        keywords: `${runCode(r.id)} ${r.id} ${r.project.name}`,
        at: r.createdAt,
      })),
      ...(agentRuns ?? []).map((w) => ({
        id: `w-${w.id}`,
        label: w.agentName,
        to: `/workflows/${w.id}`,
        icon: Play,
        group: "Recent runs",
        hint: `${runCode(w.id)} · ${timeAgo(w.createdAt)}`,
        status: w.status,
        keywords: `${runCode(w.id)} ${w.id} ${w.project.name}`,
        at: w.createdAt,
      })),
    ];
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);
  }, [runs, agentRuns]);

  const everything = useMemo<Entry[]>(
    () => [
      ...ACTIONS,
      ...recent,
      ...(workflows ?? []).map((w) => ({
        id: `t-${w.id}`,
        label: w.name,
        to: `/templates/${w.id}/edit`,
        icon: WorkflowIcon,
        group: "Workflows",
        hint: w.project.name,
        keywords: w.project.name,
      })),
      ...(agents ?? []).map((a) => ({ id: `ag-${a.id}`, label: a.name, to: `/agents/${a.id}`, icon: Bot, group: "Agents", keywords: a.id })),
      ...(projects ?? []).map((p) => ({ id: `pr-${p.id}`, label: p.name, to: `/projects/${p.id}`, icon: FolderKanban, group: "Projects" })),
      ...PAGES,
    ],
    [recent, workflows, agents, projects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...ACTIONS, ...recent, ...PAGES.slice(0, 6)];
    return everything.filter((e) => `${e.label} ${e.keywords ?? ""} ${e.group}`.toLowerCase().includes(q)).slice(0, 40);
  }, [everything, recent, query]);

  useEffect(() => setSelected(0), [query, open]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    onOpenChange(false);
    navigate(entry.to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="bottom-auto top-[18%] max-w-xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(filtered[selected]);
              }
            }}
            aria-label="Search agents, workflows, runs"
            placeholder="Search agents, workflows, runs…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:block">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-2 scrollbar-thin">
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for “{query}”</p>}
          {filtered.map((entry, i) => {
            const Icon = entry.icon;
            const showGroup = i === 0 || filtered[i - 1].group !== entry.group;
            return (
              <div key={entry.id}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{entry.group}</p>
                )}
                <button
                  data-index={i}
                  onClick={() => go(entry)}
                  onMouseEnter={() => setSelected(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                    i === selected ? "bg-primary/10 text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                      entry.group === "Actions" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {entry.status && <StatusDot status={entry.status} className="h-1.5 w-1.5" />}
                  {entry.hint && <span className="hidden shrink-0 truncate font-mono text-[11px] text-muted-foreground/80 sm:block">{entry.hint}</span>}
                  {i === selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 font-mono">↑</kbd>
            <kbd className="rounded border border-border px-1 font-mono">↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 font-mono">↵</kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="rounded border border-border px-1 font-mono">⌘K</kbd> toggle
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

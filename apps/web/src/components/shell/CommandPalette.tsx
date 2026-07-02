import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, LayoutDashboard, Bot, FolderKanban, Images, Plug, PlayCircle, CornerDownLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { api } from "../../api/client";
import { cn } from "../../lib/utils";

interface Entry {
  label: string;
  to: string;
  icon: LucideIcon;
  group: string;
}

const STATIC_ENTRIES: Entry[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, group: "Pages" },
  { label: "Agent Marketplace", to: "/agents", icon: Bot, group: "Pages" },
  { label: "Executions", to: "/executions", icon: PlayCircle, group: "Pages" },
  { label: "Projects", to: "/projects", icon: FolderKanban, group: "Pages" },
  { label: "Artifacts", to: "/artifacts", icon: Images, group: "Pages" },
  { label: "Providers", to: "/providers", icon: Plug, group: "Pages" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const { data: agents } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["agents"],
    queryFn: () => api.get("/agents"),
    enabled: open,
  });
  const { data: projects } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["projects"],
    queryFn: () => api.get("/projects"),
    enabled: open,
  });

  const entries = useMemo<Entry[]>(
    () => [
      ...STATIC_ENTRIES,
      ...(agents ?? []).map((a) => ({
        label: a.name,
        to: `/agents/${a.id}`,
        icon: Bot,
        group: "Agents",
      })),
      ...(projects ?? []).map((p) => ({
        label: p.name,
        to: `/projects/${p.id}`,
        icon: FolderKanban,
        group: "Projects",
      })),
    ],
    [agents, projects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    setSelected(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    onOpenChange(false);
    navigate(entry.to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[20%] translate-y-0 p-0 overflow-hidden max-w-xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
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
            placeholder="Search pages, agents, projects..."
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results</p>
          )}
          {filtered.map((entry, i) => {
            const Icon = entry.icon;
            const showGroup = i === 0 || filtered[i - 1].group !== entry.group;
            return (
              <div key={entry.to + entry.label}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {entry.group}
                  </p>
                )}
                <button
                  onClick={() => go(entry)}
                  onMouseEnter={() => setSelected(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm",
                    i === selected ? "bg-secondary text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{entry.label}</span>
                  {i === selected && (
                    <CornerDownLeft className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { Sparkles, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Tooltip } from "../ui/tooltip";
import { NAV_SECTIONS, NAV_FOOTER, type NavItem } from "./nav";

function NavEntry({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const base =
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors w-full min-w-0";
  const Icon = item.icon;

  if (!item.to) {
    const node = (
      <div
        aria-disabled
        className={cn(base, "cursor-default text-muted-foreground/50 select-none")}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <Badge
                variant={item.badge === "New" ? "default" : "outline"}
                className="ml-auto px-1.5 py-0 text-[10px]"
              >
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </div>
    );
    return collapsed ? <Tooltip label={`${item.label} (soon)`}>{node}</Tooltip> : node;
  }

  // NavLink can't match query-string links (e.g. /agents?filter=installed);
  // compare against the full path+search ourselves.
  const [pathname, search] = item.to.split("?");
  const pathMatches = item.end
    ? location.pathname === pathname
    : location.pathname === pathname || location.pathname.startsWith(pathname + "/");
  const searchMatches = search ? location.search === `?${search}` : item.end ? location.search === "" : true;
  const isActive = pathMatches && searchMatches;

  const node = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={cn(
        base,
        isActive
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <Badge variant="default" className="ml-auto px-1.5 py-0 text-[10px]">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );
  return collapsed ? <Tooltip label={item.label}>{node}</Tooltip> : node;
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2.5 px-4 py-4", collapsed && "justify-center px-2")}>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        {!collapsed && <span className="text-lg font-semibold tracking-tight">Agentry</span>}
      </div>

      {!collapsed && (
        <div className="mx-3 mb-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Workspace</p>
          <p className="truncate text-sm font-medium">Personal Workspace</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className="mt-3 first:mt-0">
            {section.label && !collapsed && (
              <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
            )}
            <div className="grid gap-0.5">
              {section.items.map((item) => (
                <NavEntry key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="grid gap-0.5">
          {NAV_FOOTER.map((item) => (
            <NavEntry key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        {!collapsed && (
          <p className="mt-2 px-3 text-[10px] text-muted-foreground/60">Agentry v1.0.0</p>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-card/50 transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <SidebarContent collapsed={collapsed} />
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-16 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      >
        {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}

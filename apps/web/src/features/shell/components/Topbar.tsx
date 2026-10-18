import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Menu, Search, Settings, UserCircle, Users } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { useSystemHealth } from "../../stats/stats.api";
import { cn } from "../../../lib/utils";
import { Button } from "../../../components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationDropdown } from "../../notifications/components/NotificationDropdown";

export function Topbar({
  onOpenMobileNav,
  onOpenPalette,
}: {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <button
        onClick={onOpenPalette}
        className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:border-border sm:flex"
      >
        <Search className="h-4 w-4" />
        <span>Search agents, workflows, runs…</span>
        <kbd className="ml-auto flex items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[11px]">
          ⌘K
        </kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        aria-label="Search"
        onClick={onOpenPalette}
      >
        <Search className="h-4 w-4" />
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        <HealthPill />
        <ThemeToggle />

        <NotificationDropdown />

        <UserMenu />
      </div>
    </header>
  );
}

/** Always-visible system verdict; opens Settings (full service list). */
function HealthPill() {
  const { data: health } = useSystemHealth();
  if (!health) return null;
  const core = health.api && health.db && health.redis;
  const online = health.workers.filter((w) => w.online).length;
  const ok = core && (health.workers.length === 0 || online > 0);
  return (
    <Link
      to="/settings"
      title={`API ${health.api ? "up" : "down"} · Postgres ${health.db ? "up" : "down"} · Redis ${health.redis ? "up" : "down"} · ${online}/${health.workers.length} workers online`}
      className={cn(
        "mr-1 hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors lg:flex",
        ok ? "border-success/30 bg-success/10 text-success hover:bg-success/15" : "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
      )}
    >
      <span className="status-dot h-1.5 w-1.5" data-live={ok ? "true" : undefined} />
      {ok ? "System healthy" : core ? "Workers offline" : "Degraded"}
    </Link>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  // Escape closes the menu wherever focus is (it stays on the avatar after a click).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const displayName = fullName || user?.email || "…";
  const initials =
    displayName
      .split(/[\s@.]+/)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const avatar = (size: string) =>
    user?.avatarUrl ? (
      <img
        src={user.avatarUrl}
        alt=""
        className={cn(size, "rounded-full border border-border/60 object-cover shadow-md")}
        referrerPolicy="no-referrer"
      />
    ) : (
      <span className={cn(size, "inline-flex items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-md")}>
        {initials}
      </span>
    );

  return (
    <div className="relative">
      {/* Just the picture in the header; who is signed in shows in the menu. */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center rounded-full p-0.5 transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
      >
        {avatar("h-8 w-8")}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-sm"
          >
            <div className="mb-1 flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-3">
              {avatar("h-10 w-10 shrink-0 text-sm")}
              <div className="min-w-0">
                {fullName && <p className="truncate text-sm font-medium">{fullName}</p>}
                <p className={cn("truncate", fullName ? "text-xs text-muted-foreground" : "text-sm font-medium")} title={user?.email ?? undefined}>
                  {user?.email}
                </p>
                {user?.role && (
                  <span className="mt-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium capitalize text-primary">{user.role}</span>
                )}
              </div>
            </div>
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <UserCircle className="h-4 w-4" /> Profile
            </Link>
            {user?.role === "owner" && (
              <Link
                to="/team"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Users className="h-4 w-4" /> Team
              </Link>
            )}
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <button
              onClick={() => { setOpen(false); void logout(); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

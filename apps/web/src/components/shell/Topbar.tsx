import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, LogOut, Menu, Search, Settings, UserCircle, Users } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationDropdown } from "./NotificationDropdown";

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
        className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border/60 bg-white/5 px-3 text-sm text-muted-foreground transition-colors hover:bg-white/8 hover:border-border sm:flex"
      >
        <Search className="h-4 w-4" />
        <span>Search anything...</span>
        <kbd className="ml-auto flex items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px]">
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
        <ThemeToggle />

        <NotificationDropdown />

        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const displayName = fullName || user?.email || "…";
  const initials =
    displayName
      .split(/[\s@.]+/)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 transition-colors hover:bg-white/8"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="h-8 w-8 rounded-full object-cover shadow-md border border-border/60"
          />
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary text-xs font-bold text-primary-foreground shadow-md">
            {initials}
          </span>
        )}
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{displayName}</span>
          <span className="block text-[11px] capitalize text-muted-foreground">{user?.role}</span>
        </span>
        <svg className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-sm"
          >
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-white/8 hover:text-foreground"
            >
              <UserCircle className="h-4 w-4" /> Profile
            </Link>
            <Link
              to="/team"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-white/8 hover:text-foreground"
            >
              <Users className="h-4 w-4" /> Team
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-white/8 hover:text-foreground"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <button
              onClick={() => { setOpen(false); void logout(); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-white/8 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

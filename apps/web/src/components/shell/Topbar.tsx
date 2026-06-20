import { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Menu, Search, Settings, Users } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../ui/button";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar({
  onOpenMobileNav,
  onOpenPalette,
}: {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <button
        onClick={onOpenPalette}
        className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 sm:flex"
      >
        <Search className="h-4 w-4" />
        <span>Search anything...</span>
        <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">
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

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const displayName = user?.name ?? user?.email ?? "…";
  const initials =
    displayName
      .split(/[\s@.]+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-secondary/60"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
          {initials}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{displayName}</span>
          <span className="block text-[11px] capitalize text-muted-foreground">{user?.role}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-md"
          >
            <Link
              to="/team"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-2.5 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              <Users className="h-4 w-4" /> Team
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-2.5 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import {
  LayoutDashboard,
  Store,
  Bot,
  UserCog,
  PlayCircle,
  Workflow,
  FolderKanban,
  Images,
  Plug,
  BarChart3,
  Wallet,
  Brain,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string; // absent => "Soon" (non-navigable)
  badge?: string;
  end?: boolean; // NavLink exact matching
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

// Items without a `to` are deliberate "Soon" placeholders -- the platform
// doesn't have these features yet and pretending otherwise would be worse
// than showing the roadmap.
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", icon: LayoutDashboard, to: "/", end: true }],
  },
  {
    label: "AI Agents",
    items: [
      { label: "Marketplace", icon: Store, to: "/agents", end: true },
      { label: "Installed", icon: Bot, to: "/agents?filter=installed" },
      { label: "My Agents", icon: UserCog, to: "/my-agents" },
    ],
  },
  {
    label: "Workflows",
    items: [
      { label: "Executions", icon: PlayCircle, to: "/executions" },
      { label: "Builder", icon: Workflow, to: "/builder" },
    ],
  },
  {
    label: "Library",
    items: [
      { label: "Projects", icon: FolderKanban, to: "/projects" },
      { label: "Artifacts", icon: Images, to: "/artifacts" },
      { label: "Providers", icon: Plug, to: "/providers" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", icon: BarChart3, to: "/analytics", badge: "New" },
      { label: "Cost Monitor", icon: Wallet, to: "/costs" },
      { label: "Prompts", icon: Brain, to: "/prompts" },
      { label: "Team", icon: Users, to: "/team" },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [{ label: "Settings", icon: Settings, to: "/settings" }];

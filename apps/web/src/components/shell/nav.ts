import {
  LayoutDashboard,
  Store,
  Bot,
  UserCog,
  PlayCircle,
  Workflow,
  LayoutTemplate,
  ListChecks,
  FolderKanban,
  Images,
  Plug,
  Brain,
  BarChart3,
  Wallet,
  Users,
  Settings,
  KeyRound,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string;
  badge?: string;
  end?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", icon: LayoutDashboard, to: "/", end: true }],
  },
  {
    label: "AI Agents",
    items: [
      { label: "Marketplace", icon: Store, to: "/agents", end: true },
      { label: "Installed Agents", icon: Bot, to: "/agents?filter=installed" },
      { label: "My Agents", icon: UserCog, to: "/my-agents" },
    ],
  },
  {
    label: "Workflows",
    items: [
      { label: "Workflows", icon: Workflow, to: "/executions" },
      { label: "Executions", icon: PlayCircle, to: "/executions" },
    ],
  },
  {
    label: "Templates",
    items: [
      { label: "Templates", icon: LayoutTemplate },
      { label: "Runs", icon: ListChecks },
      { label: "Projects", icon: FolderKanban, to: "/projects" },
      { label: "Artifacts", icon: Images, to: "/artifacts" },
      { label: "Providers", icon: Plug, to: "/providers" },
      { label: "Memory", icon: Brain, to: "/prompts" },
    ],
  },
  {
    items: [
      { label: "Analytics", icon: BarChart3, to: "/analytics", badge: "New" },
      { label: "Cost Monitor", icon: Wallet, to: "/costs" },
      { label: "Team", icon: Users, to: "/team" },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { label: "Settings", icon: Settings, to: "/settings" },
  { label: "API Keys", icon: KeyRound, to: "/settings" },
];

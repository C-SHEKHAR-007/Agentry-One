import {
  LayoutDashboard,
  Store,
  Bot,
  UserCog,
  PlayCircle,
  Workflow,
  FolderKanban,
  Images,
  Brain,
  BarChart3,
  Wallet,
  Users,
  Settings,
  KeyRound,
  UserCircle,
  Share2,
  Sparkles,
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
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/", end: true },
      { label: "Content Studio", icon: Sparkles, to: "/studio", badge: "New" },
      { label: "Projects", icon: FolderKanban, to: "/projects" },
    ],
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
      { label: "Workflows", icon: Workflow, to: "/builder" },
      { label: "Executions", icon: PlayCircle, to: "/executions" },
      { label: "Artifacts", icon: Images, to: "/artifacts" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Prompts & Memory", icon: Brain, to: "/prompts" },
      { label: "Integrations", icon: Share2, to: "/integrations", badge: "New" },
      { label: "Analytics", icon: BarChart3, to: "/analytics" },
      { label: "Cost Monitor", icon: Wallet, to: "/costs" },
      { label: "Team", icon: Users, to: "/team" },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { label: "Profile", icon: UserCircle, to: "/profile" },
  { label: "API Keys", icon: KeyRound, to: "/providers" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

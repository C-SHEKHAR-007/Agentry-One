import {
  LayoutDashboard,
  Bot,
  Activity,
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

// Grouped by the orchestration mental model: agents are actors, workflows
// orchestrate them, runs are executions of workflows.
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", icon: LayoutDashboard, to: "/", end: true },
      { label: "Content Studio", icon: Sparkles, to: "/studio", badge: "New" },
      { label: "Projects", icon: FolderKanban, to: "/projects" },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Agents", icon: Bot, to: "/agents" },
      { label: "Workflows", icon: Workflow, to: "/builder" },
      { label: "Prompts & Memory", icon: Brain, to: "/prompts" },
      { label: "Artifacts", icon: Images, to: "/artifacts" },
    ],
  },
  {
    label: "Observe",
    items: [
      { label: "Runs", icon: Activity, to: "/runs" },
      { label: "Analytics", icon: BarChart3, to: "/analytics" },
      { label: "Cost Monitor", icon: Wallet, to: "/costs" },
    ],
  },
  {
    label: "Connect",
    items: [
      { label: "Integrations", icon: Share2, to: "/integrations", badge: "New" },
      { label: "AI Providers", icon: KeyRound, to: "/providers" },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { label: "Team", icon: Users, to: "/team" },
  { label: "Profile", icon: UserCircle, to: "/profile" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

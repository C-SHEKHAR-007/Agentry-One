// Curated preview of planned agents shown in the marketplace as
// non-installable "Coming Soon" cards. Purely presentational -- the real
// registry comes from GET /agents.
export interface ComingSoonAgent {
  id: string;
  name: string;
  tagline: string;
  icon: string; // lucide icon name resolved in AgentCard
  category: string;
}

export const comingSoonAgents: ComingSoonAgent[] = [
  {
    id: "video-generator",
    name: "Video Generator",
    tagline: "Split, process, and generate video content",
    icon: "Clapperboard",
    category: "Video",
  },
  {
    id: "blog-writer",
    name: "Blog Writer",
    tagline: "Long-form articles from a topic and outline",
    icon: "PenLine",
    category: "Text",
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    tagline: "Query, chart, and summarize your datasets",
    icon: "BarChart3",
    category: "Data",
  },
  {
    id: "voice-agent",
    name: "Voice Agent",
    tagline: "Text-to-speech and voice cloning",
    icon: "Mic",
    category: "Audio",
  },
  {
    id: "code-assistant",
    name: "Code Assistant",
    tagline: "Generate and review code with AI",
    icon: "Code2",
    category: "Developer",
  },
];

import { Clapperboard, Globe, ImageIcon, Mic, PenLine, Send, type LucideIcon } from "lucide-react";
import type { Role } from "../../lib/studioPlan";

export interface RoleMeta {
  label: string;
  /** Short noun used in pipeline previews ("Research → Caption → …"). */
  short: string;
  description: string;
  /** Shown while the step is running. */
  working: string;
  icon: LucideIcon;
}

export const ROLES: Record<Role, RoleMeta> = {
  search: {
    label: "Trend research",
    short: "Research",
    description: "Searches the web for fresh angles and talking points.",
    working: "Researching the topic…",
    icon: Globe,
  },
  text: {
    label: "Caption & copy",
    short: "Caption",
    description: "Writes a caption with a hook and hashtags.",
    working: "Writing the caption…",
    icon: PenLine,
  },
  image: {
    label: "Visual",
    short: "Visual",
    description: "Generates an image for the post.",
    working: "Generating the visual…",
    icon: ImageIcon,
  },
  voice: {
    label: "Voiceover",
    short: "Voiceover",
    description: "Narrates the caption as audio.",
    working: "Recording the voiceover…",
    icon: Mic,
  },
  video: {
    label: "Short video",
    short: "Video",
    description: "Combines visual, voiceover and caption into a video.",
    working: "Assembling the video…",
    icon: Clapperboard,
  },
  publish: {
    label: "Auto-publish",
    short: "Publish",
    description: "Posts the result to a connected social account.",
    working: "Publishing…",
    icon: Send,
  },
};

export const LIVE_RUN_STATUSES = ["pending", "running", "awaiting_review", "cancelling"];

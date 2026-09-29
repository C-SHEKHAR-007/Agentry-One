import { Briefcase, Camera, Globe, MessageCircle, Radio, Send, Tv, Video, type LucideIcon } from "lucide-react";

export interface Platform {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  badge: string;
}

/** Platforms an account can be connected for. */
export const PLATFORMS: Platform[] = [
  {
    id: "instagram",
    name: "Instagram",
    icon: Camera,
    description: "Direct Login (Username & Password via mobile emulation) or Meta Graph API. Publishes posts and Reels.",
    badge: "Direct Login Supported",
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: MessageCircle,
    description: "Publish tweets, threads, and media via Direct API Keys (Consumer Key/Secret) or Bearer Token.",
    badge: "API Keys / Bearer",
  },
  {
    id: "telegram",
    name: "Telegram Channel / Group",
    icon: Send,
    description: "Instantly publish messages, high-res photos, and videos to any public or private channel via Bot Token.",
    badge: "Instant Bot Connect",
  },
  {
    id: "discord",
    name: "Discord Server",
    icon: Radio,
    description: "Broadcast rich announcements, images, and videos to any Discord channel via Webhook URL or Bot Token.",
    badge: "Webhook / Bot",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Briefcase,
    description: "Publish professional posts and company updates to LinkedIn Profiles and Pages via Access Token or OAuth.",
    badge: "Access Token / OAuth",
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    icon: Globe,
    description: "Publish posts, photos, and video reels to Facebook Pages via Page Access Token and Page ID.",
    badge: "Page Token",
  },
  {
    id: "youtube",
    name: "YouTube Shorts",
    icon: Video,
    description: "Publish vertical video shorts and video content via YouTube Data API v3 token or OAuth.",
    badge: "Direct Token / OAuth",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: Tv,
    description: "Publish vertical short-form reels and videos via TikTok Open API credentials.",
    badge: "API Token",
  },
];

export const platformById = (id: string) => PLATFORMS.find((p) => p.id === id);

/** Credential fields of the connect form (all optional; which apply depends on the platform). */
export const EMPTY_CREDENTIALS = {
  username: "",
  password: "",
  handle: "",
  apiKey: "",
  apiSecret: "",
  accessToken: "",
  accessTokenSecret: "",
  botToken: "",
  chatId: "",
  webhookUrl: "",
  pageId: "",
};
export type Credentials = typeof EMPTY_CREDENTIALS;

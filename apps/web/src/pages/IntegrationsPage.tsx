import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plug,
  Plus,
  Trash2,
  Camera,
  MessageCircle,
  Briefcase,
  Video,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Send,
  Lock,
  Globe,
  Radio,
  Tv,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { Badge } from "../components/ui/badge";

interface Project {
  id: string;
  name: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  status: string;
  createdAt: string;
}

const PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram",
    icon: Camera,
    color: "from-purple-500 to-pink-500",
    description: "Direct Login (Username & Password via mobile emulation) or Meta Graph API. Publishes posts and Reels.",
    supportsDirectLogin: true,
    directFields: ["username", "password"],
    badge: "Direct Login Supported",
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: MessageCircle,
    color: "from-blue-400 to-blue-600",
    description: "Publish tweets, threads, and media via Direct API Keys (Consumer Key/Secret) or Bearer Token.",
    supportsDirectLogin: true,
    directFields: ["twitter_keys", "bearer_token"],
    badge: "API Keys / Bearer",
  },
  {
    id: "telegram",
    name: "Telegram Channel / Group",
    icon: Send,
    color: "from-sky-400 to-blue-500",
    description: "Instantly publish messages, high-res photos, and videos to any public or private channel via Bot Token.",
    supportsDirectLogin: true,
    directFields: ["telegram_bot"],
    badge: "Instant Bot Connect",
  },
  {
    id: "discord",
    name: "Discord Server",
    icon: Radio,
    color: "from-indigo-500 to-purple-600",
    description: "Broadcast rich announcements, images, and videos to any Discord channel via Webhook URL or Bot Token.",
    supportsDirectLogin: true,
    directFields: ["discord_webhook"],
    badge: "Webhook / Bot",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Briefcase,
    color: "from-blue-600 to-blue-800",
    description: "Publish professional posts and company updates to LinkedIn Profiles and Pages via Access Token or OAuth.",
    supportsDirectLogin: true,
    directFields: ["token_only"],
    badge: "Access Token / OAuth",
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    icon: Globe,
    color: "from-blue-500 to-indigo-600",
    description: "Publish posts, photos, and video reels to Facebook Pages via Page Access Token and Page ID.",
    supportsDirectLogin: true,
    directFields: ["facebook_page"],
    badge: "Page Token",
  },
  {
    id: "youtube",
    name: "YouTube Shorts",
    icon: Video,
    color: "from-red-500 to-rose-600",
    description: "Publish vertical video shorts and video content via YouTube Data API v3 token or OAuth.",
    supportsDirectLogin: true,
    directFields: ["token_only"],
    badge: "Direct Token / OAuth",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: Tv,
    color: "from-zinc-800 to-black",
    description: "Publish vertical short-form reels and videos via TikTok Open API credentials.",
    supportsDirectLogin: true,
    directFields: ["token_only"],
    badge: "API Token",
  },
];

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [authMode, setAuthMode] = useState<"direct" | "raw_token">("direct");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/projects"),
  });

  const activeProjectId = projectId || projects?.[0]?.id || "";

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["socialAccounts", activeProjectId],
    queryFn: () => api.get<SocialAccount[]>(`/social-accounts?projectId=${activeProjectId}`),
    enabled: Boolean(activeProjectId),
  });

  // Direct login form fields
  const [form, setForm] = useState({
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
  });

  const connectDirect = useMutation({
    mutationFn: () =>
      api.post("/social-accounts/direct-login", {
        projectId: activeProjectId,
        platform: selectedPlatform,
        username: form.username || undefined,
        password: form.password || undefined,
        handle: form.handle || form.username || undefined,
        apiKey: form.apiKey || undefined,
        apiSecret: form.apiSecret || undefined,
        accessToken: form.accessToken || undefined,
        accessTokenSecret: form.accessTokenSecret || undefined,
        botToken: form.botToken || undefined,
        chatId: form.chatId || undefined,
        webhookUrl: form.webhookUrl || undefined,
        pageId: form.pageId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socialAccounts", activeProjectId] });
      toast.success(`Successfully connected ${selectedPlatform} account!`);
      setShowModal(false);
      setForm({
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
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testConnection = useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: boolean; status: string; handle?: string; message?: string }>(`/social-accounts/${id}/test`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["socialAccounts", activeProjectId] });
      if (data.success) {
        toast.success(data.message || `Account verified! Connected as ${data.handle || "active"}`);
      }
    },
    onError: (err: any) => toast.error(`Verification error: ${err.message}`),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => api.delete(`/social-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socialAccounts", activeProjectId] });
      toast.success("Account disconnected");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const connectMock = useMutation({
    mutationFn: (platform: string) =>
      api.post("/social-accounts/direct-login", {
        projectId: activeProjectId,
        platform,
        username: `dev_${platform}`,
        password: "mock_password_123",
        handle: `@dev_${platform}`,
        botToken: "mock_bot_token_12345",
        chatId: "@dev_channel",
        webhookUrl: "https://discord.com/api/webhooks/mock/test",
        accessToken: "mock_access_token_xyz",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socialAccounts", activeProjectId] });
      toast.success(`⚡ Quick mock ${selectedPlatform} account connected! Ready for pipeline testing.`);
      setShowModal(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openConnectModal = (platformId: string) => {
    setSelectedPlatform(platformId);
    setShowModal(true);
  };

  const currentPlatformMeta = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Social Media Accounts & Direct Connectors"
        description="Connect Instagram, X/Twitter, Telegram, Discord, LinkedIn, Facebook, and YouTube with Direct Login (Username/Password, Bot Tokens, API Keys, or Webhooks) or OAuth 2.0. Stored with enterprise AES-256 encryption."
      />

      {projects && projects.length > 1 && (
        <div className="w-72">
          <Label>Active Project Scope</Label>
          <Select value={activeProjectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {isLoading && <Skeleton className="h-40" />}

      {/* Connected Accounts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Connected Accounts ({accounts?.length || 0})
          </h2>

          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setSelectedPlatform("instagram");
              setShowModal(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect New Account
          </Button>
        </div>

        <div className="grid gap-3">
          {accounts?.map((acc) => {
            const platformMeta = PLATFORMS.find((p) => p.id === acc.platform);
            const PlatformIcon = platformMeta?.icon || Plug;
            return (
              <Card
                key={acc.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel border-l-4 border-l-primary"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <PlatformIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize text-foreground">{acc.platform}</span>
                      <Badge
                        variant={acc.status === "active" ? "default" : acc.status === "mock" ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {acc.status === "active" ? "Connected & Ready" : acc.status === "mock" ? "Dev Mock Active" : acc.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{acc.handle || "Authorized Account"}</span>
                      <span>·</span>
                      <span>Connected {new Date(acc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => testConnection.mutate(acc.id)}
                    disabled={testConnection.isPending}
                  >
                    <RefreshCw className={`h-3 w-3 ${testConnection.isPending ? "animate-spin text-primary" : ""}`} />
                    Test Connection
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteAccount.mutate(acc.id)}
                    disabled={deleteAccount.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive hover:scale-110 transition-transform" />
                  </Button>
                </div>
              </Card>
            );
          })}

          {accounts?.length === 0 && (
            <div className="p-8 text-center border border-dashed rounded-xl text-muted-foreground bg-card/20">
              No social accounts connected to this project yet. Click &quot;Connect New Account&quot; or choose a platform below to log in directly.
            </div>
          )}
        </div>
      </div>

      {/* Available Social Platforms Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Available Social Platforms</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <Card
                key={p.id}
                glass
                className="p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => openConnectModal(p.id)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge variant="outline" className="text-[11px] group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {p.badge}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-foreground text-base pt-1">{p.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{p.description}</p>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-primary font-medium">
                  <span>Connect Directly</span>
                  <Plus className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Direct Login / Connect Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-xl glass-panel border-primary/40 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <currentPlatformMeta.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Connect {currentPlatformMeta.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Direct Credentials &amp; Automatic Social Publisher
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  ✕
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {/* 1-Click Quick Mock Account */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Dev &amp; Testing Mode</span>
                    <p className="text-muted-foreground text-[11px]">Connect a simulated {currentPlatformMeta.name} mock account in 1-click.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/20 shrink-0 text-xs h-8 px-3"
                  disabled={connectMock.isPending}
                  onClick={() => connectMock.mutate(selectedPlatform)}
                >
                  {connectMock.isPending ? <Spinner className="h-3 w-3 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  ⚡ Quick Mock
                </Button>
              </div>

              {/* Platform Selector & Mode Toggle */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Platform</Label>
                  <Select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Connection Mode</Label>
                  <div className="flex rounded-md bg-muted/40 p-1 border border-border/40">
                    <button
                      type="button"
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                        authMode === "direct" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setAuthMode("direct")}
                    >
                      Direct Credentials
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                        authMode === "raw_token" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setAuthMode("raw_token")}
                    >
                      Raw Access Token
                    </button>
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  connectDirect.mutate();
                }}
                className="space-y-4"
              >
                {/* 1. INSTAGRAM DIRECT LOGIN */}
                {selectedPlatform === "instagram" && authMode === "direct" && (
                  <div className="space-y-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                      <Camera className="h-4 w-4" /> Direct Mobile or Session Login (No Meta Developer App Required!)
                    </div>
                    <div>
                      <Label>Instagram Username / Handle</Label>
                      <Input
                        placeholder="your_handle (do NOT enter your email address)"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        required
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Enter your exact Instagram handle (e.g. <code>my_handle</code>). Do not use your email address.
                      </p>
                    </div>
                    <div>
                      <Label>Instagram Password (or Session ID Cookie)</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Your Instagram Password or sessionid cookie"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        💡 <strong>Tip:</strong> If Instagram triggers a security challenge (CAA challenge / 2FA), paste your <code>sessionid</code> cookie from browser DevTools to bypass login checkpoints completely.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. TWITTER / X DIRECT LOGIN */}
                {(selectedPlatform === "twitter" || selectedPlatform === "x") && authMode === "direct" && (
                  <div className="space-y-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                      <MessageCircle className="h-4 w-4" /> Direct Twitter API Credentials
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>API Key (Consumer Key)</Label>
                        <Input
                          placeholder="e.g. abcd1234efgh"
                          value={form.apiKey}
                          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>API Key Secret</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={form.apiSecret}
                          onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>User Access Token</Label>
                        <Input
                          placeholder="e.g. 123456789-abcdef"
                          value={form.accessToken}
                          onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>User Access Token Secret</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={form.accessTokenSecret}
                          onChange={(e) => setForm({ ...form, accessTokenSecret: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Or Bearer Token (App-Only / User Token)</Label>
                      <Input
                        type="password"
                        placeholder="AAAAAAAAAAAAAAAAAAAAA..."
                        value={form.accessToken}
                        onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* 3. TELEGRAM BOT DIRECT LOGIN */}
                {selectedPlatform === "telegram" && authMode === "direct" && (
                  <div className="space-y-3 p-4 rounded-xl bg-sky-500/5 border border-sky-500/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                      <Send className="h-4 w-4" /> Telegram Bot Credentials
                    </div>
                    <div>
                      <Label>Telegram Bot Token (from @BotFather)</Label>
                      <Input
                        placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        value={form.botToken}
                        onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Target Channel / Group ID (Optional)</Label>
                      <Input
                        placeholder="e.g. @your_channel or -100123456789"
                        value={form.chatId}
                        onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Make sure your bot is added as an Administrator to your channel.
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. DISCORD WEBHOOK / BOT */}
                {selectedPlatform === "discord" && authMode === "direct" && (
                  <div className="space-y-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                      <Radio className="h-4 w-4" /> Discord Webhook or Bot Token
                    </div>
                    <div>
                      <Label>Discord Channel Webhook URL</Label>
                      <Input
                        placeholder="https://discord.com/api/webhooks/123456789/abcd_efgh..."
                        value={form.webhookUrl}
                        onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                      />
                    </div>
                    <div className="pt-2 text-center text-xs text-muted-foreground">--- OR ---</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Bot Token</Label>
                        <Input
                          type="password"
                          placeholder="MTA2..."
                          value={form.botToken}
                          onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Channel ID</Label>
                        <Input
                          placeholder="123456789012345678"
                          value={form.chatId}
                          onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. FACEBOOK PAGE */}
                {selectedPlatform === "facebook" && authMode === "direct" && (
                  <div className="space-y-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                      <Globe className="h-4 w-4" /> Facebook Page Credentials
                    </div>
                    <div>
                      <Label>Page Access Token</Label>
                      <Input
                        type="password"
                        placeholder="EAA..."
                        value={form.accessToken}
                        onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Page ID (Optional)</Label>
                      <Input
                        placeholder="e.g. 10987654321"
                        value={form.pageId}
                        onChange={(e) => setForm({ ...form, pageId: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* 6. RAW ACCESS TOKEN / GENERIC PLATFORM (LinkedIn, YouTube, TikTok, etc.) */}
                {(authMode === "raw_token" || ["linkedin", "youtube", "tiktok"].includes(selectedPlatform)) && (
                  <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <KeyRound className="h-4 w-4 text-primary" /> API Access Token / OAuth Bearer
                    </div>
                    <div>
                      <Label>Access Token / API Key</Label>
                      <Input
                        type="password"
                        placeholder={`Paste ${currentPlatformMeta.name} Access Token`}
                        value={form.accessToken}
                        onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Account Handle / Identifier (Optional)</Label>
                      <Input
                        placeholder="e.g. @yourbrand"
                        value={form.handle}
                        onChange={(e) => setForm({ ...form, handle: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* Footer buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 text-emerald-500" />
                    <span>AES-256 Encrypted</span>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={connectDirect.isPending}>
                      {connectDirect.isPending ? <Spinner className="mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Save &amp; Connect Account
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import { Globe, KeyRound, MessageCircle, Radio, Send } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type { Credentials } from "../platforms";

/** The credential inputs for every platform but Instagram's direct login. */
export function CredentialFields({
  selectedPlatform,
  platformName,
  authMode,
  form,
  setForm,
}: {
  selectedPlatform: string;
  platformName: string;
  authMode: "direct" | "raw_token";
  form: Credentials;
  setForm: (f: Credentials) => void;
}) {
  return (
    <>
      {/* 2. TWITTER / X DIRECT LOGIN */}
      {(selectedPlatform === "twitter" || selectedPlatform === "x") && authMode === "direct" && (
        <div className="space-y-3 p-4 rounded-xl bg-chart-3/5 border border-chart-3/20">
          <div className="flex items-center gap-2 text-xs font-semibold text-chart-3">
            <MessageCircle className="h-4 w-4" /> Direct Twitter API Credentials
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>API Key (Consumer Key)</Label>
              <Input
                name="tw_consumer_key"
                autoComplete="off"
                placeholder="e.g. abcd1234efgh"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
            </div>
            <div>
              <Label>API Key Secret</Label>
              <Input
                name="tw_consumer_secret"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.apiSecret}
                onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
              />
            </div>
            <div>
              <Label>User Access Token</Label>
              <Input
                name="tw_user_token"
                autoComplete="off"
                placeholder="e.g. 123456789-abcdef"
                value={form.accessToken}
                onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              />
            </div>
            <div>
              <Label>User Access Token Secret</Label>
              <Input
                name="tw_token_secret"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.accessTokenSecret}
                onChange={(e) => setForm({ ...form, accessTokenSecret: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Or Bearer Token (App-Only / User Token)</Label>
            <Input
              name="tw_bearer_token"
              type="password"
              autoComplete="new-password"
              placeholder="AAAAAAAAAAAAAAAAAAAAA..."
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* 3. TELEGRAM BOT DIRECT LOGIN */}
      {selectedPlatform === "telegram" && authMode === "direct" && (
        <div className="space-y-3 p-4 rounded-xl bg-chart-3/5 border border-chart-3/20">
          <div className="flex items-center gap-2 text-xs font-semibold text-chart-3">
            <Send className="h-4 w-4" /> Telegram Bot Credentials
          </div>
          <div>
            <Label>Telegram Bot Token (from @BotFather)</Label>
            <Input
              name="tg_bot_token"
              autoComplete="off"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={form.botToken}
              onChange={(e) => setForm({ ...form, botToken: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Target Channel / Group ID (Optional)</Label>
            <Input
              name="tg_chat_id"
              autoComplete="off"
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
        <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Radio className="h-4 w-4" /> Discord Webhook or Bot Token
          </div>
          <div>
            <Label>Discord Channel Webhook URL</Label>
            <Input
              name="dc_webhook_url"
              autoComplete="off"
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
                name="dc_bot_token"
                type="password"
                autoComplete="new-password"
                placeholder="MTA2..."
                value={form.botToken}
                onChange={(e) => setForm({ ...form, botToken: e.target.value })}
              />
            </div>
            <div>
              <Label>Channel ID</Label>
              <Input
                name="dc_channel_id"
                autoComplete="off"
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
        <div className="space-y-3 p-4 rounded-xl bg-chart-3/5 border border-chart-3/20">
          <div className="flex items-center gap-2 text-xs font-semibold text-chart-3">
            <Globe className="h-4 w-4" /> Facebook Page Credentials
          </div>
          <div>
            <Label>Page Access Token</Label>
            <Input
              name="fb_page_token"
              type="password"
              autoComplete="new-password"
              placeholder="EAA..."
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Facebook Page ID</Label>
            <Input
              name="fb_page_id"
              autoComplete="off"
              placeholder="e.g. 104829105829104"
              value={form.pageId}
              onChange={(e) => setForm({ ...form, pageId: e.target.value })}
              required
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
              name="platform_raw_token"
              type="password"
              autoComplete="new-password"
              placeholder={`Paste ${platformName} Access Token`}
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Account Handle / Identifier (Optional)</Label>
            <Input
              name="platform_raw_handle"
              autoComplete="off"
              placeholder="e.g. @yourbrand"
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
            />
          </div>
        </div>
      )}
    </>
  );
}

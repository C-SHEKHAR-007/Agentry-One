import { useState } from "react";
import { Camera, ExternalLink, Eye, EyeOff, Globe, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type { useInstagramBrowserLogin } from "../hooks/useInstagramBrowserLogin";
import type { Credentials } from "../platforms";

/** Instagram: one-click browser login through the helper, or credentials. */
export function InstagramConnect({
  login,
  form,
  setForm,
}: {
  login: ReturnType<typeof useInstagramBrowserLogin>;
  form: Credentials;
  setForm: (f: Credentials) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="space-y-4">
      {/* Automated Browser Login (No manual copy-paste) */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Globe className="h-4 w-4 text-primary" />
            1-Click Automated Browser Login
          </div>
          <Badge className="bg-primary/20 text-primary text-[11px]">Zero Copy-Paste</Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Opens a real Google Chrome window on your screen to log into Instagram. Once logged in, Agentry automatically captures your session cookie and connects your account without touching DevTools.
        </p>
        {login.helperOnline === false && (
          <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/20 text-[11px] text-warning flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <span>Local browser helper daemon is currently offline.</span>
              <span className="block text-muted-foreground mt-0.5">
                Run <code>python3 scripts/instagram_browser_login.py --daemon</code> on your desktop, or use the manual credential inputs below.
              </span>
            </div>
          </div>
        )}

        {login.loggingIn ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2.5 p-3 rounded-lg bg-primary/10 border border-primary/40 text-xs text-primary">
              <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
              <span className="font-medium">{login.message || "Waiting for Instagram login in Chrome..."}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={login.cancel}
              className="w-full text-xs text-muted-foreground hover:text-foreground h-7"
            >
              Cancel browser login
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={login.start}
            className="w-full gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open Instagram in Browser &amp; Auto-Connect
          </Button>
        )}
      </div>

      <div className="relative flex py-1 items-center">
        <div className="flex-grow border-t border-border/60"></div>
        <span className="flex-shrink mx-3 text-[11px] text-muted-foreground uppercase font-medium">Or enter credentials manually</span>
        <div className="flex-grow border-t border-border/60"></div>
      </div>

      <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Camera className="h-4 w-4" /> Manual Credentials / Session Cookie
        </div>
        <div>
          <Label>Instagram Username / Handle</Label>
          <Input
            name="ig_manual_username"
            autoComplete="off"
            placeholder="your_handle (do NOT enter your email address)"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Enter your exact Instagram handle (e.g. <code>my_handle</code>). Do not use your email address.
          </p>
        </div>
        <div>
          <Label>Instagram Password (or Session ID Cookie)</Label>
          <div className="relative">
            <Input
              name="ig_manual_secret"
              autoComplete="new-password"
              type={showPassword ? "text" : "password"}
              placeholder="Your Instagram Password or sessionid cookie"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

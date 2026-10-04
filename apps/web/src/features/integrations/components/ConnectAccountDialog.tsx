import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Lock } from "lucide-react";
import { errorMessage } from "../../../services/http/errors";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Spinner } from "../../../components/ui/spinner";
import { useInstagramBrowserLogin } from "../hooks/useInstagramBrowserLogin";
import { EMPTY_CREDENTIALS, PLATFORMS, type Credentials } from "../platforms";
import { useConnectSocialAccountMutation } from "../socialAccounts.api";
import { CredentialFields } from "./CredentialFields";
import { InstagramConnect } from "./InstagramConnect";

/** Connects an account to the project: credentials, a raw token, or (for
 * Instagram) the one-click browser login. */
export function ConnectAccountDialog({
  open,
  onClose,
  projectId,
  selectedPlatform,
  onPlatformChange,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  selectedPlatform: string;
  onPlatformChange: (id: string) => void;
}) {
  const [authMode, setAuthMode] = useState<"direct" | "raw_token">("direct");
  const [form, setForm] = useState<Credentials>(EMPTY_CREDENTIALS);
  const currentPlatformMeta = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];
  const login = useInstagramBrowserLogin({ projectId, enabled: open && selectedPlatform === "instagram", onConnected: onClose });

  const [connect, connectState] = useConnectSocialAccountMutation();
  const connectDirect = {
    isPending: connectState.isLoading,
    mutate: () =>
      connect({
        projectId,
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
      })
        .unwrap()
        .then(() => {
          toast.success(`Successfully connected ${selectedPlatform} account!`);
          onClose();
          setForm(EMPTY_CREDENTIALS);
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose aria-describedby={undefined} className="max-w-xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Connect an account</DialogTitle>
        <Card className="w-full max-w-xl glass-panel border-primary/40 shadow-2xl">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <currentPlatformMeta.icon className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>
                    Connect {currentPlatformMeta.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Direct Credentials &amp; Automatic Social Publisher
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
                ✕
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">


            {/* Platform Selector & Mode Toggle */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Platform</Label>
                <Select
                  value={selectedPlatform}
                  onChange={(e) => onPlatformChange(e.target.value)}
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
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                connectDirect.mutate();
              }}
              className="space-y-4"
            >
              {selectedPlatform === "instagram" && authMode === "direct" && (
                <InstagramConnect login={login} form={form} setForm={setForm} />
              )}
              <CredentialFields
                selectedPlatform={selectedPlatform}
                platformName={currentPlatformMeta.name}
                authMode={authMode}
                form={form}
                setForm={setForm}
              />

              {/* Footer buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-border/40">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 text-success" />
                  <span>AES-256 Encrypted</span>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={onClose}>
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
      </DialogContent>
    </Dialog>
  );
}

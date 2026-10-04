import { Plug, RefreshCw, Trash2 } from "lucide-react";
import type { SocialAccount } from "../../../models";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { platformById } from "../platforms";

/** A connected account, with test and disconnect actions. */
export function AccountCard({
  acc,
  testing,
  deleting,
  onTest,
  onDelete,
}: {
  acc: SocialAccount;
  testing: boolean;
  deleting: boolean;
  onTest: () => void;
  onDelete: () => void;
}) {
  const PlatformIcon = platformById(acc.platform)?.icon || Plug;
  return (
    <Card
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
              variant={acc.status === "active" ? "default" : "destructive"}
              className="text-xs"
            >
              {acc.status === "active" ? "Connected & Ready" : acc.status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span className="font-medium text-foreground">{acc.handle || "Authorized Account"}</span>
            <span>·</span>
            <span>Connected {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : ""}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={onTest}
          disabled={testing}
        >
          <RefreshCw className={`h-3 w-3 ${testing ? "animate-spin text-primary" : ""}`} />
          Test Connection
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          aria-label={`Disconnect ${acc.handle || acc.platform}`}
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4 text-destructive hover:scale-110 transition-transform" />
        </Button>
      </div>
    </Card>
  );
}

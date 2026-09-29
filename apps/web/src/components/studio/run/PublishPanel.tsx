import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, ExternalLink, Send } from "lucide-react";
import type { SocialAccount } from "../../../models";
import { useStartAgentRunMutation } from "../../../features/runs/agentRuns.api";
import { errorMessage } from "../../../services/http/errors";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Label } from "../../ui/label";
import { Select } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { type RunStep, useArtifactText, useStepArtifacts } from "./shared";

/** Manual publish: review the caption, then post to a connected account. */
export function PublishPanel({
  projectId,
  accounts,
  textStep,
  imageStep,
}: {
  projectId: string;
  accounts: SocialAccount[];
  textStep?: RunStep;
  imageStep?: RunStep;
}) {
  const { data: textArtifacts } = useStepArtifacts(textStep);
  const { data: imageArtifacts } = useStepArtifacts(imageStep);
  const textArtifact = textArtifacts?.find((a) => a.kind === "text");
  const imageArtifact = imageArtifacts?.find((a) => a.kind === "image");
  const { data: generated } = useArtifactText(textArtifact?.id);

  const [caption, setCaption] = useState("");
  const [touched, setTouched] = useState(false);
  const [attachImage, setAttachImage] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [dispatched, setDispatched] = useState<string | null>(null);

  useEffect(() => {
    if (!touched && generated) setCaption(generated);
  }, [generated, touched]);
  useEffect(() => {
    if (!accountId && accounts.length === 1) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const [startRun, publishState] = useStartAgentRunMutation();
  const publish = {
    isPending: publishState.isLoading,
    mutate: () =>
      startRun({
        projectId,
        agentId: "social-publisher",
        input: {
          socialAccountId: accountId,
          text: caption,
          // The storage key is an artifact reference the publisher resolves
          // itself (local artifact or Azure blob) -- no browser-only URL.
          ...(attachImage && imageArtifact ? { mediaUrl: imageArtifact.storageKey } : {}),
        },
      })
        .unwrap()
        .then((wf) => {
          setDispatched(wf.id);
          toast.success("Publishing started");
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  if (!textArtifact && !imageArtifact) return null;

  return (
    <Card glass className="p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Send className="h-3.5 w-3.5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Publish</h3>
          <p className="text-[11px] text-muted-foreground">Review the caption, then post it to a connected account.</p>
        </div>
      </div>

      {dispatched ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-success">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" /> Publishing started.
          </span>
          <span className="flex gap-3">
            <Link to={`/workflows/${dispatched}`} className="inline-flex items-center gap-1 font-medium underline">
              Track it <ExternalLink className="h-3 w-3" />
            </Link>
            <button type="button" className="underline" onClick={() => setDispatched(null)}>
              Publish again
            </button>
          </span>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (accountId && caption.trim()) publish.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="publish-caption" className="text-xs">
              Caption
            </Label>
            <Textarea
              id="publish-caption"
              value={caption}
              onChange={(e) => {
                setTouched(true);
                setCaption(e.target.value);
              }}
              rows={4}
              className="text-sm leading-relaxed"
            />
          </div>
          {imageArtifact && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={attachImage} onChange={(e) => setAttachImage(e.target.checked)} className="accent-[hsl(var(--primary))]" />
              Attach the generated visual
            </label>
          )}
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              <Link to="/integrations" className="text-primary hover:underline">
                Connect a social account
              </Link>{" "}
              to publish from here.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select aria-label="Publish to" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-9 sm:max-w-xs">
                <option value="">Choose an account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.platform} {a.handle ? `· ${a.handle}` : ""}
                  </option>
                ))}
              </Select>
              <Button type="submit" disabled={!accountId || !caption.trim() || publish.isPending}>
                <Send className="h-4 w-4" /> Publish
              </Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, Heart, MessageCircle, Send, Sparkles } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Placeholder, StateIcon, StepMeta, StepStatusBody } from "./StepStates";
import { type RunStep, mediaUrls, stateOf, useArtifactText, useStepArtifacts } from "./shared";

/** The caption and visual together, laid out the way the post will look. */
export function PostPreview({ textStep, imageStep, runLive, runId }: { textStep?: RunStep; imageStep?: RunStep; runLive: boolean; runId: string }) {
  const { data: textArtifacts } = useStepArtifacts(textStep);
  const { data: imageArtifacts } = useStepArtifacts(imageStep);
  const text = textArtifacts?.find((a) => a.mimeType.startsWith("text/")) ?? textArtifacts?.[0];
  const image = imageArtifacts?.find((a) => a.mimeType.startsWith("image/")) ?? imageArtifacts?.[0];
  const { data: caption } = useArtifactText(text?.id);
  const textState = stateOf(textStep, runLive);
  const imageState = stateOf(imageStep, runLive);
  const img = mediaUrls(image);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <Card glass className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h3 className="flex-1 text-sm font-semibold">Post preview</h3>
        {textStep && <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><StateIcon state={textState} /> Caption</span>}
        {imageStep && <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><StateIcon state={imageState} /> Visual</span>}
      </div>
      <div className={cn("grid gap-0", imageStep && textStep && "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        {imageStep && (
          <section aria-label="Visual" className="border-border/60 p-4 md:border-r">
            <h4 className="sr-only">Visual</h4>
            {imageState === "done" && img.src ? (
              <a href={img.src} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border border-border bg-muted/30">
                <img src={img.src} alt="Generated visual" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </a>
            ) : imageState === "done" ? (
              <Placeholder text="Loading…" />
            ) : (
              <StepStatusBody role="image" step={imageStep} state={imageState} runId={runId} />
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <StepMeta step={imageStep} />
              {img.file && (
                <a href={img.file} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              )}
            </div>
          </section>
        )}
        {textStep && (
          <section aria-label="Caption & copy" className="flex flex-col p-4">
            <h4 className="sr-only">Caption & copy</h4>
            {textState === "done" && caption !== undefined ? (
              <div className="flex flex-1 flex-col rounded-lg border border-border/70 bg-background/40">
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">A</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">Your brand</span>
                    <span className="block text-[11px] text-muted-foreground">Preview</span>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copy} aria-label="Copy caption">
                    {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="flex-1 whitespace-pre-wrap break-words p-3 text-sm leading-relaxed">
                  {caption.split(/(\s+)/).map((w, i) => (/^#\w/.test(w) ? <span key={i} className="font-medium text-primary">{w}</span> : w))}
                </p>
                <div className="flex items-center gap-4 border-t border-border/60 px-3 py-2 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <MessageCircle className="h-4 w-4" />
                  <Send className="h-4 w-4" />
                  <span className="ml-auto font-mono text-[11px]">{caption.length} chars</span>
                </div>
              </div>
            ) : textState === "done" ? (
              <Placeholder text="Loading…" />
            ) : (
              <StepStatusBody role="text" step={textStep} state={textState} runId={runId} />
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <StepMeta step={textStep} />
              {text && (
                <a href={mediaUrls(text).file} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}

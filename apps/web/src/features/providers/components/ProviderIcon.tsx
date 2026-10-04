import { Bot, Compass, Cpu, Image as ImageIcon, Layers, Sparkles, Volume2, Zap } from "lucide-react";

export function ProviderIcon({ providerType, capKey }: { providerType: string; capKey?: string }) {
  if (providerType.includes("ollama")) return <Cpu className="h-5 w-5 text-primary" />;
  if (providerType.includes("openai") || providerType.includes("groq")) return <Sparkles className="h-5 w-5 text-success" />;
  if (providerType.includes("gemini")) return <Zap className="h-5 w-5 text-chart-3" />;
  if (providerType.includes("anthropic")) return <Bot className="h-5 w-5 text-warning" />;
  if (providerType.includes("stability") || capKey === "image-generation") return <ImageIcon className="h-5 w-5 text-primary" />;
  if (capKey === "audio-generation") return <Volume2 className="h-5 w-5 text-primary" />;
  if (capKey === "web-search") return <Compass className="h-5 w-5 text-warning" />;
  return <Layers className="h-5 w-5 text-primary" />;
}

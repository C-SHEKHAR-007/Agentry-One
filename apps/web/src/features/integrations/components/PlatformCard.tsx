import { Plus } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import type { Platform } from "../platforms";

/** A platform an account can be connected for; opens the connect dialog. */
export function PlatformCard({ p, onSelect }: { p: Platform; onSelect: () => void }) {
  const Icon = p.icon;
  return (
    <Card
      glass
      className="p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all cursor-pointer group"
      onClick={onSelect}
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
        <h3 className="pt-1 text-sm font-semibold text-foreground">{p.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{p.description}</p>
      </div>

      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-primary font-medium">
        <span>Connect Directly</span>
        <Plus className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Card>
  );
}

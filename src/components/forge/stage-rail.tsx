import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/forge/types";
import { StageStatusPill, stageTone } from "./status";

const barTone: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground/40",
  primary: "bg-primary",
};

export function StageRail({ stages, compact }: { stages: Stage[]; compact?: boolean }) {
  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-3 sm:grid-cols-9" : "sm:grid-cols-2 xl:grid-cols-3",
      )}
    >
      {stages.map((stage) => {
        const tone = stageTone[stage.status];
        if (compact) {
          return (
            <div key={stage.id} className="space-y-1.5" title={`${stage.label}: ${stage.summary}`}>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", barTone[tone])}
                  style={{ width: `${Math.max(stage.progress, stage.status === "locked" ? 0 : 4)}%` }}
                />
              </div>
              <div className="truncate font-mono text-[10px] text-muted-foreground">
                {stage.label}
              </div>
            </div>
          );
        }
        return (
          <div key={stage.id} className="panel space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{stage.label}</div>
              <StageStatusPill status={stage.status} />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{stage.summary}</p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", barTone[tone])}
                style={{ width: `${stage.progress}%` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>{stage.progress}%</span>
              <span>{new Date(stage.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

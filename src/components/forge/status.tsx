import { cn } from "@/lib/utils";
import type { RiskLevel, StageStatus } from "@/lib/forge/types";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/12 text-warning border-warning/30",
  danger: "bg-destructive/12 text-destructive border-destructive/30",
  info: "bg-info/12 text-info border-info/30",
  primary: "bg-primary/12 text-primary border-primary/30",
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-tight whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      className={cn(
        "size-1.5 rounded-full",
        tone === "success" && "bg-success",
        tone === "warning" && "bg-warning",
        tone === "danger" && "bg-destructive",
        tone === "info" && "bg-info",
        tone === "primary" && "bg-primary",
        tone === "neutral" && "bg-muted-foreground",
      )}
    />
  );
}

export const stageTone: Record<StageStatus, Tone> = {
  locked: "neutral",
  pending: "neutral",
  running: "info",
  needs_approval: "warning",
  blocked: "danger",
  complete: "success",
};

export const stageLabel: Record<StageStatus, string> = {
  locked: "locked",
  pending: "pending",
  running: "running",
  needs_approval: "approval",
  blocked: "blocked",
  complete: "complete",
};

export function StageStatusPill({ status }: { status: StageStatus }) {
  const tone = stageTone[status];
  return (
    <Pill tone={tone}>
      <Dot tone={tone} />
      {stageLabel[status]}
    </Pill>
  );
}

export function RiskPill({ risk }: { risk: RiskLevel }) {
  const tone: Tone = risk === "high" ? "danger" : risk === "medium" ? "warning" : "neutral";
  return <Pill tone={tone}>risk: {risk}</Pill>;
}

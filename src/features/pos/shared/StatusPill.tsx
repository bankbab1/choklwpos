import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "primary";

const TONE: Record<StatusTone, { bg: string; dot: string }> = {
  success: { bg: "bg-success/15 text-success", dot: "bg-success" },
  warning: { bg: "bg-amber-500/15 text-amber-700", dot: "bg-amber-500" },
  danger: { bg: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  neutral: { bg: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  primary: { bg: "bg-primary/15 text-primary", dot: "bg-primary" },
};

interface Props {
  label: string;
  tone?: StatusTone;
  icon?: React.ReactNode;
  showDot?: boolean;
  className?: string;
}

export const StatusPill = ({
  label,
  tone = "neutral",
  icon,
  showDot = true,
  className,
}: Props) => {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        t.bg,
        className,
      )}
    >
      {icon ?? (showDot && <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />)}
      {label}
    </span>
  );
};

export default StatusPill;

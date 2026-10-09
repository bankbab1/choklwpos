import { cn } from "@/lib/utils";
import type { PromoStatus } from "./PromotionsProvider";

const TONE: Record<PromoStatus["tone"], string> = {
  success: "bg-success/15 text-success",
  warning: "bg-amber-500/15 text-amber-700",
  danger: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export const PromoStatusPill = ({
  status,
  className,
}: {
  status: PromoStatus;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
      TONE[status.tone],
      className,
    )}
  >
    <span
      className={cn(
        "h-1.5 w-1.5 rounded-full",
        status.tone === "success"
          ? "bg-success"
          : status.tone === "danger"
            ? "bg-destructive"
            : status.tone === "warning"
              ? "bg-amber-500"
              : "bg-muted-foreground",
      )}
    />
    {status.label}
  </span>
);

export const QuotaProgress = ({ status }: { status: PromoStatus }) => {
  if (status.quota == null || !status.period) return null;
  const pct = Math.min(100, Math.round((status.used / status.quota) * 100));
  const danger = pct >= 100;
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            danger ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
        {status.used}/{status.quota}
        <span className="ml-0.5 text-[9px]">
          {status.period === "daily" ? "·d" : ""}
        </span>
      </span>
    </div>
  );
};

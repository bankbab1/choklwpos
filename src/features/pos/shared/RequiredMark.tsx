import { cn } from "@/lib/utils";

/**
 * Consistent required-field indicator across every settings form.
 * Renders a small destructive-colored asterisk to be placed next to a label.
 */
export function RequiredMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-0.5 text-[10px] font-semibold text-destructive leading-none",
        className,
      )}
    >
      *
    </span>
  );
}

/**
 * Shared label style used above inputs in every settings editor
 * (Products, Option Groups, Bank Accounts, Promotions).
 */
export const FIELD_LABEL_CLASS =
  "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

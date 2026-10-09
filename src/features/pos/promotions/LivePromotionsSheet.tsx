import { X, Sparkles, RotateCcw } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { cn } from "@/lib/utils";
import { useMaster } from "@/features/pos/master/MasterProvider";
import {
  usePromotions,
  type Promotion,
} from "@/features/pos/promotions/PromotionsProvider";
import {
  PROMO_TYPE_META,
  summarizeCondition,
  summarizeReward,
} from "@/features/pos/promotions/promotionMeta";
import {
  PromoStatusPill,
  QuotaProgress,
} from "@/features/pos/promotions/PromoStatusPill";

interface Props {
  open: boolean;
  isOpening: boolean;
  isClosing: boolean;
  onClose: () => void;
}

const STATE_RANK: Record<string, number> = {
  active: 0,
  quota_full: 1,
  out_of_hours: 2,
  off_day: 3,
  scheduled: 4,
  expired: 5,
  inactive: 6,
};

const LivePromotionsSheet = ({ open, isOpening, isClosing, onClose }: Props) => {
  const { promotions, getStatus, resetPromoUsage } = usePromotions();
  const { products } = useMaster();

  const rows = promotions
    .map((p) => ({ p, s: getStatus(p) }))
    .sort(
      (a, b) =>
        (STATE_RANK[a.s.state] ?? 99) - (STATE_RANK[b.s.state] ?? 99) ||
        a.p.displayOrder - b.p.displayOrder,
    );

  const activeCount = rows.filter((r) => r.s.state === "active").length;

  return (
    <BaseSheet
      open={open}
      isOpening={isOpening}
      isClosing={isClosing}
      onClose={onClose}
      variant="sheet"
      className="max-h-[85dvh] rounded-t-2xl"
    >
      {({ onDragStart, onDragMove, onDragEnd }) => (
        <div className="flex flex-col h-full overflow-hidden">
          <SheetHeader
            title="Live Promotions"
            subtitle={`${activeCount} active right now · ${promotions.length} total`}
            onClose={onClose}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 space-y-2 pb-[calc(24px+env(safe-area-inset-bottom))]">
            {rows.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold">No promotions configured</p>
                <p className="text-xs text-muted-foreground">
                  Create promotions in Settings → Promotions.
                </p>
              </div>
            )}

            {rows.map(({ p, s }) => (
              <PromoRow
                key={p.id}
                promo={p}
                status={s}
                summary={`${summarizeCondition(p, products)} · ${summarizeReward(p, products)}`}
                onReset={() => resetPromoUsage(p.id)}
              />
            ))}
          </main>
        </div>
      )}
    </BaseSheet>
  );
};

function PromoRow({
  promo,
  status,
  summary,
  onReset,
}: {
  promo: Promotion;
  status: ReturnType<ReturnType<typeof usePromotions>["getStatus"]>;
  summary: string;
  onReset: () => void;
}) {
  const meta = PROMO_TYPE_META[promo.promoType];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 flex gap-3",
        status.state !== "active" && "opacity-80",
      )}
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className={cn("h-5 w-5", meta.tint)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold truncate">
            {promo.name.trim() || "Untitled promotion"}
          </p>
          <PromoStatusPill status={status} />
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {meta.label} · {summary}
        </p>
        <QuotaProgress status={status} />
      </div>
      {status.quota != null && status.used > 0 && (
        <button
          onClick={onReset}
          className="h-8 w-8 self-start flex items-center justify-center rounded-md bg-muted/60 text-muted-foreground active:scale-95"
          aria-label="Reset usage counter"
          title="Reset usage counter"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default LivePromotionsSheet;

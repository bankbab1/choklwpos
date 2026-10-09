import { useMemo, useState } from "react";
import { Ban, Minus, Plus, X } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Button } from "@/components/ui/button";
import { CartItem } from "@/data/products";
import { getLineTotal } from "@/lib/pricing/pricing";
import { formatTHB } from "@/lib/pricing/currency";
import { cn } from "@/lib/utils";
import type { ReturnLine } from "@/features/pos/orders/OpenOrdersProvider";

interface Props {
  open: boolean;
  isOpening?: boolean;
  isClosing?: boolean;
  onClose: () => void;
  orderId: string;
  items: CartItem[];
  /** Already-returned qty map (cartItem.id -> qty) */
  returnedQty?: Record<string, number>;
  onFullVoid: () => void;
  onPartialVoid: (lines: ReturnLine[]) => void;
}

type Mode = "full" | "partial";

const VoidOrderSheet = ({
  open,
  isOpening,
  isClosing,
  onClose,
  orderId,
  items,
  returnedQty = {},
  onFullVoid,
  onPartialVoid,
}: Props) => {
  const [mode, setMode] = useState<Mode>("full");
  const [picks, setPicks] = useState<Record<string, number>>({});

  if (!open && !isClosing) return null;

  const remainingFor = (it: CartItem) =>
    it.quantity - (returnedQty[it.id] ?? 0);

  const refundAmount = useMemo(() => {
    if (mode === "full") {
      return items.reduce((s, it) => {
        const rem = remainingFor(it);
        if (rem <= 0) return s;
        const perUnit = getLineTotal(it) / Math.max(1, it.quantity);
        return s + perUnit * rem;
      }, 0);
    }
    return items.reduce((s, it) => {
      const qty = picks[it.id] ?? 0;
      if (qty <= 0) return s;
      const perUnit = getLineTotal(it) / Math.max(1, it.quantity);
      return s + perUnit * qty;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, picks, items, returnedQty]);

  const partialPickedQty = Object.values(picks).reduce((s, n) => s + n, 0);
  const canConfirm = mode === "full" ? true : partialPickedQty > 0;

  const handleConfirm = () => {
    if (mode === "full") {
      onFullVoid();
    } else {
      const lines: ReturnLine[] = Object.entries(picks)
        .filter(([, q]) => q > 0)
        .map(([itemId, qty]) => ({ itemId, qty }));
      onPartialVoid(lines);
    }
  };

  const adjust = (id: string, delta: number, max: number) => {
    setPicks((prev) => {
      const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + delta));
      return { ...prev, [id]: next };
    });
  };

  return (
    <BaseSheet
      open={open}
      isOpening={isOpening}
      isClosing={isClosing}
      onClose={onClose}
      variant="full"
      className="bg-background flex flex-col"
    >
      {() => (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/60">
            <div className="min-w-0">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Ban className="w-4 h-4 text-destructive" />
                Void order
              </h2>
              <p className="text-[11px] text-muted-foreground tabular-nums truncate">
                {orderId}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-95"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="px-4 pt-3">
            <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-xl">
              {(["full", "partial"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "py-2.5 rounded-lg text-sm font-semibold transition active:scale-[0.98]",
                    mode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {m === "full" ? "Void all" : "Partial return"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 px-1 leading-relaxed">
              {mode === "full"
                ? "Reverses the entire remaining amount. A linked void order will be created and the original marked as Voided."
                : "Pick items and quantities to return. A linked reversal order will be created. The original stays Completed until everything is returned."}
            </p>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {items.map((it) => {
              const remaining = remainingFor(it);
              const picked = picks[it.id] ?? 0;
              const perUnit = getLineTotal(it) / Math.max(1, it.quantity);
              const disabled = mode === "full" || remaining === 0;
              return (
                <div
                  key={it.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-3",
                    remaining === 0 && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{it.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatTHB(perUnit)} · sold {it.quantity}
                        {remaining < it.quantity &&
                          ` · ${it.quantity - remaining} returned`}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums shrink-0">
                      {formatTHB(perUnit * (mode === "full" ? remaining : picked))}
                    </p>
                  </div>
                  {mode === "partial" && remaining > 0 && (
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[11px] text-muted-foreground">
                        Return qty
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={picked === 0}
                          onClick={() => adjust(it.id, -1, remaining)}
                          className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center active:scale-95 disabled:opacity-40"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums">
                          {picked}
                        </span>
                        <button
                          type="button"
                          disabled={picked >= remaining}
                          onClick={() => adjust(it.id, +1, remaining)}
                          className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 disabled:opacity-40"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  {remaining === 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
                      Fully returned
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <SheetFooter className="py-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">Refund amount</span>
              <span className="text-lg font-extrabold tabular-nums text-destructive">
                -{formatTHB(refundAmount)}
              </span>
            </div>
            <Button
              variant="outline"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="w-full h-14 font-semibold gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <Ban className="w-5 h-5" />
              {mode === "full" ? "Confirm void" : `Return ${partialPickedQty} item${partialPickedQty === 1 ? "" : "s"}`}
            </Button>
          </SheetFooter>
        </div>
      )}
    </BaseSheet>
  );
};

export default VoidOrderSheet;

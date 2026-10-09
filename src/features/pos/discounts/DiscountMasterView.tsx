import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Search, X, Percent, Power, Equal, Gift } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useMaster,
  DiscountMode,
  ProductDiscount,
  DiscountMap,
  effectivePrice,
} from "@/features/pos/master/MasterProvider";
import { formatTHB } from "@/lib/pricing/currency";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { toast } from "sonner";

interface Props {
  onBack: () => void;
}

const DiscountMasterView = ({ onBack }: Props) => {
  const {
    originalProducts,
    discounts,
    setAllDiscounts,
    categories,
    displayCategories,
  } = useMaster();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [onlyActive, setOnlyActive] = useState(false);

  // Draft state for unsaved discount edits
  const [draft, setDraft] = useState<DiscountMap>(() =>
    JSON.parse(JSON.stringify(discounts)),
  );

  // Per-product pending mode (selector change without value — not yet a real edit)
  const [pendingModes, setPendingModes] = useState<Record<string, DiscountMode>>({});

  // Reset draft when component mounts (in case discounts changed elsewhere)
  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(discounts)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(discounts),
    [draft, discounts],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return originalProducts.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.code || "").toLowerCase().includes(q)) return false;
      if (onlyActive && !draft[p.id]?.active) return false;
      return true;
    });
  }, [originalProducts, query, category, onlyActive, draft]);

  const stats = useMemo(() => {
    let active = 0;
    for (const id of Object.keys(draft)) if (draft[id]?.active) active++;
    return { active, total: originalProducts.length };
  }, [draft, originalProducts]);

  const setDiscountDraft = (productId: string, d: ProductDiscount | undefined) => {
    setDraft((prev) => {
      const copy = { ...prev };
      if (d) {
        copy[productId] = d;
      } else {
        delete copy[productId];
      }
      return copy;
    });
  };

  const updateValue = (productId: string, basePrice: number, mode: DiscountMode, raw: string) => {
    if (mode === "free") return; // value not used
    if (raw === "") {
      setDiscountDraft(productId, undefined);
      return;
    }
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) {
      setDiscountDraft(productId, undefined);
      return;
    }
    const prev = draft[productId];
    const next: ProductDiscount = {
      mode,
      value: num,
      active: prev?.active ?? true,
    };
    // clamp per mode
    if (mode === "percent" && next.value > 100) next.value = 100;
    if (mode === "amount" && next.value > basePrice) next.value = basePrice;
    if (mode === "final" && next.value > basePrice) next.value = basePrice;
    setDiscountDraft(productId, next);
  };

  const switchMode = (productId: string, basePrice: number, mode: DiscountMode) => {
    const cur = draft[productId];
    const original = discounts[productId];

    if (mode === "free") {
      setPendingModes((p) => {
        const { [productId]: _, ...rest } = p;
        return rest;
      });
      setDiscountDraft(productId, { mode: "free", value: 0, active: true });
      return;
    }

    // Switching to a value-based mode with no real edit yet —
    // drop any draft-only entry and remember the chosen mode locally
    if (!original) {
      if (cur) setDiscountDraft(productId, undefined);
      setPendingModes((p) => ({ ...p, [productId]: mode }));
      return;
    }

    if (!cur) {
      setPendingModes((p) => ({ ...p, [productId]: mode }));
      return;
    }
    if (cur.mode === mode) return;
    setDiscountDraft(productId, { ...cur, mode, value: 0 });
  };

  const toggleActive = (productId: string) => {
    setDraft((prev) => {
      const cur = prev[productId];
      if (!cur) return prev;
      return { ...prev, [productId]: { ...cur, active: !cur.active } };
    });
  };

  const handleSave = () => {
    setAllDiscounts(draft);
    toast.success("Discounts saved");
  };

  const handleBack = () => {
    if (isDirty) {
      confirm({
        title: "Discard unsaved changes?",
        description: "You have unsaved discount changes.",
        confirmText: "Discard",
        cancelText: "Keep editing",
        variant: "destructive",
        onConfirm: onBack,
      });
    } else {
      onBack();
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header — matches Master/Bank pattern */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleBack}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-card border border-border active:scale-95 shrink-0"
            aria-label="Back to settings"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">
              Settings
            </p>
            <h1 className="text-lg font-bold text-foreground truncate leading-tight mt-0.5">
              Discount Master
              {isDirty && (
                <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500 align-middle" />
              )}
            </h1>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-full bg-secondary shrink-0">
            {stats.active}/{stats.total}
          </span>
        </div>

        {/* Search — matches Product Master */}
        <div className="px-3 pb-2 flex items-center gap-2">
          <div className="relative flex-1 flex items-center bg-secondary rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="flex-1 bg-transparent text-[16px] outline-none pr-7 min-w-0"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 h-6 w-6 flex items-center justify-center rounded-full bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-3 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {displayCategories.map((c) => {
            const selected = c === category;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "shrink-0 px-3 h-8 rounded-full text-xs font-semibold transition active:scale-95",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {c}
              </button>
            );
          })}
          <button
            onClick={() => setOnlyActive((v) => !v)}
            className={cn(
              "shrink-0 px-3 h-8 rounded-full text-xs font-semibold transition active:scale-95 flex items-center gap-1",
              onlyActive
                ? "bg-primary/15 text-primary border border-primary/40"
                : "bg-secondary text-muted-foreground",
            )}
          >
            <Power className="h-3 w-3" />
            Active only
          </button>
        </div>
      </header>

      {/* List */}
      <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(120px+env(safe-area-inset-bottom))] space-y-2">
        {visible.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            No products match.
          </div>
        ) : (
          visible.map((p) => {
            const d = draft[p.id];
            const finalPrice = effectivePrice(p.price, d);
            const isFreeMode = d?.mode === "free";
            const hasDiscount = !!d && (isFreeMode || d.value > 0);
            const isActive = !!d?.active && hasDiscount;
            const curMode: DiscountMode = d?.mode ?? pendingModes[p.id] ?? "percent";
            const MODES: { key: DiscountMode; icon: React.ReactNode; label: string }[] = [
              { key: "amount", icon: <span className="text-[11px]">฿</span>, label: "Amount off" },
              { key: "percent", icon: <Percent className="h-3 w-3" />, label: "Percent off" },
              { key: "final", icon: <Equal className="h-3 w-3" />, label: "Final price" },
              { key: "free", icon: <Gift className="h-3 w-3" />, label: "Free" },
            ];
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-2xl border bg-card p-3 transition",
                  isActive ? "border-primary/40 shadow-sm" : "border-border",
                )}
              >
                {/* Row 1: product + prices */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.category}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "text-xs",
                        isActive
                          ? "text-muted-foreground line-through"
                          : "text-foreground font-semibold",
                      )}
                    >
                      {formatTHB(p.price)}
                    </p>
                    {isActive && (
                      <p className="text-sm font-bold text-primary leading-tight">
                        {isFreeMode ? "FREE" : formatTHB(finalPrice)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 2: selector + input + toggle */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex rounded-lg bg-secondary p-0.5 shrink-0">
                    {MODES.map((m) => {
                      const selected = curMode === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => switchMode(p.id, p.price, m.key)}
                          className={cn(
                            "h-8 w-8 rounded-md text-xs font-semibold transition active:scale-95 flex items-center justify-center",
                            selected
                              ? "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground",
                          )}
                          aria-label={m.label}
                        >
                          {m.icon}
                        </button>
                      );
                    })}
                  </div>

                  <Input
                    inputMode="decimal"
                    placeholder={
                      isFreeMode
                        ? "No value"
                        : curMode === "percent"
                          ? "0"
                          : curMode === "final"
                            ? `≤ ${p.price}`
                            : "0.00"
                    }
                    value={isFreeMode ? "" : d?.value ? String(d.value) : ""}
                    disabled={isFreeMode}
                    onChange={(e) =>
                      updateValue(p.id, p.price, curMode, e.target.value)
                    }
                    className={cn(
                      "h-8 flex-1 min-w-0 text-sm",
                      isFreeMode && "italic text-muted-foreground",
                    )}
                  />

                  <Switch
                    checked={!!d?.active && hasDiscount}
                    disabled={!hasDiscount}
                    onCheckedChange={() => toggleActive(p.id)}
                  />
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Footer — Cancel / Save */}
      <footer className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-xl border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 font-semibold"
            onClick={handleBack}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-12 font-semibold"
            disabled={!isDirty}
            onClick={handleSave}
          >
            {isDirty ? "Save" : "Saved"}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default DiscountMasterView;

import { useEffect, useMemo, useState } from "react";
import { Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { useMaster } from "@/features/pos/master/MasterProvider";
import { ProductPickerDialog } from "@/features/pos/master/ProductPickerDialog";
import {
  ALL_WEEKDAYS,
  Promotion,
  PromoType,
  RewardType,
  Weekday,
} from "./PromotionsProvider";
import { PROMO_TYPE_META, PROMO_TYPE_ORDER } from "./promotionMeta";
import { RequiredMark, FIELD_LABEL_CLASS } from "@/features/pos/shared/RequiredMark";

interface Props {
  promotion: Promotion;
  open: boolean;
  isOpening: boolean;
  isClosing: boolean;
  isNew: boolean;
  onCancel: () => void;
  onSave: (p: Promotion) => void;
  onDelete: () => void;
}

const toNum = (v: string): number | undefined => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const PromotionEditorSheet = ({
  promotion,
  open,
  isOpening,
  isClosing,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: Props) => {
  const { products } = useMaster();
  const confirm = useConfirm();

  const [form, setForm] = useState<Promotion>(promotion);
  const [pickerOpen, setPickerOpen] =
    useState<null | "buy" | "free">(null);

  useEffect(() => {
    setForm(promotion);
  }, [promotion]);

  const productName = (id?: string) =>
    id ? products.find((p) => p.id === id)?.name ?? "" : "";

  const setReward = (patch: Partial<Promotion["reward"]>) =>
    setForm((f) => ({ ...f, reward: { ...f.reward, ...patch } }));
  const setConditions = (patch: Partial<Promotion["conditions"]>) =>
    setForm((f) => ({ ...f, conditions: { ...f.conditions, ...patch } }));
  const setSchedule = (patch: Partial<Promotion["schedule"]>) =>
    setForm((f) => ({ ...f, schedule: { ...f.schedule, ...patch } }));

  const onTypeChange = (t: PromoType) => {
    setForm((f) => ({
      ...f,
      promoType: t,
      conditions: {},
    }));
  };

  const onRewardTypeChange = (rt: RewardType) => {
    setForm((f) => ({
      ...f,
      rewardType: rt,
      reward: {},
    }));
  };

  const toggleDay = (d: Weekday) => {
    setForm((f) => {
      const has = f.schedule.days.includes(d);
      return {
        ...f,
        schedule: {
          ...f.schedule,
          days: has
            ? f.schedule.days.filter((x) => x !== d)
            : [...f.schedule.days, d],
        },
      };
    });
  };

  const everyDay = form.schedule.days.length === 7;
  const toggleEveryDay = (on: boolean) =>
    setSchedule({ days: on ? [...ALL_WEEKDAYS] : [] });

  // ── Validation ───────────────────────────────────────────────
  const validation = useMemo(() => {
    if (!form.name.trim()) return "Name is required";
    if (form.schedule.days.length === 0) return "Pick at least one day";
    if (form.schedule.startDate && !form.schedule.endDate)
      return "End date is required";
    if (form.schedule.endDate && !form.schedule.startDate)
      return "Start date is required";
    if (
      form.schedule.startDate &&
      form.schedule.endDate &&
      new Date(form.schedule.endDate) < new Date(form.schedule.startDate)
    )
      return "End date must be after start date";

    switch (form.promoType) {
      case "buy_get":
        if (!form.conditions.buyItemId) return "Choose a buy item";
        if (!form.conditions.buyQty || form.conditions.buyQty < 1)
          return "Buy quantity must be ≥ 1";
        break;
      case "bill_amount":
        if (!form.conditions.minBill || form.conditions.minBill <= 0)
          return "Minimum bill is required";
        if (
          form.conditions.maxBill != null &&
          form.conditions.maxBill < form.conditions.minBill
        )
          return "Max bill must be ≥ min bill";
        break;
      case "first_n":
        if (!form.conditions.orderQuota || form.conditions.orderQuota < 1)
          return "Order quota must be ≥ 1";
        break;
      case "time_period":
        if (!form.conditions.startTime || !form.conditions.endTime)
          return "Start and end time are required";
        break;
    }

    if (!form.rewardType) return "Select a reward type";
    if (form.rewardType === "discount") {
      const hasPct =
        form.reward.discountPercent != null &&
        form.reward.discountPercent > 0;
      const hasFix =
        form.reward.discountFixed != null && form.reward.discountFixed > 0;
      if (!hasPct && !hasFix) return "Enter a discount amount";
      if (
        hasPct &&
        (form.reward.discountPercent! < 0 ||
          form.reward.discountPercent! > 100)
      )
        return "Discount % must be 0–100";
    } else {
      if (!form.reward.freeItemId) return "Choose a free item";
      if (!form.reward.freeQty || form.reward.freeQty < 1)
        return "Free quantity must be ≥ 1";
    }
    return null;
  }, [form]);

  const handleSave = () => {
    if (validation) {
      toast.error(validation);
      return;
    }
    onSave(form);
  };

  const handleDelete = () => {
    confirm({
      title: `Delete "${form.name || "this promotion"}"?`,
      description: "This action cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: onDelete,
    });
  };

  return (
    <>
      <BaseSheet
        open={open}
        isOpening={isOpening}
        isClosing={isClosing}
        onClose={onCancel}
        variant="full"
        className="bg-background"
      >
        {({ onDragStart, onDragMove, onDragEnd }) => (
          <div className="flex flex-col h-full overflow-hidden w-full max-w-full">
            <SheetHeader
              title={isNew ? "New Promotion" : "Edit Promotion"}
              subtitle="Configure conditions, reward and schedule"
              onClose={onCancel}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />

            <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 space-y-5 w-full max-w-full">
              {/* Basics */}
              <Section title="Basics">
                <Field label="Name" required>
                  <Input
                    value={form.name}
                    maxLength={40}
                    placeholder="Promotion name"
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Description" hint="Shown internally to staff">
                  <Textarea
                    value={form.description}
                    maxLength={120}
                    rows={2}
                    placeholder="Optional description"
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </Field>
                <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Active</p>
                    <p className="text-xs text-muted-foreground">
                      Inactive promotions are never applied
                    </p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) =>
                      setForm({ ...form, isActive: v })
                    }
                  />
                </div>
              </Section>

              {/* Type */}
              <Section title="Promotion Type">
                <Select
                  value={form.promoType}
                  onValueChange={(v) => onTypeChange(v as PromoType)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMO_TYPE_ORDER.map((t) => {
                      const m = PROMO_TYPE_META[t];
                      const Icon = m.icon;
                      return (
                        <SelectItem key={t} value={t}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {m.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Section>

              {/* Conditions */}
              {form.promoType !== "normal" && (
                <Section title="Conditions">
                  {form.promoType === "buy_get" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Buy item" required>
                        <ItemPickerButton
                          value={productName(form.conditions.buyItemId)}
                          placeholder="Select item"
                          onClick={() => setPickerOpen("buy")}
                        />
                      </Field>
                      <Field label="Buy qty" required>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={form.conditions.buyQty ?? ""}
                          onChange={(e) =>
                            setConditions({
                              buyQty: toNum(e.target.value),
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}

                  {form.promoType === "bill_amount" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Min bill (฿)" required>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="500"
                          value={form.conditions.minBill ?? ""}
                          onChange={(e) =>
                            setConditions({
                              minBill: toNum(e.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field label="Max bill (฿)" hint="Optional">
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="Optional"
                          value={form.conditions.maxBill ?? ""}
                          onChange={(e) =>
                            setConditions({
                              maxBill: toNum(e.target.value),
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}

                  {form.promoType === "first_n" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Order quota" required>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            placeholder="e.g. 50"
                            value={form.conditions.orderQuota ?? ""}
                            onChange={(e) =>
                              setConditions({
                                orderQuota: toNum(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Quota resets">
                          <div className="grid grid-cols-2 gap-1.5 rounded-md bg-secondary p-1">
                            {(["lifetime", "daily"] as const).map((p) => {
                              const period =
                                form.conditions.quotaPeriod ?? "lifetime";
                              const selected = period === p;
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() =>
                                    setConditions({ quotaPeriod: p })
                                  }
                                  className={cn(
                                    "h-8 rounded text-xs font-semibold transition active:scale-95",
                                    selected
                                      ? "bg-background shadow-sm text-foreground"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {p === "lifetime" ? "Lifetime" : "Daily"}
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      </div>
                      <p className="text-[11px] text-muted-foreground px-1">
                        {form.conditions.quotaPeriod === "daily"
                          ? "Counter resets at midnight every day."
                          : "Counts forever until the quota is reached."}
                      </p>
                    </div>
                  )}


                  {form.promoType === "time_period" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Start time" required>
                        <Input
                          type="time"
                          value={form.conditions.startTime ?? ""}
                          onChange={(e) =>
                            setConditions({ startTime: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="End time" required>
                        <Input
                          type="time"
                          value={form.conditions.endTime ?? ""}
                          onChange={(e) =>
                            setConditions({ endTime: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  )}
                </Section>
              )}

              {/* Reward */}
              <Section title="Reward">
                <div className="grid grid-cols-2 gap-2">
                  {(["discount", "free_item"] as RewardType[]).map((rt) => {
                    const selected = form.rewardType === rt;
                    return (
                      <button
                        key={rt}
                        type="button"
                        onClick={() => onRewardTypeChange(rt)}
                        className={cn(
                          "rounded-xl border p-3 text-sm font-semibold transition active:scale-[0.98]",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:border-primary/30",
                        )}
                      >
                        {rt === "discount" ? "Discount" : "Free Item"}
                      </button>
                    );
                  })}
                </div>

                {form.rewardType === "discount" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Discount (%)">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        placeholder="0"
                        disabled={
                          form.reward.discountFixed != null &&
                          form.reward.discountFixed > 0
                        }
                        value={form.reward.discountPercent ?? ""}
                        onChange={(e) =>
                          setReward({
                            discountPercent: toNum(e.target.value),
                            discountFixed: undefined,
                          })
                        }
                      />
                    </Field>
                    <Field label="Discount (฿)">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        placeholder="0.00"
                        disabled={
                          form.reward.discountPercent != null &&
                          form.reward.discountPercent > 0
                        }
                        value={form.reward.discountFixed ?? ""}
                        onChange={(e) =>
                          setReward({
                            discountFixed: toNum(e.target.value),
                            discountPercent: undefined,
                          })
                        }
                      />
                    </Field>
                  </div>
                )}

                {form.rewardType === "free_item" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Free item" required>
                      <ItemPickerButton
                        value={productName(form.reward.freeItemId)}
                        placeholder="Select item"
                        onClick={() => setPickerOpen("free")}
                      />
                    </Field>
                    <Field label="Free qty" required>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={form.reward.freeQty ?? ""}
                        onChange={(e) =>
                          setReward({ freeQty: toNum(e.target.value) })
                        }
                      />
                    </Field>
                  </div>
                )}
              </Section>

              {/* Schedule */}
              <Section title="Schedule">
                <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Every day</p>
                    <p className="text-xs text-muted-foreground">
                      Apply on all weekdays
                    </p>
                  </div>
                  <Switch
                    checked={everyDay}
                    onCheckedChange={toggleEveryDay}
                  />
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {ALL_WEEKDAYS.map((d) => {
                    const selected = form.schedule.days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={cn(
                          "h-10 rounded-lg text-xs font-semibold transition active:scale-95",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <Field label="Start date" required={!!form.schedule.endDate}>
                    <Input
                      type="date"
                      value={form.schedule.startDate ?? ""}
                      onChange={(e) =>
                        setSchedule({ startDate: e.target.value || undefined })
                      }
                    />
                  </Field>
                  <Field label="End date" required={!!form.schedule.startDate}>
                    <Input
                      type="date"
                      min={form.schedule.startDate}
                      value={form.schedule.endDate ?? ""}
                      onChange={(e) =>
                        setSchedule({ endDate: e.target.value || undefined })
                      }
                    />
                  </Field>
                </div>
              </Section>

              {!isNew && (
                <section className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 gap-2 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Promotion
                  </Button>
                </section>
              )}
            </main>

            <SheetFooter className="py-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 font-semibold"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-12 font-semibold"
                  onClick={handleSave}
                  disabled={!!validation}
                >
                  {isNew ? "Save" : "Update"}
                </Button>
              </div>
            </SheetFooter>
          </div>
        )}
      </BaseSheet>

      <ProductPickerDialog
        open={pickerOpen !== null}
        onClose={() => setPickerOpen(null)}
        onPick={(p) => {
          if (pickerOpen === "buy") setConditions({ buyItemId: p.id });
          else if (pickerOpen === "free") setReward({ freeItemId: p.id });
          setPickerOpen(null);
        }}
      />
    </>
  );
};

// ─── helpers ────────────────────────────────────────────────────
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className={cn(FIELD_LABEL_CLASS, "flex items-center justify-between gap-2")}>
        <span className="flex items-center">
          {label}
          {required && <RequiredMark />}
        </span>
        {hint && (
          <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      <div className="min-w-0 w-full">{children}</div>
    </label>
  );
}

function ItemPickerButton({
  value,
  placeholder,
  onClick,
}: {
  value: string;
  placeholder: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full h-10 px-3 rounded-md border border-input bg-background text-left text-sm flex items-center justify-between gap-2 active:scale-[0.99] transition",
        !value && "text-muted-foreground",
      )}
    >
      <span className="truncate">{value || placeholder}</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

export default PromotionEditorSheet;

import { useEffect, useState } from "react";
import { OptionGroup, OptionItem, OptionType } from "@/data/options";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMaster } from "./MasterProvider";
import { ProductPickerDialog } from "./ProductPickerDialog";
import { RequiredMark, FIELD_LABEL_CLASS } from "@/features/pos/shared/RequiredMark";

function sanitizePriceText(input: string): string {
  let s = input.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  // Strip leading zeros (keep "0." prefix)
  if (s.length > 1 && s.startsWith("0") && s[1] !== ".") {
    s = s.replace(/^0+/, "");
    if (s === "" || s.startsWith(".")) s = "0" + s;
  }
  const dot = s.indexOf(".");
  if (dot !== -1 && s.length - dot - 1 > 2) {
    s = s.slice(0, dot + 3);
  }
  return s;
}

function priceNumberToText(n?: number): string {
  if (!n || n === 0) return "";
  // Trim trailing zeros while keeping max 2 decimals
  return String(Math.round(n * 100) / 100);
}
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableChoice({
  id,
  children,
}: {
  id: string;
  children: (args: { handleProps: any; isDragging: boolean }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-shadow",
        isDragging && "z-20 relative ring-2 ring-primary shadow-2xl scale-[1.02] rounded-xl",
      )}
    >
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

interface Props {
  open: boolean;
  isOpening: boolean;
  isClosing: boolean;
  onClose: () => void;
  initial?: OptionGroup | null;
  onSave: (group: OptionGroup) => void;
  /** When editing a per-product custom group, title hint */
  scopeLabel?: string;
}

const blankItem = (id: string): OptionItem => ({
  id,
  name: "",
  price: 0,
});

export const OptionGroupEditor = ({
  open,
  isOpening,
  isClosing,
  onClose,
  initial,
  onSave,
  scopeLabel,
}: Props) => {
  const { newId, products } = useMaster();

  const [name, setName] = useState("");
  const [type, setType] = useState<OptionType>("single");
  const [required, setRequired] = useState(false);
  const [items, setItems] = useState<OptionItem[]>([]);
  const [priceTexts, setPriceTexts] = useState<Record<string, string>>({});
  const [freeFlags, setFreeFlags] = useState<Record<string, boolean>>({});
  const [pickerForId, setPickerForId] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setType(initial.type);
      setRequired(!!initial.required);
      setItems(initial.options.map((o) => ({ ...o })));
      const texts: Record<string, string> = {};
      const frees: Record<string, boolean> = {};
      initial.options.forEach((o) => {
        texts[o.id] = priceNumberToText(o.price);
        frees[o.id] = !o.price || o.price === 0;
      });
      setPriceTexts(texts);
      setFreeFlags(frees);
    } else {
      setName("");
      setType("single");
      setRequired(false);
      const first = blankItem(newId("opt"));
      setItems([first]);
      setPriceTexts({ [first.id]: "" });
      setFreeFlags({ [first.id]: true });
    }
  }, [initial, open, newId]);

  const addItem = () => {
    const next = blankItem(newId("opt"));
    setItems((prev) => [...prev, next]);
    setPriceTexts((prev) => ({ ...prev, [next.id]: "" }));
    setFreeFlags((prev) => ({ ...prev, [next.id]: true }));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setPriceTexts((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setFreeFlags((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const updateItem = (id: string, patch: Partial<OptionItem>) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );

  const updatePriceText = (id: string, raw: string) => {
    const clean = sanitizePriceText(raw);
    setPriceTexts((prev) => ({ ...prev, [id]: clean }));
    const num = clean === "" || clean === "." ? 0 : Number(clean) || 0;
    updateItem(id, { price: num });
    if (num > 0 && freeFlags[id]) {
      setFreeFlags((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleFree = (id: string, checked: boolean) => {
    setFreeFlags((prev) => ({ ...prev, [id]: checked }));
    if (checked) {
      setPriceTexts((prev) => ({ ...prev, [id]: "" }));
      updateItem(id, { price: 0 });
    }
  };

  const linkProduct = (
    id: string,
    p: { id: string; name: string; price: number },
  ) => {
    updateItem(id, { productId: p.id, name: p.name, price: p.price });
    const txt = priceNumberToText(p.price);
    setPriceTexts((prev) => ({ ...prev, [id]: txt }));
    setFreeFlags((prev) => ({ ...prev, [id]: !p.price || p.price === 0 }));
  };

  const unlinkProduct = (id: string) => {
    updateItem(id, { productId: undefined });
  };

  const setDefault = (id: string) => {
    setItems((prev) => {
      if (type === "single") {
        // Toggle: tapping the current default clears it (no default).
        const current = prev.find((i) => i.isDefault)?.id;
        if (current === id) {
          return prev.map((i) => ({ ...i, isDefault: false }));
        }
        return prev.map((i) => ({ ...i, isDefault: i.id === id }));
      }
      return prev.map((i) =>
        i.id === id ? { ...i, isDefault: !i.isDefault } : i,
      );
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const handleChoiceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(oldIdx, 1);
      next.splice(newIdx, 0, moved);
      return next;
    });
  };

  const cleanName = name.trim();
  const cleanItems = items
    .map((i) => ({ ...i, name: i.name.trim() }))
    .filter((i) => i.name.length > 0);

  const canSave = cleanName.length > 0 && cleanItems.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const group: OptionGroup = {
      id: initial?.id || newId("group"),
      name: cleanName,
      type,
      required: type === "single" ? required : undefined,
      options: cleanItems.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price ? Number(i.price) || 0 : undefined,
        isDefault: i.isDefault || undefined,
        productId: i.productId || undefined,
      })),
    };
    onSave(group);
  };

  return (
    <BaseSheet
      open={open}
      isOpening={isOpening}
      isClosing={isClosing}
      onClose={onClose}
      variant="full"
    >
      {({ onDragStart, onDragMove, onDragEnd }) => (
        <>
          <SheetHeader
            title={initial ? "Edit Option Group" : "New Option Group"}
            subtitle={scopeLabel}
            onClose={onClose}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                Name
                <RequiredMark />
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Size, Color, Sweetness"
                className="h-11"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Selection
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["single", "multiple"] as OptionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition active:scale-[0.98]",
                      type === t
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        type === t ? "text-primary" : "text-foreground",
                      )}
                    >
                      {t === "single" ? "Single choice" : "Multiple choices"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t === "single"
                        ? "Pick one (e.g. Size)"
                        : "Pick many (e.g. Toppings)"}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Required (single only) */}
            {type === "single" && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-semibold">Required</p>
                  <p className="text-[11px] text-muted-foreground">
                    Customer must choose one
                  </p>
                </div>
                <Switch checked={required} onCheckedChange={setRequired} />
              </div>
            )}

            {/* Choices */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Choices
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-xs font-semibold text-primary flex items-center gap-1 active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" /> Add choice
                </button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleChoiceDragEnd}
              >
                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((item) => (
                      <SortableChoice key={item.id} id={item.id}>
                        {({ handleProps }) => (
                          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                            <div className="flex gap-2 items-center">
                              <div
                                {...handleProps}
                                className="h-10 w-6 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
                                aria-label="Drag to reorder"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <Input
                                value={item.name}
                                placeholder="Choice name"
                                onChange={(e) =>
                                  updateItem(item.id, { name: e.target.value })
                                }
                                className="h-10 flex-1"
                              />
                              <div className="relative w-24 shrink-0">
                                <Input
                                  value={priceTexts[item.id] ?? ""}
                                  placeholder={freeFlags[item.id] ? "Free" : "+0.00"}
                                  inputMode="decimal"
                                  disabled={freeFlags[item.id]}
                                  onChange={(e) =>
                                    updatePriceText(item.id, e.target.value)
                                  }
                                  className={cn(
                                    "h-10 text-right pr-2",
                                    freeFlags[item.id] &&
                                      "italic text-muted-foreground",
                                  )}
                                />
                              </div>
                            </div>
                            {item.productId && (
                              <div className="pl-8 flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                                  <Link2 className="h-3 w-3" />
                                  {products.find((p) => p.id === item.productId)
                                    ?.name ?? "Linked product"}
                                  <button
                                    type="button"
                                    onClick={() => unlinkProduct(item.id)}
                                    className="ml-0.5 hover:bg-primary/20 rounded"
                                    aria-label="Unlink product"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between pl-8 gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setDefault(item.id)}
                                  className={cn(
                                    "text-xs font-semibold px-3 py-1.5 rounded-md transition active:scale-95",
                                    item.isDefault
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {item.isDefault ? "Default" : "Set default"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleFree(item.id, !freeFlags[item.id])
                                  }
                                  className={cn(
                                    "text-xs font-semibold px-3 py-1.5 rounded-md transition active:scale-95 flex items-center gap-1.5",
                                    freeFlags[item.id]
                                      ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/40"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "h-4 w-4 rounded border flex items-center justify-center text-[10px]",
                                      freeFlags[item.id]
                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                        : "border-muted-foreground/40",
                                    )}
                                  >
                                    {freeFlags[item.id] ? "✓" : ""}
                                  </span>
                                  Free
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPickerForId(item.id)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-md transition active:scale-95 flex items-center gap-1.5 bg-muted text-muted-foreground hover:text-foreground"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  {item.productId ? "Change" : "Link product"}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                disabled={items.length <= 1}
                                className="h-9 w-9 flex items-center justify-center rounded-md bg-destructive/10 text-destructive active:scale-95 disabled:opacity-30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </SortableChoice>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>

          <SheetFooter className="py-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 font-semibold"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-12 font-semibold"
                onClick={handleSave}
                disabled={!canSave}
              >
                {initial ? "Update" : "Save"}
              </Button>
            </div>
          </SheetFooter>

          <ProductPickerDialog
            open={pickerForId !== null}
            onClose={() => setPickerForId(null)}
            onPick={(p) => {
              if (pickerForId) linkProduct(pickerForId, p);
            }}
          />
        </>
      )}
    </BaseSheet>
  );
};

export default OptionGroupEditor;

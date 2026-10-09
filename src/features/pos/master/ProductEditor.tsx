import { useEffect, useMemo, useState } from "react";
import { Product } from "@/data/products";
import { OptionGroup } from "@/data/options";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMaster, ProductOptionLink } from "./MasterProvider";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useSheetAnimation } from "@/hooks/useSheetAnimation";
import OptionGroupEditor from "./OptionGroupEditor";
import { formatTHB } from "@/lib/pricing/currency";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { Switch } from "@/components/ui/switch";
import { RequiredMark, FIELD_LABEL_CLASS } from "@/features/pos/shared/RequiredMark";

interface Props {
  open: boolean;
  isOpening: boolean;
  isClosing: boolean;
  onClose: () => void;
  initial?: Product | null;
  /** Pre-fill the category for a new product (ignored when editing). */
  initialCategory?: string;
}

const SELECTABLE_CATEGORIES_FALLBACK = ["Uncategorized"];

function sanitizePriceText(input: string): string {
  let s = input.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
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

function priceNumberToText(n: number): string {
  if (!n || n === 0) return "";
  return String(Math.round(n * 100) / 100);
}

export const ProductEditor = ({
  open,
  isOpening,
  isClosing,
  onClose,
  initial,
  initialCategory,
}: Props) => {
  const { upsertProduct, optionGroups, productOptions, newId, categories } = useMaster();
  const SELECTABLE_CATEGORIES =
    categories.length > 0 ? categories : SELECTABLE_CATEGORIES_FALLBACK;
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [libraryGroupIds, setLibraryGroupIds] = useState<string[]>([]);
  const [customGroups, setCustomGroups] = useState<OptionGroup[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setCode(initial.code || "");
      setPrice(priceNumberToText(initial.price));
      setIsFree(!initial.price || initial.price === 0);
      setCategory(initial.category);
      setImage(initial.image || "");
      setDescription(initial.description || "");
      setActive(initial.active !== false);
      const link = productOptions[initial.id];
      setLibraryGroupIds(link?.libraryGroupIds || []);
      setCustomGroups(link?.customGroups?.map((g) => ({ ...g })) || []);
    } else {
      setName("");
      setCode("");
      setPrice("");
      setIsFree(false);
      setCategory(
        initialCategory && SELECTABLE_CATEGORIES.includes(initialCategory)
          ? initialCategory
          : "",
      );
      setImage("");
      setDescription("");
      setActive(true);
      setLibraryGroupIds([]);
      setCustomGroups([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, open]);

  const cleanName = name.trim();
  const priceNum = isFree ? 0 : parseFloat(price || "0") || 0;
  const canSave =
    cleanName.length > 0 && (isFree || priceNum > 0) && category.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const id = initial?.id || newId("prod");
    const product: Product = {
      id,
      code: code.trim() || undefined,
      name: cleanName,
      description: description.trim() || undefined,
      price: priceNum,
      category,
      image: image.trim() || undefined,
      active,
    };
    const link: ProductOptionLink = {
      libraryGroupIds: [...libraryGroupIds],
      customGroups: customGroups.map((g) => ({ ...g })),
    };
    upsertProduct(product, link);
    onClose();
  };

  const toggleLibrary = (id: string) => {
    setLibraryGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Nested editor for custom groups
  const customEditor = useSheetAnimation(300);
  const [editingCustom, setEditingCustom] = useState<OptionGroup | null>(null);

  const openCustomEditor = (g: OptionGroup | null) => {
    setEditingCustom(g);
    customEditor.openSheet();
  };

  const handleSaveCustom = (g: OptionGroup) => {
    setCustomGroups((prev) => {
      const idx = prev.findIndex((x) => x.id === g.id);
      if (idx === -1) return [...prev, g];
      const copy = [...prev];
      copy[idx] = g;
      return copy;
    });
    customEditor.closeSheet();
    setTimeout(() => setEditingCustom(null), 300);
  };

  const removeCustom = (id: string) => {
    confirm({
      title: "Remove option group?",
      description: "This affects only this product.",
      confirmText: "Remove",
      variant: "destructive",
      onConfirm: () =>
        setCustomGroups((prev) => prev.filter((g) => g.id !== id)),
    });
  };

  const summary = (g: OptionGroup) =>
    g.options
      .slice(0, 3)
      .map((o) => o.name)
      .join(", ") + (g.options.length > 3 ? ` +${g.options.length - 3}` : "");

  return (
    <>
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
              title={initial ? "Edit Product" : "New Product"}
              onClose={onClose}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Basic */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Basic info
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                      Product name
                      <RequiredMark />
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Iced Latte"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                      Product code (SKU)
                    </label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. SKU-001 / barcode"
                      className="h-11 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                      Price
                      {!isFree && <RequiredMark />}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={isFree ? "" : price}
                        onChange={(e) => {
                          const clean = sanitizePriceText(e.target.value);
                          setPrice(clean);
                          const n =
                            clean === "" || clean === "." ? 0 : Number(clean) || 0;
                          if (n > 0 && isFree) setIsFree(false);
                        }}
                        placeholder={isFree ? "Free" : "0.00"}
                        inputMode="decimal"
                        disabled={isFree}
                        className={cn(
                          "h-11 flex-1",
                          isFree && "italic text-muted-foreground",
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isFree;
                          setIsFree(next);
                          if (next) setPrice("");
                        }}
                        className={cn(
                          "shrink-0 px-3 rounded-md text-xs font-semibold transition active:scale-95 flex items-center gap-1.5",
                          isFree
                            ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/40"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center text-[10px]",
                            isFree
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {isFree ? "✓" : ""}
                        </span>
                        Free
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                      Category
                      <RequiredMark />
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={cn(
                        "h-11 w-full rounded-md border border-input bg-background px-3 text-sm",
                        !category && "text-muted-foreground",
                      )}
                    >
                      <option value="" disabled>
                        Select category
                      </option>
                      {SELECTABLE_CATEGORIES.map((c) => (
                        <option key={c} value={c} className="text-foreground">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>


                  <Input
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="Image URL (optional)"
                    className="h-11"
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Active</p>
                      <p className="text-[11px] text-muted-foreground">
                        {active
                          ? "Visible in the POS menu"
                          : "Hidden from the POS menu"}
                      </p>
                    </div>
                    <Switch checked={active} onCheckedChange={setActive} />
                  </div>
                </div>
              </section>

              {/* Library options */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Options from library
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {libraryGroupIds.length} selected
                  </span>
                </div>
                {optionGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No groups in library yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {optionGroups.map((g) => {
                      const active = libraryGroupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleLibrary(g.id)}
                          className={cn(
                            "px-3 py-2 rounded-full text-xs font-semibold border transition active:scale-95",
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:border-primary/40",
                          )}
                        >
                          {g.name}
                          <span
                            className={cn(
                              "ml-1.5 text-[10px] opacity-70",
                              active && "text-primary-foreground/80",
                            )}
                          >
                            · {g.options.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Custom options */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Product-only options
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Used only by this product
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCustomEditor(null)}
                    className="text-xs font-semibold text-primary flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                {customGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    None yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customGroups.map((g) => (
                      <div
                        key={g.id}
                        className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {g.name}
                            <span className="ml-2 text-[10px] font-normal text-muted-foreground uppercase">
                              {g.type === "single" ? "Single" : "Multi"}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {summary(g)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openCustomEditor(g)}
                            className="h-8 w-8 flex items-center justify-center rounded-md bg-muted/60 active:scale-95"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCustom(g.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-md bg-destructive/10 text-destructive active:scale-95"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="text-[11px] text-muted-foreground pt-2">
                Base price: {formatTHB(priceNum)}
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
                  disabled={!canSave}
                  onClick={handleSave}
                >
                  {initial ? "Update" : "Save"}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </BaseSheet>

      {(customEditor.open || customEditor.isClosing) && (
        <OptionGroupEditor
          open={customEditor.open}
          isOpening={customEditor.isOpening}
          isClosing={customEditor.isClosing}
          onClose={() => {
            customEditor.closeSheet();
            setTimeout(() => setEditingCustom(null), 300);
          }}
          initial={editingCustom}
          scopeLabel={`For ${cleanName || "this product"} only`}
          onSave={handleSaveCustom}
        />
      )}
    </>
  );
};

export default ProductEditor;

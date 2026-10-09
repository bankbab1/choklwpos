import { useState, useEffect, useMemo, useRef } from "react";
import { Product, CartItem } from "@/data/products";
import { formatTHB } from "@/lib/pricing/currency";
import {
  getUnitPrice,
  getUnitDiscount,
  getLineTotal,
} from "@/lib/pricing/pricing";
import { DiscountScope } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Minus, Plus, X, Check, Percent, Target } from "lucide-react";
import { useMaster } from "@/features/pos/master/MasterProvider";
import {
  getMaxDiscount,
  round2,
  computeDiscount,
  InputMode,
} from "@/lib/discount/discount";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";

interface Props {
  product?: Product;
  initialItem?: CartItem;
  onClose: () => void;
  onConfirm: (item: CartItem) => void;
  isOpening?: boolean;
  isClosing?: boolean;
  open: boolean;
}

const ProductCustomizer = ({
  product,
  initialItem, // 🔥 ADD THIS
  onClose,
  onConfirm,
  isOpening,
  isClosing,
  open,
}: Props) => {
  const CUSTOM_PRODUCT_ID = "__custom__";

  const isCustomItem =
    product?.id === CUSTOM_PRODUCT_ID || initialItem?.isCustom;

  const MIN_PERCENT = 1; // or 0.5

  const [pricingMode, setPricingMode] = useState<
    "normal" | "discount" | "free"
  >("normal");

  const scopeLabels: Record<DiscountScope, string> = {
    unit: "Per item",
    line: "Total",
  };

  const [discountValue, setDiscountValue] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    type: "amount" | "percent";
    value: number;
  } | null>(null);

  const handleApplyDiscount = () => {
    const num = parseFloat(discountValue);

    const result = computeDiscount({
      inputMode,
      discountScope,
      value: num,
      unitPrice,
      qty: qtyNum,
      minPercent: MIN_PERCENT,
    });

    if (!result.valid) {
      setAppliedDiscount(null);
      setLineTarget(null);
      return;
    }

    if (result.appliedDiscount) {
      setAppliedDiscount(result.appliedDiscount);
      setLineTarget(null);
    }

    if (result.lineTarget != null) {
      setLineTarget(result.lineTarget);
      setAppliedDiscount(null);
    }
  };

  const rawNum = useMemo(
    () => parseFloat(discountValue || "0"),
    [discountValue],
  );

  const [qty, setQty] = useState("1");
  const qtyNum = parseInt(qty || "0", 10);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, any>>(
    {},
  );
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");

  const [customName, setCustomName] = useState(initialItem?.name || "");
  const [customPrice, setCustomPrice] = useState(
    initialItem?.isCustom ? String(initialItem.basePrice ?? 0) : "",
  );

  const customPriceNum = parseFloat(customPrice || "0") || 0;

  const cleanName = customName.trim();
  const isNameInvalid = cleanName.length === 0;
  const isPriceInvalid = customPrice === "" || customPriceNum <= 0;

  const baseUnitPrice = isCustomItem ? customPriceNum : (product?.price ?? 0);
  const displayName = isCustomItem
    ? customName || "Custom Item"
    : product!.name;
  const displayImage = isCustomItem ? undefined : product!.image;

  const { getOptionsForProduct } = useMaster();
  const optionGroups = useMemo(() => {
    if (isCustomItem) return [];
    return getOptionsForProduct(product!.id);
  }, [isCustomItem, product?.id, getOptionsForProduct]);

  const hasOptions = optionGroups.length > 0;

  const isSimpleProduct = !isCustomItem && optionGroups.length === 0;

  const [discountScope, setDiscountScope] = useState<DiscountScope>("unit");

  const [lineTarget, setLineTarget] = useState<number | null>(null);

  const handleConfirm = () => {
    if (isCustomItem) {
      onConfirm({
        id: `custom-${Date.now()}`,
        productId: CUSTOM_PRODUCT_ID,
        name: cleanName || "Custom Item",
        image: undefined,
        quantity: qtyNum,
        options: [],
        description: description || undefined,
        note: note || undefined,

        basePrice: customPriceNum,
        optionPrice: 0,

        isCustom: true,

        discountType:
          pricingMode === "discount"
            ? inputMode === "percent"
              ? "percent"
              : "amount"
            : null,

        discountScope: pricingMode === "discount" ? discountScope : undefined,
        lineTarget: pricingMode === "discount" ? lineTarget : null,
        inputMode: pricingMode === "discount" ? inputMode : undefined,
        discountValue:
          pricingMode === "discount" && appliedDiscount
            ? appliedDiscount.value
            : undefined,
        inputValue: pricingMode === "discount" ? rawNum : 0,
        isFree: pricingMode === "free",
      });
      return;
    }

    const formattedOptions = optionGroups.flatMap((group) => {
      const val = selectedOptions[group.id];
      if (!val) return [];

      if (Array.isArray(val)) {
        return val.map((id) => {
          const opt = group.options.find((o) => o.id === id);
          return {
            groupId: group.id,
            groupName: group.name,
            optionId: opt?.id,
            optionName: opt?.name,
            price: opt?.price || 0,
          };
        });
      } else {
        const opt = group.options.find((o) => o.id === val);
        return [
          {
            groupId: group.id,
            groupName: group.name,
            optionId: opt?.id,
            optionName: opt?.name,
            price: opt?.price || 0,
          },
        ];
      }
    });

    onConfirm({
      id: `${product?.id ?? "product"}-${Date.now()}`,
      productId: product?.id ?? "",
      name: product?.name ?? "Product",
      image: product?.image,
      basePrice: product?.price ?? 0,
      quantity: qtyNum,
      options: formattedOptions,
      note,

      optionPrice,

      discountType:
        pricingMode === "discount"
          ? inputMode === "percent"
            ? "percent"
            : "amount"
          : null,

      discountScope: pricingMode === "discount" ? discountScope : undefined,
      lineTarget: pricingMode === "discount" ? lineTarget : null,
      inputMode: pricingMode === "discount" ? inputMode : undefined,
      discountValue:
        pricingMode === "discount" ? (appliedDiscount?.value ?? 0) : 0,
      inputValue: pricingMode === "discount" ? rawNum : 0,
      isFree: pricingMode === "free",
    });
  };

  const optionPrice = useMemo(() => {
    return Object.entries(selectedOptions).reduce((sum, [groupId, val]) => {
      const group = optionGroups.find((g) => g.id === groupId);
      if (!group) return sum;

      if (Array.isArray(val)) {
        return (
          sum +
          val.reduce((s, id) => {
            const opt = group.options.find((o) => o.id === id);
            return s + (opt?.price || 0);
          }, 0)
        );
      } else {
        const opt = group.options.find((o) => o.id === val);
        return sum + (opt?.price || 0);
      }
    }, 0);
  }, [selectedOptions, optionGroups]);

  const isValid = optionGroups.every((group) => {
    if (!group.required) return true;
    const val = selectedOptions[group.id];
    return val && (Array.isArray(val) ? val.length > 0 : true);
  });

  const firstMissingGroup = optionGroups.find((group) => {
    if (!group.required) return false;
    const val = selectedOptions[group.id];
    return !val || (Array.isArray(val) && val.length === 0);
  });

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [inputMode, setInputMode] = useState<InputMode>("amount");

  const previewItemBase: CartItem = {
    id: "preview",
    productId: isCustomItem ? CUSTOM_PRODUCT_ID : product!.id,
    name: displayName,
    image: displayImage,
    quantity: qtyNum,
    options: [],
    description,
    note,

    basePrice: baseUnitPrice,
    optionPrice: isCustomItem ? 0 : optionPrice,

    discountType:
      pricingMode === "discount"
        ? inputMode === "percent"
          ? "percent"
          : "amount"
        : null,

    inputMode: pricingMode === "discount" ? inputMode : undefined,

    discountValue: 0, // 🔥 IMPORTANT: don't use baseDiscountNum here

    inputValue: pricingMode === "discount" ? rawNum : 0,
    isFree: pricingMode === "free",
  };

  // ✅ FIRST compute unit price
  const unitPrice = getUnitPrice(previewItemBase);

  // 🚫 ONLY use appliedDiscount (same as amount/percent)
  let computedDiscount = appliedDiscount?.value ?? 0;

  const previewItem: CartItem = {
    ...previewItemBase,
    discountValue: computedDiscount,
  };

  const unitDiscount = getUnitDiscount(previewItem);

  const displayDiscount =
    lineTarget != null
      ? round2(unitPrice * qtyNum - lineTarget)
      : round2(unitDiscount * qtyNum);

  const finalLineTotal =
    lineTarget != null
      ? round2(lineTarget)
      : Math.max(0, round2(getLineTotal(previewItem)));

  const effectiveDiscountType = inputMode === "percent" ? "percent" : "amount";

  const isZeroQty = qtyNum === 0;

  const isBelowMin =
    inputMode === "percent" ? rawNum < MIN_PERCENT : rawNum <= 0;

  const max = getMaxDiscount({
    inputMode,
    discountScope,
    unitPrice,
    qty: qtyNum,
  });

  const isOverLimit =
    inputMode === "percent"
      ? rawNum > max
      : inputMode === "amount"
        ? rawNum > max
        : inputMode === "target"
          ? rawNum >= max
          : false;

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setLineTarget(null); // 🔥 ADD THIS
    setDiscountValue("");
  };

  const isZeroOrInvalid = discountValue === "" || isNaN(rawNum) || isBelowMin;
  const showClearInput =
    discountValue !== "" && !appliedDiscount && lineTarget == null;
  const isDirty =
    discountValue !== "" &&
    (inputMode === "target"
      ? discountScope === "line"
        ? lineTarget == null || Math.abs(lineTarget - rawNum) > 0.01
        : appliedDiscount == null ||
          Math.abs(unitPrice - appliedDiscount.value - rawNum) > 0.01
      : !appliedDiscount ||
        Math.abs(
          (discountScope === "line"
            ? appliedDiscount.value * qtyNum
            : appliedDiscount.value) - rawNum,
        ) > 0.01 ||
        appliedDiscount.type !== effectiveDiscountType);

  const isInvalidDiscount =
    pricingMode === "discount" && (isZeroOrInvalid || isOverLimit);

  const isCustomValid =
    !isCustomItem || (customName.trim().length > 0 && customPriceNum > 0);

  const canAdd =
    isValid && qtyNum > 0 && !isDirty && !isInvalidDiscount && isCustomValid;

  // cap rules
  const safeDiscountValue =
    inputMode === "percent"
      ? (appliedDiscount?.value ?? 0)
      : unitPrice > 0
        ? Math.min((unitDiscount / unitPrice) * 100, 99)
        : 0;

  const handleChangeMode = (mode: InputMode) => {
    if (mode === inputMode) return;

    setInputMode(mode);

    // 🔥 FIX: force line scope for target if needed
    if (mode === "target" && discountScope === "line") {
      // ok
    }

    setDiscountValue("");
    setAppliedDiscount(null);
    setLineTarget(null);
  };

  const buildDefaults = (): Record<string, any> => {
    const def: Record<string, any> = {};
    for (const g of optionGroups) {
      if (g.type === "single") {
        const d = g.options.find((o) => o.isDefault);
        if (d) def[g.id] = d.id;
      } else {
        const ds = g.options.filter((o) => o.isDefault).map((o) => o.id);
        if (ds.length) def[g.id] = ds;
      }
    }
    return def;
  };

  useEffect(() => {
    if (!initialItem) {
      // 🔥 RESET TO DEFAULT
      setQty("1");
      setSelectedOptions(buildDefaults());
      setNote("");
      setPricingMode("normal");
      setLineTarget(null);
      setAppliedDiscount(null);
      setDiscountScope("unit");
      setDiscountValue("");
      setDescription("");
      return;
    }

    if (initialItem?.isCustom) {
      setCustomName(initialItem.name || "");
      setCustomPrice(String(initialItem.basePrice ?? 0));
    }

    // qty
    setQty(String(initialItem.quantity));

    // note
    setNote(initialItem.note || "");
    setDescription(initialItem.description || "");

    const mapped: Record<string, any> = {};

    initialItem.options?.forEach((opt) => {
      if (!opt.groupId) return;

      const group = optionGroups.find((g) => g.id === opt.groupId);
      if (!group) return;

      if (group.type === "single") {
        mapped[opt.groupId] = opt.optionId;
      } else {
        // 🔥 ALWAYS array for multi
        if (!mapped[opt.groupId]) {
          mapped[opt.groupId] = [];
        }

        mapped[opt.groupId].push(opt.optionId);
      }
    });

    setSelectedOptions(mapped);

    const hasDiscount =
      initialItem.lineTarget != null ||
      ((initialItem.discountValue ?? 0) > 0 &&
        (initialItem.discountType === "amount" ||
          initialItem.discountType === "percent"));

    if (initialItem.lineTarget != null) {
      setLineTarget(initialItem.lineTarget);
    }

    if (initialItem.isFree) {
      setPricingMode("free");
    } else if (hasDiscount) {
      setPricingMode("discount");

      const raw = initialItem.inputValue ?? initialItem.discountValue ?? 0;

      setAppliedDiscount({
        type: initialItem.discountType,
        value: initialItem.discountValue || 0,
      });

      setDiscountScope(initialItem.discountScope || "unit"); // ✅ ADD THIS

      const mode: InputMode =
        initialItem.inputMode ||
        (initialItem.discountType === "percent" ? "percent" : "amount");

      setInputMode(mode);
      setDiscountValue(raw.toString());
    } else {
      // ✅ DEFAULT SAFE STATE
      setPricingMode("normal");
      setAppliedDiscount(null);
      setDiscountValue("");
      setInputMode("amount");
    }
  }, [initialItem, open, product?.id]);

  useEffect(() => {
    if (qtyNum === 0) {
      setAppliedDiscount(null);
      setDiscountValue("");
      setLineTarget(null);
      setPricingMode("normal"); // optional but recommended
    }
  }, [qtyNum]);

  useEffect(() => {
    // 🚫 If line mode becomes invalid → reset it
    if (qtyNum < 2 && discountScope === "line") {
      setDiscountScope("unit"); // fallback to unit
      setLineTarget(null); // clear line target
      setAppliedDiscount(null); // clear discount
      setDiscountValue(""); // reset input
      setInputMode("amount"); // optional safe reset
    }
  }, [qtyNum, discountScope]);

  if (!open && !isClosing) return null;

  return (
    <BaseSheet
      open={open}
      isOpening={isOpening}
      isClosing={isClosing}
      onClose={onClose}
      variant={isSimpleProduct ? "sheet" : "full"}
      className="bg-card flex flex-col"
      showOverlay
    >
      {({ onDragStart, onDragMove, onDragEnd }) => (
        <div
          className={`
    flex flex-col overflow-hidden
    ${isSimpleProduct ? "max-h-[85vh]" : "h-full"}
  `}
        >
          {/* HEADER (same style as cart) */}
          <SheetHeader
            title={
              isCustomItem
                ? customName || "Custom Item"
                : product?.name || "Product"
            }
            subtitle={
              isCustomItem ? "Enter item details" : product?.description
            }
            meta={!isCustomItem ? formatTHB(product?.price ?? 0) : null}
            onClose={onClose}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />

          {/* BODY (scrollable like cart) */}
          <div
            className={`
    px-5 py-4 space-y-4
    ${isSimpleProduct ? "" : "flex-1 overflow-y-auto pb-20"}
  `}
          >
            {/* 🔥 CUSTOM ITEM INPUTS */}
            {isCustomItem && (
              <div className="space-y-2 p-3 rounded-xl bg-muted/40">
                {/* NAME */}
                <div className="space-y-1">
                  {/* LABEL */}
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[11px] text-muted-foreground">
                      Item name
                    </p>

                    <span
                      className={`
        text-[10px] font-medium
        ${isNameInvalid ? "text-red-500" : "text-muted-foreground"}
      `}
                    >
                      Required
                    </span>
                  </div>

                  {/* INPUT */}
                  <div
                    className={`
      relative rounded-xl border transition-all

      ${
        isNameInvalid
          ? "border-red-400 bg-red-50/40 dark:bg-red-500/10"
          : "border-border bg-muted/70"
      }

      focus-within:ring-2 focus-within:ring-primary/30
    `}
                  >
                    <input
                      value={customName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomName(
                          val.replace(/^\s+/, "").replace(/\s{2,}/g, " "),
                        );
                      }}
                      onBlur={() => setCustomName((v) => v.trim())} // full trim on blur
                      placeholder="e.g. Custom service"
                      className="
        w-full bg-transparent
        px-3 py-2 pr-8 text-[16px]
        placeholder:text-muted-foreground
        outline-none
      "
                    />

                    {/* CLEAR */}
                    {customName && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setCustomName("");
                        }}
                        className="
          absolute right-2 top-1/2 -translate-y-1/2
          h-6 w-6 flex items-center justify-center
          rounded-full bg-muted hover:bg-muted/80
          active:scale-95 transition
        "
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {/* ERROR */}
                  {isNameInvalid && (
                    <p className="text-[11px] text-red-400 px-1">
                      Enter item name
                    </p>
                  )}
                </div>

                {/* DESCRIPTION */}
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground px-2">
                    Description (optional)
                  </p>

                  <div className="relative rounded-xl border border-border/50 bg-muted/70">
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description..."
                      className="
            w-full rounded-xl
            bg-muted/70 border border-border/50
            px-3 py-2 pr-8 text-[16px]
            placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-primary/20
          "
                    />

                    {description && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setDescription("")}
                        className="
              absolute right-2 top-1/2 -translate-y-1/2
              h-6 w-6 flex items-center justify-center
              rounded-full bg-muted hover:bg-muted/80
              active:scale-95 transition
            "
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* PRICE */}
                <div className="space-y-1">
                  {/* LABEL */}
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[11px] text-muted-foreground">Price</p>

                    <span
                      className={`
    text-[10px] font-medium
    ${isPriceInvalid ? "text-red-500" : "text-muted-foreground"}
  `}
                    >
                      Required
                    </span>
                  </div>

                  {/* INPUT */}
                  <div
                    className={`
      relative flex items-center rounded-xl
      border transition-all

      ${
        isPriceInvalid
          ? "border-red-400 bg-red-50/40 dark:bg-red-500/10"
          : "border-border bg-muted/70"
      }

      focus-within:ring-2 focus-within:ring-primary/30
    `}
                  >
                    {/* CURRENCY */}
                    <span
                      className={`
        px-3 text-sm font-medium
        ${isPriceInvalid ? "text-red-400" : "text-muted-foreground"}
      `}
                    >
                      ฿
                    </span>

                    {/* INPUT */}
                    <input
                      value={customPrice}
                      onChange={(e) => {
                        let val = e.target.value;

                        if (val === "") {
                          setCustomPrice("");
                          return;
                        }

                        // allow only numbers + decimal
                        if (!/^\d*\.?\d{0,2}$/.test(val)) return;

                        // block just "."
                        if (val === ".") return;

                        // 🔥 REMOVE leading zeros (but keep "0.x")
                        if (/^0\d+/.test(val)) {
                          val = val.replace(/^0+/, "");

                          // if becomes empty → keep single 0
                          if (val === "" || val.startsWith(".")) {
                            val = "0" + val;
                          }
                        }

                        setCustomPrice(val);
                      }}
                      onBlur={() => {
                        if (!customPrice) return;

                        let num = parseFloat(customPrice);

                        if (isNaN(num) || num <= 0) return;

                        setCustomPrice(num.toFixed(2));
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="
        flex-1 bg-transparent
        px-2 py-2 pr-8
        text-[17px] font-semibold
        outline-none
      "
                    />

                    {/* CLEAR */}
                    {customPrice && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setCustomPrice("")}
                        className="
          absolute right-2 top-1/2 -translate-y-1/2
          h-6 w-6 flex items-center justify-center
          rounded-full
          bg-muted hover:bg-muted/80
          active:scale-95 transition
        "
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {/* ERROR */}
                  {isPriceInvalid && (
                    <p className="text-[11px] text-red-400 px-1">
                      Enter a valid price greater than 0
                    </p>
                  )}
                </div>
              </div>
            )}
            {optionGroups.map((group) => {
              const val = selectedOptions[group.id];

              const isMissing =
                group.required &&
                (!val || (Array.isArray(val) && val.length === 0));

              return (
                <div
                  key={group.id}
                  ref={(el) => (groupRefs.current[group.id] = el)}
                  className={`
  px-2 py-2 rounded-md transition-all
  ${isMissing ? "bg-red-50/60 dark:bg-red-500/10" : ""}
`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-semibold">{group.name}</p>

                    <span
                      className={`
    text-[11px] px-2 py-0.5 rounded-full font-medium
    ${
      group.required
        ? isMissing
          ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"
          : "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300"
        : selectedOptions[group.id]
          ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300"
          : "bg-muted text-muted-foreground"
    }
  `}
                    >
                      {group.required
                        ? isMissing
                          ? "Required"
                          : "Selected"
                        : selectedOptions[group.id]
                          ? "Added"
                          : "Optional"}
                    </span>
                  </div>

                  <div>
                    {group.options.map((opt) => {
                      const selected = selectedOptions[group.id];

                      const isActive =
                        group.type === "single"
                          ? selected === opt.id
                          : Array.isArray(selected) &&
                            selected.includes(opt.id);

                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedOptions((prev) => {
                              const current = prev[group.id];

                              if (group.type === "single") {
                                return { ...prev, [group.id]: opt.id };
                              }

                              let updated = Array.isArray(current)
                                ? [...current]
                                : [];

                              if (updated.includes(opt.id)) {
                                updated = updated.filter((id) => id !== opt.id);
                              } else {
                                updated.push(opt.id);
                              }

                              return { ...prev, [group.id]: updated };
                            });
                          }}
                          className="
  w-full flex justify-between items-start
  py-2.5 px-2
  text-sm transition
  rounded-lg
  hover:bg-muted/50
  active:scale-[0.98]
"
                        >
                          <div className="flex items-start gap-3">
                            {/* INDICATOR */}
                            {group.type === "single" ? (
                              // 🔵 RADIO
                              <div
                                className={`
    h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center
    ${isActive ? "border-primary bg-primary/10" : "border-border"}
  `}
                              >
                                {isActive && (
                                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                                )}
                              </div>
                            ) : (
                              // ☑️ CHECKBOX
                              <div
                                className={`
    h-5 w-5 flex-shrink-0 rounded border flex items-center justify-center
    ${isActive ? "border-primary bg-primary" : "border-border"}
  `}
                              >
                                {isActive && (
                                  <Check className="h-3 w-3 text-white stroke-[3]" />
                                )}
                              </div>
                            )}

                            {/* LABEL */}
                            <span
                              className={`
    flex-1 text-left leading-snug break-words
    ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}
  `}
                            >
                              {opt.name}
                            </span>
                          </div>

                          <span className="text-muted-foreground text-xs">
                            {opt.price ? `+${formatTHB(opt.price)}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* NOTE */}
            <div>
              <textarea
                placeholder="Add note..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="
                w-full rounded-xl border border-border
                bg-muted px-3 py-2 text-[16px] max-h-16 min-h-16
                placeholder:text-muted-foreground
                focus:outline-none focus:ring-2 focus:ring-primary/30
              "
                onKeyDown={(e) => {
                  if (e.key === "0" && qty === "") {
                    e.preventDefault(); // block starting with 0
                  }
                }}
              />
            </div>
            <div className="flex justify-center">
              <div className="flex items-center justify-center gap-3 bg-muted/40 px-3 py-1.5 rounded-full">
                {/* MINUS */}
                <button
                  disabled={qtyNum <= 0}
                  onClick={() => setQty(String(Math.max(0, qtyNum - 1)))}
                  className="
      px-2 py-2
flex items-center justify-center
text-muted-foreground hover:text-foreground
active:scale-90 transition
      disabled:opacity-40 disabled:cursor-not-allowed
    "
                >
                  <Minus className="h-3.5 w-3.5 text-secondary-foreground" />
                </button>

                {/* VALUE */}
                <div className="w-8 flex items-center justify-center">
                  <span className="text-md font-semibold tabular-nums">
                    {qtyNum}
                  </span>
                </div>

                {/* PLUS */}
                <button
                  disabled={qtyNum >= 9999}
                  onClick={() => setQty(String(Math.min(9999, qtyNum + 1)))}
                  className="
     px-2 py-1
flex items-center justify-center
text-muted-foreground hover:text-foreground
active:scale-90 transition
      disabled:opacity-40 disabled:cursor-not-allowed
    "
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </button>
              </div>
            </div>

            {/* DISCOUNT */}
            {/* PRICE SUMMARY */}
            <div className="mt-4 px-2 space-y-4">
              {/* SUBTOTAL */}
              <div className="flex justify-between text-sm">
                Subtotal
                <span className="text-xs text-muted-foreground ml-1">
                  ({qtyNum} × {formatTHB(unitPrice)})
                </span>
              </div>

              {/* FREE ITEM (PRIMARY ACTION) */}
              <div className="w-full flex justify-center">
                <div className="w-full flex rounded-xl bg-muted p-1">
                  {["normal", "discount", "free"].map((mode) => {
                    const isDisabled = qtyNum === 0 && mode !== "normal";

                    return (
                      <button
                        key={mode}
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;

                          setPricingMode(mode as any);

                          if (mode === "discount") {
                            setDiscountScope("unit");
                            setAppliedDiscount(null);
                            setDiscountValue("");
                            setLineTarget(null);
                          }

                          if (mode === "normal") {
                            setAppliedDiscount(null);
                            setDiscountValue("");
                            setLineTarget(null);
                            setInputMode("amount");
                          }

                          if (mode === "free") {
                            setAppliedDiscount(null);
                            setDiscountValue("");
                            setLineTarget(null);
                          }
                        }}
                        className={`
        flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center
        transition-all duration-200 ease-out
        active:scale-[0.97]

        ${
          pricingMode === mode
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }

        ${isDisabled ? "opacity-40 cursor-not-allowed grayscale" : ""}
      `}
                      >
                        {mode === "normal"
                          ? "Normal"
                          : mode === "discount"
                            ? "Discount"
                            : "Free"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {qtyNum === 0 && (
                <p className="text-[11px] text-muted-foreground text-center mt-1">
                  Add quantity to enable discount or free
                </p>
              )}

              {pricingMode === "discount" && (
                <div className="space-y-3 p-2.5 rounded-lg bg-muted/20">
                  <div className="space-y-2">
                    {/* LABEL */}
                    <p className="text-[11px] text-muted-foreground px-2">
                      Discount on
                    </p>

                    {/* TOGGLE */}
                    <div className="w-full flex rounded-xl bg-muted p-1">
                      {(["unit", "line"] as DiscountScope[]).map((scope) => {
                        const isLine = scope === "line";
                        const isDisabled = isLine && qtyNum < 2;

                        return (
                          <button
                            key={scope}
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return;

                              setDiscountScope(scope as any);
                              setDiscountValue("");
                              setAppliedDiscount(null);
                              setLineTarget(null);
                            }}
                            className={`
              flex-1 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200

              ${
                discountScope === scope
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }

              ${
                isDisabled
                  ? "opacity-40 cursor-not-allowed grayscale"
                  : "hover:text-foreground active:scale-[0.97]"
              }
            `}
                          >
                            {scopeLabels[scope]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* DISCOUNT (SECONDARY) */}
                  <div className="border-t border-border/50 my-1" />

                  <div className="space-y-2">
                    {/* ✅ LABEL */}
                    <p className="text-[11px] text-muted-foreground px-2">
                      Apply discount
                    </p>

                    <div className="w-full flex rounded-xl bg-muted p-1">
                      {/* AMOUNT */}
                      <button
                        disabled={qtyNum === 0}
                        onClick={() => handleChangeMode("amount")}
                        className={`
      flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center
      transition-all duration-200 ease-out active:scale-[0.97]
      ${
        inputMode === "amount"
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }

      hover:text-foreground active:scale-[0.97]
                        }
    `}
                      >
                        Amount
                      </button>

                      {/* PERCENT */}
                      <button
                        disabled={qtyNum === 0}
                        onClick={() => handleChangeMode("percent")}
                        className={`
      flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center
      transition-all duration-200
      ${
        inputMode === "percent"
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground"
      }
    `}
                      >
                        Percent
                      </button>

                      {/* 🎯 TARGET */}
                      <button
                        disabled={qtyNum === 0}
                        onClick={() => handleChangeMode("target")}
                        className={`
      flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center
      transition-all duration-200 ease-out
      ${
        inputMode === "target"
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground"
      }
    `}
                      >
                        Set Price
                      </button>
                    </div>

                    {/* INPUT */}
                    <div className="space-y-2">
                      <div className="flex items-center rounded-xl bg-muted/30 border-transparent focus:ring-1 focus:ring-primary">
                        {" "}
                        {/* PREFIX (CLICKABLE MODE SWITCH) */}
                        <button
                          type="button"
                          disabled={qtyNum === 0}
                          onClick={() => {
                            const next =
                              inputMode === "amount"
                                ? "percent"
                                : inputMode === "percent"
                                  ? "target"
                                  : "amount";

                            handleChangeMode(next);
                          }}
                          className={`
    h-[37px] px-3 mx-0.5
    rounded-md flex items-center justify-center
    transition-all duration-200 ease-out
    active:scale-95

    ${
      qtyNum === 0
        ? "opacity-40 cursor-not-allowed grayscale"
        : "hover:bg-muted/60 active:scale-95"
    }
  `}
                        >
                          <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
                            {inputMode === "amount" && (
                              <span className="text-[13px] font-medium leading-none">
                                ฿
                              </span>
                            )}

                            {inputMode === "percent" && (
                              <Percent className="w-4 h-4 stroke-[2.2]" />
                            )}

                            {inputMode === "target" && (
                              <Target className="w-4 h-4 stroke-[2.2]" />
                            )}
                          </span>
                        </button>
                        {/* DIVIDER */}
                        <div className="w-px h-6 bg-border/60" />
                        {/* INPUT */}
                        <div className="relative flex-1 min-w-0">
                          <input
                            disabled={qtyNum === 0}
                            type="text"
                            inputMode="decimal"
                            value={discountValue}
                            placeholder="0.00"
                            onChange={(e) => {
                              let val = e.target.value;

                              if (val === "") {
                                setDiscountValue("");
                                setAppliedDiscount(null);
                                setLineTarget(null);
                                return;
                              }

                              if (!/^\d*\.?\d{0,2}$/.test(val)) return;

                              if (/^0\d+/.test(val)) {
                                val = val.replace(/^0+/, "");
                                if (val === "") val = "0";
                              }

                              setDiscountValue(val);

                              const num = parseFloat(val);

                              if (
                                inputMode === "target" &&
                                discountScope === "line"
                              ) {
                                // 🔥 clear stale discount when typing target line
                                if (appliedDiscount) {
                                  setAppliedDiscount(null);
                                }

                                return;
                              }

                              if (appliedDiscount) {
                                // 🎯 TARGET MODE
                                if (inputMode === "target") {
                                  if (discountScope === "line") {
                                    return; // ignore appliedDiscount
                                  }

                                  const expectedValue = unitPrice - num;

                                  if (
                                    Math.abs(
                                      appliedDiscount.value - expectedValue,
                                    ) > 0.01
                                  ) {
                                    setAppliedDiscount(null);
                                  }

                                  return;
                                }

                                // 💰 AMOUNT / PERCENT MODE
                                const expectedValue = num;

                                if (
                                  Math.abs(
                                    appliedDiscount.value - expectedValue,
                                  ) > 0.01 ||
                                  appliedDiscount.type !== effectiveDiscountType
                                ) {
                                  setAppliedDiscount(null);
                                }
                              }
                            }}
                            onBlur={() => {
                              if (!discountValue) return;

                              let num = parseFloat(discountValue);

                              if (isNaN(num)) return;

                              // only format, NOT clamp
                              num = Math.round(num * 100) / 100;

                              setDiscountValue(num.toString());
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            className="
  relative z-10
  w-full
  bg-transparent px-3 py-2 pr-10 text-[16px]
  outline-none
"
                          />

                          {/* 🔥 SMALL CLEAR BUTTON (inside input) */}
                          {showClearInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setDiscountValue("");
                                setAppliedDiscount(null);
                                setLineTarget(null);
                              }}
                              className="
    absolute right-2.5 top-1/2 -translate-y-1/2
    h-6 w-6 flex items-center justify-center
    rounded-full bg-muted hover:bg-muted/80
    active:scale-95 transition
    z-20
  "
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                        {/* DIVIDER */}
                        <div className="w-px h-6 bg-border/60" />
                        {/* APPLY BUTTON */}
                        {appliedDiscount || lineTarget != null ? (
                          <button
                            disabled={!discountValue || qtyNum === 0}
                            onClick={handleRemoveDiscount}
                            className="
      h-[37px] px-3 mx-0.5
      rounded-md flex items-center justify-center gap-1
      text-xs font-medium
      transition-all duration-150
      active:scale-95
      bg-red-500/90 text-white
    "
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (isZeroOrInvalid || isOverLimit) return;
                              handleApplyDiscount();
                            }}
                            disabled={
                              isZeroOrInvalid || isOverLimit || qtyNum === 0
                            }
                            className={`
    h-[37px] px-3 mx-0.5
    rounded-md flex items-center justify-center gap-1
    text-xs font-medium
    transition-all duration-150

    ${!(isZeroOrInvalid || isOverLimit) ? "active:scale-95" : ""}

    ${
      isZeroOrInvalid || isOverLimit
        ? "bg-muted text-muted-foreground opacity-40 cursor-not-allowed"
        : isDirty
          ? "bg-primary text-white shadow-sm"
          : "bg-muted text-muted-foreground"
    }
  `}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* ERROR: invalid (0, NaN, empty) */}
                      {discountValue && isZeroOrInvalid && !isOverLimit && (
                        <p className="text-[11px] text-red-400/80 pl-1">
                          {inputMode === "percent"
                            ? `Minimum allowed: ${MIN_PERCENT}%`
                            : "Value must be greater than 0"}
                        </p>
                      )}

                      {/* ERROR: over limit */}
                      {discountValue && isOverLimit && (
                        <p className="text-[11px] text-red-400/80 pl-1">
                          {inputMode === "percent"
                            ? "Maximum allowed: 99.99%"
                            : inputMode === "amount"
                              ? `Max allowed: ${
                                  discountScope === "unit"
                                    ? formatTHB(Math.max(0, unitPrice - 0.01))
                                    : formatTHB(
                                        Math.max(0, unitPrice * qtyNum - 0.01),
                                      )
                                }`
                              : inputMode === "target"
                                ? `Must be less than ${
                                    discountScope === "unit"
                                      ? formatTHB(unitPrice)
                                      : formatTHB(unitPrice * qtyNum)
                                  }`
                                : ""}
                        </p>
                      )}

                      {/* HELPER (only when valid typing) */}
                      {discountValue && !isZeroOrInvalid && !isOverLimit && (
                        <p className="text-[11px] text-muted-foreground pl-1 pt-0.5">
                          {inputMode === "amount" &&
                            (discountScope === "unit"
                              ? `Discount ${formatTHB(parseFloat(discountValue || "0"))} per item`
                              : `Discount ${formatTHB(parseFloat(discountValue || "0"))} on total`)}

                          {inputMode === "percent" &&
                            `${discountValue}% off ${
                              discountScope === "unit" ? "per item" : "total"
                            }`}

                          {inputMode === "target" &&
                            (discountScope === "unit"
                              ? `Final price ${formatTHB(parseFloat(discountValue || "0"))} per item`
                              : `Final total ${formatTHB(parseFloat(discountValue || "0"))}`)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {pricingMode === "free" ? (
                <div className="flex items-center justify-between rounded-xl px-3 py-2 bg-green-500/5 border border-green-500/10">
                  <div className="flex flex-col leading-tight">
                    <span className="text-green-500 font-medium text-sm">
                      Free item
                    </span>

                    <span className="text-[11px] text-muted-foreground">
                      {formatTHB(unitPrice)} × {qtyNum}
                    </span>
                  </div>

                  <span className="text-green-500 font-semibold">
                    −{formatTHB(unitPrice * qtyNum)}
                  </span>
                </div>
              ) : pricingMode === "discount" &&
                (lineTarget != null || unitDiscount * qtyNum > 0) ? (
                <div className="flex items-center justify-between rounded-xl px-3 py-2 bg-red-500/5 border border-red-500/10">
                  <div className="flex flex-col leading-tight">
                    {/* ✅ LABEL */}
                    <span className="text-red-500 font-medium text-sm">
                      {inputMode === "target" ? "Final price" : "Discount"}
                      {inputMode === "percent" ? ` ${safeDiscountValue}%` : ""}
                    </span>

                    {/* ✅ CALCULATION */}
                    <span className="text-[11px] text-muted-foreground">
                      {lineTarget != null ? (
                        <>{formatTHB(displayDiscount)} total</>
                      ) : discountScope === "unit" ? (
                        <>
                          {formatTHB(unitDiscount)} × {qtyNum}
                        </>
                      ) : (
                        <>{formatTHB(unitDiscount * qtyNum)} total</>
                      )}
                    </span>
                  </div>

                  {/* ✅ TOTAL */}
                  <span className="text-red-500 font-semibold">
                    −{formatTHB(displayDiscount)}
                  </span>
                </div>
              ) : null}

              {/* TOTAL */}
              <div className="flex justify-between text-lg font-bold pt-1 border-t border-border">
                <span>Total</span>
                <span>{formatTHB(finalLineTotal)}</span>
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button
              size="lg"
              disabled={!canAdd && !isZeroQty}
              className={`
    w-full h-14 rounded-xl
    flex flex-col items-center justify-center gap-0.5
    text-sm font-semibold
    ${!canAdd && !isZeroQty ? "opacity-40 pointer-events-none" : ""}
  `}
              onClick={() => {
                if (isZeroQty) {
                  onClose();
                  return;
                }

                if (!isValid && firstMissingGroup) {
                  groupRefs.current[firstMissingGroup.id]?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  return;
                }

                handleConfirm();
              }}
            >
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {/* ADD TO CART */}
                <span
                  className={`
      absolute inset-0 flex items-center justify-center
      transition-all duration-200
      ${isZeroQty ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"}
    `}
                >
                  Add to cart
                  {canAdd ? ` - ${formatTHB(finalLineTotal)}` : ""}
                </span>

                {/* BACK TO MENU */}
                <span
                  className={`
      absolute inset-0 flex items-center justify-center
      transition-all duration-200
      ${isZeroQty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
    `}
                >
                  Back to menu
                </span>
              </div>
            </Button>
          </SheetFooter>
        </div>
      )}
    </BaseSheet>
  );
};

export default ProductCustomizer;

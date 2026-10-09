import { useState, useEffect } from "react";
import {
    computeDiscount,
    InputMode,
    MIN_PERCENT,
    getMaxDiscount,
    isInvalidResult,
} from "@/lib/discount/discount";
import { useConfirm } from "@/hooks/ConfirmProvider";


import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Button } from "@/components/ui/button";

import { Percent, Target, X, Check, Trash2 } from "lucide-react";

interface Props {
    baseTotal: number;
    initialValue?: number;
    initialMode?: InputMode;
    onClose: () => void;

    onApply: (data: {
        value: number;
        inputMode: InputMode;
        inputValue: number;
    }) => void;

    open: boolean;
    isOpening: boolean;
    isClosing?: boolean;
    hasExistingDiscount?: boolean;
}

const OrderDiscountEditor = ({
    baseTotal,
    initialValue = 0,
    initialMode,
    onClose,
    onApply,
    open,
    isOpening,
    isClosing,
    hasExistingDiscount,
}: Props) => {
    // =========================
    // STATE (MATCH PRODUCT)
    // =========================
    const [inputMode, setInputMode] = useState<InputMode>(
        initialMode || "amount"
    );

    const [value, setValue] = useState("");

    const [appliedDiscount, setAppliedDiscount] = useState<{
        type: "amount" | "percent";
        value: number;
    } | null>(null);

    const [lineTarget, setLineTarget] = useState<number | null>(null);




    // =========================
    // RAW VALUE
    // =========================
    const rawNum = parseFloat(value || "0");

    // =========================
    // COMPUTE (SAME ENGINE)
    // =========================
    const result = computeDiscount({
        inputMode,
        discountScope: "line",
        value: rawNum,
        unitPrice: baseTotal,
        qty: 1,
        minPercent: MIN_PERCENT,
    });

    // =========================
    // VALIDATION (MATCH PRODUCT)
    // =========================
    const isZeroOrInvalid =
        value === "" ||
        isNaN(rawNum) ||
        (inputMode === "percent"
            ? rawNum < MIN_PERCENT
            : rawNum <= 0);

    const max = getMaxDiscount({
        inputMode,
        discountScope: "line",
        unitPrice: baseTotal,
        qty: 1,
    });

    const isOverLimit =
        inputMode === "percent"
            ? rawNum > max
            : inputMode === "amount"
                ? rawNum > max
                : inputMode === "target"
                    ? rawNum >= max
                    : false;

    const isInvalid = isZeroOrInvalid || isOverLimit;

    // =========================
    // DIRTY (MATCH PRODUCT)
    // =========================
    const isDirty =
        value !== "" &&
        (inputMode === "target"
            ? lineTarget == null || Math.abs(lineTarget - rawNum) > 0.01
            : !appliedDiscount ||
            Math.abs(appliedDiscount.value - rawNum) > 0.01 ||
            appliedDiscount.type !==
            (inputMode === "percent" ? "percent" : "amount"));

    // =========================
    // DISPLAY CALCULATION
    // =========================
    const discount =
        lineTarget != null
            ? Math.max(0, baseTotal - lineTarget)
            : appliedDiscount
                ? inputMode === "percent"
                    ? (baseTotal * appliedDiscount.value) / 100
                    : appliedDiscount.value
                : 0;

    const final =
        lineTarget != null
            ? lineTarget
            : Math.max(0, baseTotal - discount);


    const showClearInput = value !== "";

    // =========================
    // APPLY INPUT (✔)
    // =========================
    const handleApplyInput = () => {
        if (isInvalid) return;

        if (!result.valid) return; // ✅ REQUIRED

        if (result.lineTarget != null) {
            setLineTarget(result.lineTarget);
            setAppliedDiscount(null);
        } else if (result.appliedDiscount) {
            setAppliedDiscount(result.appliedDiscount);
            setLineTarget(null);
        }
    };

    const confirm = useConfirm();


    // =========================
    // REMOVE (❌)
    // =========================
    const handleRemove = () => {
        onApply({
            value: 0,
            inputMode: "amount",
            inputValue: 0,
        });

        onClose();
    };

    // =========================
    // FINAL APPLY
    // =========================
    const handleApply = () => {
        onApply({
            value: discount,
            inputMode,
            inputValue: rawNum || 0,
        });

        onClose();
    };

    // =========================
    // INPUT CHANGE (🔥 IMPORTANT)
    // =========================
    const handleChange = (val: string) => {
        if (val === "") {
            setValue("");
            setAppliedDiscount(null);
            setLineTarget(null);
            return;
        }

        if (!/^\d*\.?\d{0,2}$/.test(val)) return;

        let clean = val;

        if (/^0\d+/.test(clean)) {
            clean = clean.replace(/^0+/, "");
            if (clean === "") clean = "0";
        }

        setValue(clean);

        const num = parseFloat(clean);

        // 🔥 LIVE INVALIDATION
        if (lineTarget != null && Math.abs(lineTarget - num) > 0.01) {
            setLineTarget(null);
        }

        if (appliedDiscount) {
            if (
                Math.abs(appliedDiscount.value - num) > 0.01 ||
                appliedDiscount.type !==
                (inputMode === "percent" ? "percent" : "amount")
            ) {
                setAppliedDiscount(null);
            }
        }
    };

    // =========================
    // MODE SWITCH
    // =========================
    const handleChangeMode = (mode: InputMode) => {
        if (mode === inputMode) return;

        setInputMode(mode);
        setValue("");
        setAppliedDiscount(null);
        setLineTarget(null);
    };

    const handleClearInput = () => {
        setValue("");
        setAppliedDiscount(null);
        setLineTarget(null);
    };


    useEffect(() => {
        if (!open) return;

        const initMode = initialMode || "amount";
        setInputMode(initMode);

        if (initialValue > 0) {
            const formatted = initialValue.toFixed(2);
            setValue(formatted);

            const recomputed = computeDiscount({
                inputMode: initMode,
                discountScope: "line",
                value: initialValue,
                unitPrice: baseTotal,
                qty: 1,
                minPercent: MIN_PERCENT,
            });

            if (isInvalidResult(recomputed)) {
                setAppliedDiscount(null);
                setLineTarget(null);
                return;
            }

            // ✅ NOW it's guaranteed valid

            if (recomputed.lineTarget != null) {
                setLineTarget(recomputed.lineTarget);
                setAppliedDiscount(null);
            } else if (recomputed.appliedDiscount) {
                setAppliedDiscount(recomputed.appliedDiscount);
                setLineTarget(null);
            } else {
                setAppliedDiscount(null);
                setLineTarget(null);
            }
        } else {
            setValue("");
            setAppliedDiscount(null);
            setLineTarget(null);
        }
    }, [open, initialMode, initialValue, baseTotal]);


    // =========================
    // UI
    // =========================
    return (
        <BaseSheet
            open={open}
            isOpening={isOpening}
            isClosing={isClosing}
            onClose={onClose}
            variant="full"
            className="bg-background flex flex-col"
        >
            {({ onDragStart, onDragMove, onDragEnd }) => (
                <div className="flex flex-col h-full overflow-hidden">
                    <SheetHeader
                        title="Order Discount"
                        subtitle="Apply discount to entire order"
                        onClose={onClose}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                        right={
                            hasExistingDiscount ? (
                                <button
                                    onClick={() =>
                                        confirm({
                                            title: "Remove discount?",
                                            description: "Discount will be cleared.",
                                            confirmText: "Remove",
                                            variant: "destructive",
                                            onConfirm: handleRemove,
                                        })
                                    }
                                    className="
        h-9 w-9 flex items-center justify-center
        rounded-full
        bg-destructive/10 hover:bg-destructive/20
        text-destructive/70 hover:text-destructive
        transition-all duration-200
        active:scale-95
      "
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            ) : null
                        }
                    />

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                        {/* MODE */}
                        <div className="flex rounded-xl bg-muted p-1">
                            {(["amount", "percent", "target"] as InputMode[]).map(
                                (mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => handleChangeMode(mode)}
                                        className={`flex-1 py-2 rounded-lg text-sm transition ${inputMode === mode
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-muted-foreground"
                                            }`}
                                    >
                                        {mode === "amount"
                                            ? "Amount"
                                            : mode === "percent"
                                                ? "Percent"
                                                : "Set Price"}
                                    </button>
                                )
                            )}
                        </div>

                        {/* INPUT */}
                        <div className="flex items-center h-[37px] rounded-xl bg-muted/30 px-1">
                            {/* PREFIX */}
                            <button
                                type="button"
                                onClick={() => {
                                    const next =
                                        inputMode === "amount"
                                            ? "percent"
                                            : inputMode === "percent"
                                                ? "target"
                                                : "amount";

                                    handleChangeMode(next);
                                }}
                                className="
    h-full px-3 mx-0.5
    flex items-center justify-center
    rounded-md
    transition-all duration-200 ease-out
    active:scale-95
    hover:bg-muted/60
  "
                            >
                                <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
                                    {inputMode === "amount" && (
                                        <span className="text-[13px] font-medium leading-none">฿</span>
                                    )}
                                    {inputMode === "percent" && <Percent className="w-4 h-4" />}
                                    {inputMode === "target" && <Target className="w-4 h-4" />}
                                </span>
                            </button>

                            {/* DIVIDER */}
                            <div className="w-px h-6 bg-border/60" />

                            {/* INPUT */}
                            <div className="relative flex-1 min-w-0">
                                <input
                                    value={value}
                                    onChange={(e) => handleChange(e.target.value)}
                                    placeholder="0.00"
                                    inputMode="decimal"
                                    className="
  w-full h-full
  bg-transparent px-2 pr-10
  outline-none
  text-[16px]
"
                                />

                                {/* 🔥 SMALL CLEAR BUTTON */}
                                {showClearInput && (
                                    <button
                                        type="button"
                                        onClick={handleClearInput}
                                        className="
        absolute right-2.5 top-1/2 -translate-y-1/2
        h-6 w-6 flex items-center justify-center
        rounded-full bg-muted hover:bg-muted/80
        active:scale-95 transition
      "
                                    >
                                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                )}
                            </div>

                            {/* BUTTON */}
                            {appliedDiscount || lineTarget != null ? (
                                <button
                                    onClick={handleClearInput}
                                    className="
      h-[37px] px-3 mx-0.5
      rounded-md flex items-center justify-center

      bg-red-500/90 text-white
      hover:bg-red-500
      active:scale-95
      transition-all duration-150
    "
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleApplyInput}
                                    disabled={isInvalid}
                                    className={`
    h-[37px] px-3 mx-0.5
    rounded-md flex items-center justify-center

    transition-all duration-150

    ${!isInvalid ? "active:scale-95" : ""}

    ${isInvalid
                                            ? "bg-muted text-muted-foreground opacity-40 cursor-not-allowed"
                                            : isDirty
                                                ? "bg-blue-500 text-white shadow-sm"
                                                : "bg-muted text-muted-foreground"
                                        }
  `}
                                >
                                    <Check className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* HINT / ERROR */}
                        {value !== "" && (
                            <div className="px-1 text-[11px]">
                                {isZeroOrInvalid && (
                                    <p className="text-red-500">
                                        {inputMode === "percent"
                                            ? "Minimum allowed: 1%"
                                            : "Value must be greater than 0"}
                                    </p>
                                )}

                                {!isZeroOrInvalid && isOverLimit && (
                                    <p className="text-red-500">
                                        {inputMode === "percent"
                                            ? `Maximum allowed: ${max.toFixed(2)}%`
                                            : inputMode === "amount"
                                                ? `Max allowed: ${max.toFixed(2)}`
                                                : `Must be less than ${max.toFixed(2)}`}
                                    </p>
                                )}

                                {!isInvalid && (
                                    <p className="text-muted-foreground">
                                        {inputMode === "percent"
                                            ? `Discount ${rawNum}%`
                                            : inputMode === "amount"
                                                ? `Discount ${rawNum.toFixed(2)}`
                                                : `Set total to ${rawNum.toFixed(2)}`}
                                    </p>
                                )}
                            </div>
                        )}


                        {/* PREVIEW */}
                        <div className="rounded-xl bg-muted/30 p-3 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>฿{baseTotal.toFixed(2)}</span>
                            </div>

                            {discount > 0 && (
                                <div className="flex justify-between text-red-500">
                                    <span>Discount</span>
                                    <span>-฿{discount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between font-bold text-lg border-t pt-2">
                                <span>Total</span>
                                <span>฿{final.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <SheetFooter>
                        <Button
                            className="w-full h-14"
                            disabled={isInvalid || isDirty}
                            onClick={handleApply}
                        >
                            Apply Discount
                        </Button>
                    </SheetFooter>
                </div>
            )}
        </BaseSheet>
    );
};

export default OrderDiscountEditor;
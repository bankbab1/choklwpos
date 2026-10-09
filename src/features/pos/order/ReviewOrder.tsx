import { CartItem } from "@/data/products";
import {
    getUnitDiscount,
    getLineTotal,
    getOriginalLineTotal,
} from "@/lib/pricing/pricing";
import { Button } from "@/components/ui/button";
import { User, Tag, X, ChevronRight, MinusCircle, FileText } from "lucide-react";
import { InputMode } from "@/lib/discount/discount";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";

interface Props {
    items: CartItem[];
    invalidItems?: string[];
    onBack: () => void;
    onConfirm: () => void;
    onSaveOpen?: () => void;
    onUpdateOrder?: () => void;
    onConvertToOpen?: () => void;
    isExistingOrder?: boolean;
    existingOrderStatus?: "open" | "hold";
    contextLabel?: string;
    onEditItem?: (item: CartItem) => void;
    onViewBill?: () => void;

    open: boolean;
    isOpening?: boolean;
    isClosing?: boolean;

    onSelectMember?: () => void;
    onApplyPromo?: () => void;
    onEditOrderDiscount?: () => void;

    orderDiscount?: {
        value: number;
        inputMode: InputMode;
    };
    memberName?: string;
    memberDiscount?: number;
    promotionName?: string;
    promotionDiscount?: number;
}

const ReviewOrder = ({
    items,
    invalidItems,
    onBack,
    onConfirm,
    onSaveOpen,
    onUpdateOrder,
    onConvertToOpen,
    isExistingOrder = false,
    existingOrderStatus,
    contextLabel,
    onEditItem,
    onViewBill,
    open,
    isOpening,
    isClosing,
    onSelectMember,
    onApplyPromo,
    onEditOrderDiscount,
    orderDiscount = { value: 0, inputMode: "amount" },
    memberName,
    memberDiscount = 0,
    promotionName,
    promotionDiscount = 0,
}: Props) => {
    const hasInvalid = invalidItems && invalidItems.length > 0;

    if (!open && !isClosing) return null;
    const lineCount = items.length;
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

    // 🔥 BASE TOTAL (before ALL discounts)
    const originalTotal = items.reduce(
        (sum, i) => sum + getOriginalLineTotal(i),
        0,
    );

    // 🔥 ITEM DISCOUNT (already applied inside items)
    const itemFinalTotal = items.reduce((sum, i) => sum + getLineTotal(i), 0);

    const itemSavings = originalTotal - itemFinalTotal;

    const hasItemDiscount = itemSavings > 0;


    // 🔥 ORDER-LEVEL DISCOUNTS
    const discountAmount = orderDiscount?.value ?? 0;

    const extraDiscount = discountAmount + promotionDiscount;

    const finalTotal = Math.max(
        0,
        itemFinalTotal - memberDiscount - extraDiscount
    );

    const formatOptionsLines = (options?: any[]) => {
        if (!options || options.length === 0) return [];

        const labelMap: Record<string, string> = {
            "Sweet Level": "Sweet",
            "Add-ons": "Add-on",
        };

        return options.map((opt) => ({
            label: labelMap[opt.groupName] || opt.groupName,
            value: opt.optionName,
            price: opt.price,
        }));
    };


    return (
        <BaseSheet
            open={open}
            isOpening={isOpening}
            isClosing={isClosing}
            onClose={onBack}
            variant="full" // 👈 THIS IS THE MAGIC
            className="bg-background flex flex-col"
        >
            {({ onDragStart, onDragMove, onDragEnd }) => (
                <div className="flex flex-col h-full overflow-hidden">
                    {/* HEADER */}
                    <SheetHeader
                        title={isExistingOrder ? `Order ${contextLabel ?? ""}`.trim() : "Order Summary"}
                        subtitle={`${lineCount} item (${totalQty} pcs)${isExistingOrder ? " · Adding to open order" : ""}`}
                        onClose={onBack}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                        right={
                            onViewBill && lineCount > 0 ? (
                                <button
                                    onClick={onViewBill}
                                    aria-label="View bill"
                                    className="h-9 px-3 flex items-center gap-1.5 rounded-full bg-muted/70 hover:bg-muted text-xs font-semibold active:scale-95 transition"
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    Bill
                                </button>
                            ) : undefined
                        }
                    />




                    <div className="px-5 pt-4 pb-2">
                        {/* MEMBER SECTION */}
                        <button
                            onClick={onSelectMember}
                            className="
                                w-full rounded-xl
                                px-3 py-2
                                flex items-center justify-between
                                border border-border/50
                                bg-muted/30
                                hover:bg-muted/50
                                transition-all
                                active:scale-[0.99]
                            "
                        >
                            {/* LEFT */}
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <User className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-semibold">
                                    {memberName || "Walk-in"}
                                </span>
                            </div>

                            {/* RIGHT */}
                            <div className="flex items-center gap-1.5">
                                {memberDiscount > 0 && (
                                    <span className="text-green-600 text-xs font-semibold">
                                        -฿{memberDiscount.toFixed(2)}
                                    </span>
                                )}
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                        </button>
                    </div>
                    {/* ITEMS */}
                    <div className="flex-1 overflow-y-auto px-5 py-2">
                        {items.map((item, index) => {
                            const unitDiscount = getUnitDiscount(item);
                            const original = getOriginalLineTotal(item);
                            const final = getLineTotal(item);

                            const discount =
                                item.lineTarget != null
                                    ? original - item.lineTarget
                                    : unitDiscount * item.quantity;

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => onEditItem?.(item)}
                                    className="py-2.5 border-b border-border/60"
                                >
                                    {(() => {
                                        const optionLines = formatOptionsLines(item.options);

                                        return (
                                            <>
                                                {/* TOP ROW */}
                                                <div className="grid grid-cols-[20px_1fr_28px_72px] gap-2 items-start">
                                                    <div className="text-xs text-muted-foreground">
                                                        {index + 1}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium leading-tight break-words">
                                                            {item.name}
                                                        </p>
                                                    </div>

                                                    <div className="text-xs text-muted-foreground text-right mt-[1px]">
                                                        x{item.quantity}
                                                    </div>

                                                    <div className="text-right leading-tight">

                                                        <p className="text-sm font-semibold">
                                                            ฿{final.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* OPTIONS */}
                                                {optionLines.length > 0 && (
                                                    <div className="grid grid-cols-[20px_1fr_28px_72px] gap-2 mt-1">
                                                        <div />
                                                        <div className="min-w-0 space-y-[2px] text-[11px] text-muted-foreground pr-2">
                                                            {optionLines.map((opt, i) => (
                                                                <div key={i} className="leading-snug break-words">
                                                                    <span className="opacity-70">{opt.label}:</span>{" "}
                                                                    <span className="text-foreground font-medium">
                                                                        {opt.value}
                                                                    </span>
                                                                    {opt.price > 0 && (
                                                                        <span className="ml-1 text-muted-foreground whitespace-nowrap">
                                                                            (+฿{opt.price.toFixed(2)})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div />
                                                        <div />
                                                    </div>
                                                )}

                                                {/* NOTE / DISCOUNT / FREE */}
                                                {(item.note || item.isFree || discount > 0) && (
                                                    <div className="grid grid-cols-[20px_1fr_28px_72px] gap-2 mt-1">
                                                        <div />
                                                        <div className="min-w-0 space-y-[2px] text-[11px]">
                                                            {item.note && (
                                                                <div className="text-muted-foreground break-words">
                                                                    Note: {item.note}
                                                                </div>
                                                            )}

                                                            {item.isFree ? (
                                                                <div className="text-green-600 font-medium">
                                                                    Free (-฿{original.toFixed(2)})
                                                                </div>
                                                            ) : discount > 0 ? (
                                                                <div className="text-red-400">
                                                                    Discount: -฿{discount.toFixed(2)}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div />
                                                        <div />
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                    </div>






                    {/* FOOTER */}
                    <SheetFooter className="space-y-3 py-3">
                        {/* 🔥 COMPACT DISCOUNT TILES */}
                        <div className="grid grid-cols-3 gap-2">
                            {/* Item Discount (read-only) */}
                            <div
                                className={`rounded-xl border border-border/60 bg-muted/30 px-2 py-2 flex flex-col items-center text-center ${hasItemDiscount ? "" : "opacity-60"
                                    }`}
                            >
                                <MinusCircle
                                    className={`w-4 h-4 mb-1 ${hasItemDiscount ? "text-orange-500" : "text-muted-foreground"
                                        }`}
                                />
                                <span className="text-[11px] text-muted-foreground leading-tight">
                                    Item Disc.
                                </span>
                                <span
                                    className={`text-xs font-semibold mt-0.5 ${itemSavings > 0 ? "text-green-600" : "text-muted-foreground"
                                        }`}
                                >
                                    {itemSavings > 0 ? `-฿${itemSavings.toFixed(2)}` : "฿0.00"}
                                </span>
                            </div>

                            {/* Promo */}
                            <button
                                onClick={onApplyPromo}
                                className="rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition px-2 py-2 flex flex-col items-center text-center"
                            >
                                <Tag className="w-4 h-4 mb-1 text-purple-500" />
                                <span className="text-[11px] text-muted-foreground leading-tight truncate max-w-full">
                                    {promotionName || "Promo"}
                                </span>
                                <span
                                    className={`text-xs font-semibold mt-0.5 ${promotionDiscount > 0 ? "text-green-600" : "text-muted-foreground"
                                        }`}
                                >
                                    {promotionDiscount > 0
                                        ? `-฿${promotionDiscount.toFixed(2)}`
                                        : "Add"}
                                </span>
                            </button>

                            {/* Order Discount */}
                            <button
                                onClick={() => onEditOrderDiscount?.()}
                                className="rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition px-2 py-2 flex flex-col items-center text-center"
                            >
                                <MinusCircle
                                    className={`w-4 h-4 mb-1 ${discountAmount > 0 ? "text-orange-500" : "text-muted-foreground"
                                        }`}
                                />
                                <span className="text-[11px] text-muted-foreground leading-tight">
                                    Order Disc.
                                </span>
                                <span
                                    className={`text-xs font-semibold mt-0.5 ${discountAmount > 0 ? "text-green-600" : "text-muted-foreground"
                                        }`}
                                >
                                    {discountAmount > 0
                                        ? `-฿${discountAmount.toFixed(2)}`
                                        : "Add"}
                                </span>
                            </button>
                        </div>

                        {/* 🔥 TOTAL */}
                        <div className="flex justify-between items-center font-bold text-base px-1 pt-2 border-t border-border/60">
                            <span>Total</span>
                            <span>฿{finalTotal.toFixed(2)}</span>
                        </div>

                        <div className="flex gap-2">
                            {isExistingOrder ? (
                                <>
                                    {existingOrderStatus === "hold" && onConvertToOpen ? (
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-14 font-semibold"
                                            onClick={onConvertToOpen}
                                            disabled={hasInvalid}
                                        >
                                            Save as Open
                                        </Button>
                                    ) : onUpdateOrder && (
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-14 font-semibold"
                                            onClick={onUpdateOrder}
                                            disabled={hasInvalid}
                                        >
                                            Update Order
                                        </Button>
                                    )}
                                    <Button
                                        className="flex-1 h-14 font-semibold"
                                        onClick={onConfirm}
                                        disabled={hasInvalid}
                                    >
                                        {hasInvalid ? "Fix items" : "Pay Now"}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {onSaveOpen && (
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-14 font-semibold"
                                            onClick={onSaveOpen}
                                            disabled={hasInvalid}
                                        >
                                            Save as Open
                                        </Button>
                                    )}
                                    <Button
                                        className="flex-1 h-14 font-semibold"
                                        onClick={onConfirm}
                                        disabled={hasInvalid}
                                    >
                                        {hasInvalid ? "Fix items" : "Confirm & Pay"}
                                    </Button>
                                </>
                            )}
                        </div>
                    </SheetFooter>


                </div>
            )}
        </BaseSheet>
    );
};

export default ReviewOrder;

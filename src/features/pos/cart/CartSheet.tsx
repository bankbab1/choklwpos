import { CartItem } from "@/data/products";
import { getCartTotal } from "@/lib/pricing/pricing";
import {
  getUnitPrice,
  getUnitDiscount,
  getLineTotal,
  getOriginalLineTotal,
} from "@/lib/pricing/pricing";

import { Button } from "@/components/ui/button";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { formatTHB } from "@/lib/pricing/currency";

import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Pencil,
  AlertTriangle,
  ChevronRight,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { OrderContextChip } from "@/features/pos/cart/OrderContextChip";
import type { OrderService } from "@/features/pos/tables/TablesProvider";

interface CartSheetProps {
  items: CartItem[];
  onAddItem: (item: CartItem) => void;
  onEditItem: (item: CartItem) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onSetQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onRestore: (items: CartItem[]) => void;
  onCheckout: () => void;
  onHold: () => void;
  onSwitchContext: (orderId: string | null) => void;
  service: OrderService | null;
  onEditService: () => void;
  isExistingOrder: boolean;
  open: boolean;
  isOpening: boolean;
  isClosing?: boolean;
  onClose: () => void;
  invalidItems?: string[];
}

const CartSheet = ({
  items,
  onAddItem,
  onEditItem,
  onUpdateQuantity,
  onSetQuantity,
  onRemove,
  onClear,
  onRestore,
  onCheckout,
  onHold,
  onSwitchContext,
  service,
  onEditService,
  isExistingOrder,
  open,
  isOpening,
  isClosing,
  onClose,
  invalidItems = [],
}: CartSheetProps) => {
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

  const confirm = useConfirm();

  const subtotal = getCartTotal(items);
  const total = subtotal;
  const lineCount = items.length;
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  const hasInvalid = invalidItems.length > 0;

  const isCheckoutDisabled = totalQty === 0 || hasInvalid;

  if (!open && !isClosing) return null;

  return (
    <BaseSheet
      open={open}
      isOpening={isOpening}
      isClosing={isClosing}
      onClose={onClose}
      className="bg-card rounded-t-2xl flex flex-col"
      showOverlay
    >
      {({ onDragStart, onDragMove, onDragEnd }) => (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <SheetHeader
            title="Current Order"
            onClose={onClose}
            subtitle={`${lineCount} item (${totalQty} pcs)`}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            right={
              items.length > 0 ? (
                <button
                  onClick={() =>
                    confirm({
                      title: isExistingOrder ? "Cancel this order?" : "Clear cart?",
                      description: isExistingOrder
                        ? "Items will be removed and the order marked as Cancelled. It stays in Orders history for the record."
                        : "All items will be removed.",
                      confirmText: isExistingOrder ? "Cancel order" : "Clear",
                      variant: "destructive",
                      onConfirm: () => {
                        const snapshot = items;
                        const wasExisting = isExistingOrder;
                        onClear();
                        toast(wasExisting ? "Order cancelled" : "Cart cleared", {
                          description: `${snapshot.length} item${snapshot.length === 1 ? "" : "s"} removed`,
                          duration: 3000,
                          action: {
                            label: "Undo",
                            onClick: () => onRestore(snapshot),
                          },
                          classNames: {
                            actionButton: `
    bg-transparent border-none shadow-none
    p-0 h-auto
    text-primary/90 dark:text-primary/80
    text-xs font-semibold
    hover:text-primary hover:underline
    transition
  `,
                          },
                        });
                      },
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

          {/* Order context and service */}
          <div className="px-5 pt-3 pb-1 space-y-2">
            <OrderContextChip onSwitch={onSwitchContext} />
            {service && (
              <button
                type="button"
                onClick={onEditService}
                className="w-full min-h-14 rounded-xl border border-border bg-secondary/60 px-3 py-2.5 flex items-center gap-3 text-left active:scale-[0.99] transition"
              >
                <span className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                  {service.mode === "takeaway" ? <ShoppingBag className="h-4 w-4 text-primary" /> : <UtensilsCrossed className="h-4 w-4 text-primary" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Order type</span>
                  <span className="block text-sm font-semibold text-foreground truncate">
                    {service.mode === "takeaway"
                      ? "Takeaway"
                      : ["Dine-in", service.tableName, service.guests ? `${service.guests} guests` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Change</span>
              </button>
            )}
          </div>



          {/* Items */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-8 justify-center h-full text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : (
              items.map((item, index) => {
                const unitPrice = getUnitPrice(item);
                const unitDiscount = getUnitDiscount(item);

                const finalLine =
                  item.lineTarget != null
                    ? item.lineTarget
                    : getLineTotal(item);

                const originalLine = getOriginalLineTotal(item);

                const displayDiscount =
                  item.lineTarget != null
                    ? originalLine - item.lineTarget
                    : unitDiscount * item.quantity;

                const isInvalid = invalidItems.includes(item.id);

                return (
                  <div
                    key={item.id}
                    id={`cart-item-${item.id}`}
                    className={`
    rounded-xl px-3 py-3 space-y-2
    transition-all duration-300

    ${
      isInvalid
        ? "bg-red-50/80 border border-red-500/60 animate-shake-strong shadow-[0_0_0_2px_rgba(239,68,68,0.15)]"
        : "bg-surface/90 backdrop-blur-sm"
    }
  `}
                  >
                    {/* TOP ROW */}
                    <div className="flex items-start gap-3">
                      {/* IMAGE + INDEX */}
                      <div className="relative shrink-0">
                        <div className="h-11 w-11 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                          {item.image ? (
                            <img
                              src={item.image}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold">
                              {item.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="absolute -top-1 -left-1 h-5 w-5 text-[10px] flex items-center justify-center rounded-full bg-primary text-white font-bold">
                          {index + 1}
                        </div>
                      </div>

                      {/* CONTENT */}
                      <div className="flex-1 min-w-0">
                        {/* NAME + PRICE */}
                        <div className="min-h-[2.4em] flex justify-between items-start gap-2">
                          <p className="text-sm font-semibold leading-snug line-clamp-2 max-w-[70%]">
                            {item.name}
                          </p>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onEditItem(item)}
                              className="
  h-8 w-8 flex items-center justify-center
  rounded-full
  bg-muted/30 hover:bg-muted/60
  border border-border/50
  text-muted-foreground hover:text-foreground
  shadow-sm
  transition-all duration-150
  active:scale-95 active:shadow-none
"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {/* optional label (very subtle) */}
                            <span className="text-[11px] text-muted-foreground/70 hidden sm:block">
                              Edit
                            </span>
                          </div>
                        </div>

                        {isInvalid && (
                          <div
                            onClick={() => onEditItem(item)}
                            className="
      mb-2
      flex items-center justify-between gap-1.5

      text-[11px] text-red-700

      bg-red-50/70
      border border-red-300/80

      px-3 py-1.5 rounded-lg

      shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]

      cursor-pointer
      transition-all duration-150
      active:scale-[0.98]
    "
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-semibold tracking-tight">
                                Price reset
                              </span>
                            </div>

                            <ChevronRight className="h-3.5 w-3.5 text-red-400/70 shrink-0 opacity-80" />
                          </div>
                        )}

                        {/* OPTIONS */}
                        <div className="mt-1 space-y-[3px]">
                          {formatOptionsLines(item.options).map((opt, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <span className="text-muted-foreground break-words leading-snug max-w-[70%]">
                                {" "}
                                <span className="text-muted-foreground/90">
                                  {opt.label}:
                                </span>{" "}
                                <span className="text-foreground font-medium">
                                  {opt.value}
                                </span>
                              </span>

                              {opt.price > 0 && (
                                <span className="text-muted-foreground tabular-nums ml-2 shrink-0">
                                  +{formatTHB(opt.price)}
                                </span>
                              )}
                            </div>
                          ))}

                          {item.note && (
                            <div className="text-[11px]">
                              <span className="text-muted-foreground/90">
                                Note:{" "}
                              </span>
                              <span className="text-foreground font-medium line-clamp-2 block max-w-[70%] break-words">
                                {item.note}
                              </span>
                            </div>
                          )}

                          {item.isFree ? (
                            <div className="text-[11px] text-green-500 font-medium">
                              Free item
                            </div>
                          ) : item.lineTarget != null || unitDiscount > 0 ? (
                            <div className="text-[11px] text-red-400 font-medium">
                              {item.lineTarget != null
                                ? "Adjusted"
                                : "Discount"}{" "}
                              -{formatTHB(displayDiscount)}{" "}
                              <span className="text-muted-foreground">
                                {item.lineTarget != null
                                  ? "Final Price"
                                  : `(${unitDiscount.toFixed(2)} × ${item.quantity})`}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center pt-2">
                          {/* QTY (PILL STYLE) */}

                          <div className="flex-1 flex justify-center">
                            <div className="inline-flex items-center gap-3 bg-muted/30 px-2 py-2 rounded-full border border-border/40">
                              {/* MINUS */}
                              <button
                                onClick={() => {
                                  const newQty = item.quantity - 1;

                                  if (newQty <= 0) {
                                    const removedItem = { ...item };
                                    confirm({
                                      title: "Remove item?",
                                      description: `${item.name} will be removed.`,
                                      confirmText: "Remove",
                                      variant: "destructive",
                                      onConfirm: () => {
                                        onRemove(item.id);
                                        toast("Removed", {
                                          description: removedItem.name,
                                          duration: 3000,
                                          action: {
                                            label: "Undo",
                                            onClick: () =>
                                              onAddItem(removedItem),
                                          },
                                          classNames: {
                                            actionButton: `
    bg-transparent border-none shadow-none
    p-0 h-auto

    text-primary/90 dark:text-primary/80
    text-xs font-semibold

    hover:text-primary hover:underline
    transition
  `,
                                          },
                                        });
                                      },
                                    });
                                    return;
                                  }

                                  onSetQuantity(item.id, newQty);
                                }}
                                className="
        px-2 py-1
    flex items-center justify-center
    text-muted-foreground hover:text-foreground
    active:scale-90 transition
      "
                              >
                                <Minus className="h-3.5 w-3.5 text-secondary-foreground" />
                              </button>

                              {/* VALUE */}
                              <div className="w-8 flex items-center justify-center">
                                <span className="text-[15px] font-semibold tabular-nums">
                                  {item.quantity}
                                </span>
                              </div>

                              {/* PLUS */}
                              <button
                                disabled={item.quantity >= 9999}
                                onClick={() =>
                                  onSetQuantity(item.id, item.quantity + 1)
                                }
                                className="
        px-2 py-1
    flex items-center justify-center
    text-primary hover:text-primary/80
    active:scale-90 transition
    disabled:opacity-40
      "
                              >
                                <Plus className="h-3.5 w-3.5 text-primary" />
                              </button>
                            </div>
                          </div>

                          {/* LINE TOTAL */}
                          <div className="basis-[6ch] shrink-0 flex flex-col items-end leading-tight">
                            {/* original */}
                            <span
                              className={`
    text-xs text-muted-foreground/60
    ${
      item.lineTarget != null || unitDiscount > 0 ? "line-through" : "opacity-0"
    }
  `}
                            >
                              {formatTHB(originalLine)}
                            </span>

                            <span className="text-foreground text-sm font-bold">
                              {formatTHB(finalLine)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer (ONLY WHEN ITEMS EXIST) */}
          {items.length > 0 && (
            <SheetFooter className="space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatTHB(subtotal)}</span>
                </div>

                <div className="flex justify-between text-foreground font-extrabold text-xl pt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{formatTHB(total)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                {!isExistingOrder && (
                  <Button
                    variant="outline"
                    className="flex-1 h-14 font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border-border"
                    onClick={onHold}
                  >
                    Hold
                  </Button>
                )}

                <Button
                  variant="checkout"
                  size="lg"
                  disabled={isCheckoutDisabled}
                  className="
                flex-1 h-14 rounded-xl flex flex-col items-center justify-center
                disabled:opacity-40
              "
                  onClick={onCheckout}
                >
                  <span className="text-sm font-semibold">Review Order</span>
                  <span className="text-xs opacity-80 tabular-nums">
                    {formatTHB(total)}
                  </span>
                </Button>
              </div>
            </SheetFooter>
          )}
        </div>
      )}
    </BaseSheet>
  );
};

export default CartSheet;

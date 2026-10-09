import { useEffect, useState } from "react";
import { Printer, Share2, Check, Plus, Ban, X } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Button } from "@/components/ui/button";
import ReceiptDocument, { ReceiptProps } from "./ReceiptDocument";
import { printReceipt } from "./printReceipt";
import { shareReceiptImage } from "./shareReceipt";

interface Props extends Omit<ReceiptProps, "mode"> {
    open: boolean;
    isOpening?: boolean;
    isClosing?: boolean;
    onClose: () => void;
    total: number;
    /** "success" shows the celebratory hero + New Order. "view" shows a header + Void. */
    viewMode?: "success" | "view";
    onVoid?: () => void;
    voided?: boolean;
}

const PaymentSuccessSheet = ({
    open,
    isOpening,
    isClosing,
    onClose,
    total,
    viewMode = "success",
    onVoid,
    voided,
    ...receipt
}: Props) => {
    const [showCheck, setShowCheck] = useState(false);

    useEffect(() => {
        if (open && viewMode === "success") {
            setShowCheck(false);
            const t = setTimeout(() => setShowCheck(true), 120);
            return () => clearTimeout(t);
        }
    }, [open, viewMode]);

    if (!open && !isClosing) return null;

    const handleShare = () => {
        const name = receipt.orderId ? `receipt-${receipt.orderId}.png` : "receipt.png";
        void shareReceiptImage(name);
    };

    return (
        <BaseSheet
            open={open}
            isOpening={isOpening}
            isClosing={isClosing}
            onClose={onClose}
            variant="full"
            className="bg-muted/30 flex flex-col"
        >
            {() => (
                <div className="flex flex-col h-full overflow-hidden">
                    {viewMode === "success" ? (
                        <div className="pt-8 pb-5 px-5 text-center bg-gradient-to-b from-emerald-50 to-transparent">
                            <div
                                className={`mx-auto w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all duration-500 ${showCheck ? "scale-100 opacity-100" : "scale-50 opacity-0"
                                    }`}
                            >
                                <Check className="w-8 h-8" strokeWidth={3} />
                            </div>
                            <h2 className="text-xl font-extrabold mt-3">Payment received</h2>
                            <p className="text-3xl font-extrabold tabular-nums mt-1">
                                ฿{total.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {receipt.payment?.method === "cash"
                                    ? "Cash payment"
                                    : `QR · ${receipt.payment?.bankName ?? "Bank"}`}
                            </p>
                            {receipt.orderId && (
                                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border border-border/60 text-[10px] font-semibold tabular-nums tracking-wide text-foreground/80">
                                    <span className="text-muted-foreground">Order</span>
                                    <span>{receipt.orderId}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/60 bg-background">
                            <div className="min-w-0">
                                <h2 className="text-base font-bold truncate">
                                    {voided ? "Voided order" : "Completed order"}
                                </h2>
                                {receipt.orderId && (
                                    <p className="text-[11px] text-muted-foreground tabular-nums truncate">
                                        {receipt.orderId}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                    )}

                    {/* RECEIPT PAPER */}
                    <div className="flex-1 overflow-y-auto px-4 py-5">
                        <div
                            data-print-area
                            className="mx-auto max-w-[340px] bg-white rounded-2xl shadow-sm border border-border/60 overflow-hidden"
                        >
                            <ReceiptDocument mode="receipt" {...receipt} />
                        </div>
                        {viewMode === "view" && voided && (
                            <p className="text-center text-[11px] text-destructive font-semibold mt-4 uppercase tracking-wider">
                                This order has been voided
                            </p>
                        )}
                    </div>

                    {/* ACTIONS */}
                    <SheetFooter className="py-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                className="h-12 font-semibold gap-2"
                                onClick={handleShare}
                            >
                                <Share2 className="w-4 h-4" />
                                Share
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 font-semibold gap-2"
                                onClick={() => printReceipt()}
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </Button>
                        </div>
                        {viewMode === "success" ? (
                            <Button
                                className="w-full h-14 font-semibold gap-2"
                                onClick={onClose}
                            >
                                <Plus className="w-5 h-5" />
                                New Order
                            </Button>
                        ) : !voided && onVoid ? (
                            <Button
                                variant="outline"
                                className="w-full h-14 font-semibold gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                                onClick={onVoid}
                            >
                                <Ban className="w-5 h-5" />
                                Void Order
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full h-14 font-semibold"
                                onClick={onClose}
                            >
                                Close
                            </Button>
                        )}
                    </SheetFooter>
                </div>
            )}
        </BaseSheet>
    );
};

export default PaymentSuccessSheet;

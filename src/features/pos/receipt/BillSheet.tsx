import { Printer, Share2, FileText } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
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
}

const BillSheet = ({ open, isOpening, isClosing, onClose, ...receipt }: Props) => {
    if (!open && !isClosing) return null;

    const handleShare = () => {
        const name = receipt.orderId ? `bill-${receipt.orderId}.png` : "bill.png";
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
            {({ onDragStart, onDragMove, onDragEnd }) => (
                <div className="flex flex-col h-full overflow-hidden">
                    <SheetHeader
                        title="Bill Preview"
                        subtitle="Pre-payment · share or print for customer"
                        meta={receipt.orderId ? `Order ${receipt.orderId}` : undefined}
                        onClose={onClose}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                    />

                    <div className="flex-1 overflow-y-auto px-4 py-5">
                        <div
                            data-print-area
                            className="mx-auto max-w-[340px] bg-white rounded-2xl shadow-sm border border-border/60 overflow-hidden"
                        >
                            <ReceiptDocument mode="bill" {...receipt} />
                        </div>

                        <p className="text-center text-[11px] text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                            <FileText className="w-3 h-3" />
                            Bill is not a tax receipt
                        </p>
                    </div>

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
                        <Button
                            className="w-full h-14 font-semibold"
                            onClick={onClose}
                        >
                            Back
                        </Button>
                    </SheetFooter>
                </div>
            )}
        </BaseSheet>
    );
};

export default BillSheet;

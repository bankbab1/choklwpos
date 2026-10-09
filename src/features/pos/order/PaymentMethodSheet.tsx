import { useState } from "react";
import { Banknote, QrCode, Check } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaymentMethod = "cash" | "qr";

interface Props {
    open: boolean;
    isOpening?: boolean;
    isClosing?: boolean;
    total: number;
    onClose: () => void;
    onConfirm: (method: PaymentMethod) => void;
}

const METHODS: {
    id: PaymentMethod;
    label: string;
    desc: string;
    icon: typeof Banknote;
    tint: string;
}[] = [
        {
            id: "cash",
            label: "Cash",
            desc: "Pay with cash at counter",
            icon: Banknote,
            tint: "bg-green-100 text-green-600",
        },
        {
            id: "qr",
            label: "QR Payment",
            desc: "PromptPay / Mobile banking",
            icon: QrCode,
            tint: "bg-blue-100 text-blue-600",
        },
    ];

const PaymentMethodSheet = ({
    open,
    isOpening,
    isClosing,
    total,
    onClose,
    onConfirm,
}: Props) => {
    const [selected, setSelected] = useState<PaymentMethod | null>(null);

    if (!open && !isClosing) return null;

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
                        title="Select Payment"
                        subtitle={`Total ฿${total.toFixed(2)}`}
                        onClose={onClose}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                    />

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                        {METHODS.map((m) => {
                            const Icon = m.icon;
                            const isActive = selected === m.id;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setSelected(m.id)}
                                    className={cn(
                                        "w-full rounded-2xl border px-4 py-4 flex items-center gap-3 transition-all active:scale-[0.99]",
                                        isActive
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-border/60 bg-muted/30 hover:bg-muted/50",
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                                            m.tint,
                                        )}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-semibold leading-tight">
                                            {m.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {m.desc}
                                        </p>
                                    </div>
                                    <div
                                        className={cn(
                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                            isActive
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border",
                                        )}
                                    >
                                        {isActive && <Check className="w-3 h-3" strokeWidth={3} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <SheetFooter className="py-3">
                        <Button
                            className="w-full h-14 font-semibold"
                            disabled={!selected}
                            onClick={() => selected && onConfirm(selected)}
                        >
                            {selected
                                ? `Pay ฿${total.toFixed(2)} with ${selected === "cash" ? "Cash" : "QR"
                                }`
                                : "Select a payment method"}
                        </Button>
                    </SheetFooter>
                </div>
            )}
        </BaseSheet>
    );
};

export default PaymentMethodSheet;

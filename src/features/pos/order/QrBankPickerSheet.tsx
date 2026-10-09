import { useEffect, useMemo, useState } from "react";
import { Check, Landmark, QrCode } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BANK_META, BankAccount, isAccountForStore, useBankAccounts } from "@/features/pos/bank/BankAccountsProvider";

interface Props {
    open: boolean;
    isOpening?: boolean;
    isClosing?: boolean;
    total: number;
    /** Only show accounts scoped to this branch (empty scope = all branches). */
    storeId?: string;
    onClose: () => void;
    onConfirm: (account: BankAccount) => void;
}

const maskRef = (ref: string) => {
    if (!ref) return "";
    if (ref.length <= 4) return ref;
    return `••• ${ref.slice(-4)}`;
};

const QrBankPickerSheet = ({ open, isOpening, isClosing, total, storeId, onClose, onConfirm }: Props) => {
    const { accounts, defaultId } = useBankAccounts();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const eligible = useMemo(
        () =>
            accounts.filter(
                (a) =>
                    a.enabled &&
                    !!a.bank &&
                    !!a.type &&
                    a.ref.trim().length > 0 &&
                    (!storeId || isAccountForStore(a, storeId)),
            ),
        [accounts, storeId],
    );

    // Auto-preselect the default account (if eligible), otherwise first eligible
    useEffect(() => {
        if (open) {
            setSelectedId((prev) => {
                if (prev) return prev;
                const defaultEligible = eligible.find((a) => a.id === defaultId);
                return defaultEligible?.id ?? eligible[0]?.id ?? null;
            });
        } else {
            setSelectedId(null);
        }
    }, [open, eligible, defaultId]);

    if (!open && !isClosing) return null;

    const selected = eligible.find((a) => a.id === selectedId) ?? null;

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
                        title="Receive with QR"
                        subtitle={`Total ฿${total.toFixed(2)} · Choose receiving account`}
                        onClose={onClose}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                    />

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                        {eligible.length === 0 && (
                            <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
                                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                                    <Landmark className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">No active bank accounts</p>
                                    <p className="text-xs text-muted-foreground max-w-[260px]">
                                        Add and enable a bank account in Settings → Bank Account first.
                                    </p>
                                </div>
                            </div>
                        )}

                        {eligible.map((acc) => {
                            const isActive = selectedId === acc.id;
                            const meta = acc.bank ? BANK_META[acc.bank] : null;
                            return (
                                <button
                                    key={acc.id}
                                    onClick={() => setSelectedId(acc.id)}
                                    className={cn(
                                        "w-full rounded-2xl border px-4 py-3.5 flex items-center gap-3 transition-all active:scale-[0.99] text-left",
                                        isActive
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-border/60 bg-muted/30 hover:bg-muted/50",
                                    )}
                                >
                                    {meta ? (
                                        <div
                                            className={cn(
                                                "w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm",
                                                meta.color,
                                            )}
                                        >
                                            {meta.short}
                                        </div>
                                    ) : (
                                        <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                            <QrCode className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold leading-tight truncate">
                                            {acc.name || "Untitled account"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                            {meta ? `${meta.name} · ${maskRef(acc.ref)}` : maskRef(acc.ref)}
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
                                ? `Generate QR · ฿${total.toFixed(2)}`
                                : "Select a bank account"}
                        </Button>
                    </SheetFooter>
                </div>
            )}
        </BaseSheet>
    );
};

export default QrBankPickerSheet;

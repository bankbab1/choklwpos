import { createContext, useContext, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    icon?: React.ReactNode;
    onConfirm?: () => void;
};

const ConfirmContext = createContext<(opts: ConfirmOptions) => void>(() => { });

export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [visible, setVisible] = useState(false);

    const confirm = (opts: ConfirmOptions) => {
        setOptions(opts);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setVisible(true));
        });
    };

    const close = () => {
        setVisible(false);
        setTimeout(() => setOptions(null), 300);
    };

    useEffect(() => {
        if (options) {
            document.body.style.overflow = "hidden";
            return () => { document.body.style.overflow = ""; };
        }
    }, [options]);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}

            {options && (
                <div className="fixed inset-0 z-[999] flex flex-col justify-end">
                    {/* Overlay */}
                    <div
                        className={cn(
                            "absolute inset-0 bg-black/40 transition-opacity duration-300",
                            visible ? "opacity-100" : "opacity-0"
                        )}
                        onClick={close}
                    />

                    {/* Bottom sheet dialog */}
                    <div
                        className={cn(
                            "relative z-10 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            visible ? "translate-y-0" : "translate-y-full"
                        )}
                    >
                        {/* Card */}
                        <div className="bg-card rounded-2xl overflow-hidden shadow-xl">
                            {/* Content */}
                            <div className="px-5 pt-5 pb-4">
                                <h3 className="text-lg font-bold text-foreground">
                                    {options.title}
                                </h3>
                                {options.description && (
                                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                        {options.description}
                                    </p>
                                )}
                            </div>

                            {/* Confirm button */}
                            <div className="px-4 pb-3">
                                <button
                                    className={cn(
                                        "w-full h-12 rounded-xl text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-colors",
                                        options.variant === "destructive"
                                            ? "bg-destructive active:bg-destructive/80"
                                            : "bg-primary active:bg-primary/80"
                                    )}
                                    onClick={() => {
                                        options.onConfirm?.();
                                        close();
                                    }}
                                >
                                    {options.icon}
                                    {options.confirmText || "Confirm"}
                                </button>
                            </div>

                            {/* Cancel button */}
                            <div className="px-4 pb-4">
                                <button
                                    className="w-full h-12 rounded-xl text-[15px] font-semibold text-foreground border border-border bg-muted/50 transition-colors active:bg-muted"
                                    onClick={close}
                                >
                                    {options.cancelText || "Cancel"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

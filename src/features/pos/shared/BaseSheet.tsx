import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";


interface BaseSheetProps {
    open: boolean;
    isOpening: boolean;
    isClosing?: boolean;
    onClose: () => void;
    children: (handlers: {
        onDragStart: (e: React.TouchEvent | React.MouseEvent) => void;
        onDragMove: (e: TouchEvent | MouseEvent) => void;
        onDragEnd: () => void;
    }) => React.ReactNode;
    className?: string;
    showOverlay?: boolean;
    variant?: "sheet" | "full";
}

export const BaseSheet = ({
    open,
    isOpening,
    isClosing,
    onClose,
    children,
    className,
    showOverlay = true,
    variant = "sheet",
}: BaseSheetProps) => {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [interactable, setInteractable] = useState(false);

    // Block pointer events briefly after opening to prevent ghost taps
    useEffect(() => {
        if (open && !isClosing) {
            setInteractable(false);
            const t = setTimeout(() => setInteractable(true), 350);
            return () => clearTimeout(t);
        } else {
            setInteractable(false);
        }
    }, [open, isClosing]);

    // =========================
    // 🧠 DRAG STATE
    // =========================
    let startY = 0;
    let currentY = 0;
    let dragging = false;

    const onDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        dragging = true;
        startY =
            "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        document.addEventListener("mousemove", onDragMove as any);
        document.addEventListener("mouseup", onDragEnd);
        document.addEventListener("touchmove", onDragMove as any);
        document.addEventListener("touchend", onDragEnd);
    };

    const onDragMove = (e: TouchEvent | MouseEvent) => {
        if (!dragging || !sheetRef.current) return;

        currentY =
            "touches" in e
                ? (e as TouchEvent).touches[0].clientY
                : (e as MouseEvent).clientY;

        const delta = currentY - startY;

        if (delta > 0) {
            const resistance = delta * 0.6; // ✅ smoother drag
            sheetRef.current.style.transform = `translateY(${resistance}px)`;
        }
    };

    const onDragEnd = () => {
        if (!sheetRef.current) return;

        const delta = currentY - startY;

        dragging = false;

        document.removeEventListener("mousemove", onDragMove as any);
        document.removeEventListener("mouseup", onDragEnd);
        document.removeEventListener("touchmove", onDragMove as any);
        document.removeEventListener("touchend", onDragEnd);

        if (delta > 120) {
            onClose();
        } else {
            // ✅ smooth snap back
            sheetRef.current.style.transition =
                "transform 0.25s cubic-bezier(0.22,1,0.36,1)";
            sheetRef.current.style.transform = "";
        }
        setTimeout(() => {
            if (sheetRef.current) {
                sheetRef.current.style.transition = "";
            }
        }, 250);

    };

    if (!open && !isClosing) return null;


    const translateClass = isClosing
        ? "translate-y-[calc(100%+64px)]"
        : isOpening
            ? "translate-y-[calc(100%+64px)]"
            : "translate-y-0";

    const isFull = variant === "full";
    return createPortal(

        <>
            {/* Overlay */}
            {showOverlay && (
                <div
                    className={cn(
                        "fixed inset-0 z-40 transition-all duration-300 backdrop-blur-sm",
                        "bg-background/80", // ✅ softer
                        open && !isClosing
                            ? "opacity-100 backdrop-blur-sm"
                            : "opacity-0 backdrop-blur-0"
                    )}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClose();
                    }}
                    onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClose();
                    }}
                />
            )}

            {/* Sheet */}
            <div
                ref={sheetRef}
                className={cn(
                    `
    fixed z-50
    flex flex-col
    bg-background
    transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform
    pb-[env(safe-area-inset-bottom)]
    `,
                    isFull
                        ? "inset-0" // ✅ full screen
                        : "inset-x-0 bottom-0 max-h-[100dvh] rounded-t-2xl", // ✅ normal sheet
                    !interactable && "pointer-events-none", // 🔥 block ghost taps during open
                    translateClass,
                    className
                )}
            >
                {/* 👇 IMPORTANT: layout container */}
                <div className="flex flex-col h-full overflow-hidden">
                    {children({
                        onDragStart,
                        onDragMove,
                        onDragEnd,
                    })}
                </div>
            </div>
        </>,
        document.body
    );

};
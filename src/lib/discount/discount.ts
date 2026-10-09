// =========================
// TYPES
// =========================

export type InputMode = "amount" | "percent" | "target";
export type DiscountScope = "unit" | "line";

export type AppliedDiscount = {
    type: "amount" | "percent";
    value: number;
};

export type ComputeDiscountResult =
    | { valid: false; reason: "min" | "max" | "invalid" }
    | {
        valid: true;
        appliedDiscount?: AppliedDiscount;
        lineTarget?: number;
    };

export function isInvalidResult(
    result: ComputeDiscountResult
): result is { valid: false; reason: "min" | "max" | "invalid" } {
    return result.valid === false;
}

// =========================
// CONSTANTS
// =========================

export const MIN_PERCENT = 1;
export const MAX_PERCENT = 99;

// =========================
// HELPERS
// =========================

export const round2 = (n: number) => Number(n.toFixed(2));

// =========================
// MAX CALCULATION
// =========================

export const getMaxDiscount = ({
    inputMode,
    discountScope,
    unitPrice,
    qty,
}: {
    inputMode: InputMode;
    discountScope: DiscountScope;
    unitPrice: number;
    qty: number;
}) => {
    if (inputMode === "percent") return MAX_PERCENT;

    if (inputMode === "amount") {
        return discountScope === "unit"
            ? Math.max(0, unitPrice - 0.01)
            : Math.max(0, unitPrice * qty - 0.01);
    }

    if (inputMode === "target") {
        return discountScope === "unit"
            ? unitPrice
            : unitPrice * qty;
    }

    return 0;
};

// =========================
// CORE ENGINE
// =========================

export const computeDiscount = ({
    inputMode,
    discountScope,
    value,
    unitPrice,
    qty,
    minPercent,
}: {
    inputMode: InputMode;
    discountScope: DiscountScope;
    value: number;
    unitPrice: number;
    qty: number;
    minPercent: number;
}): ComputeDiscountResult => {
    // =========================
    // VALIDATION
    // =========================

    if (isNaN(value)) return { valid: false, reason: "invalid" };

    // MIN VALIDATION
    if (inputMode === "percent" && value < minPercent) {
        return { valid: false, reason: "min" };
    }

    if (inputMode !== "percent" && value <= 0) {
        return { valid: false, reason: "min" };
    }

    const max = getMaxDiscount({
        inputMode,
        discountScope,
        unitPrice,
        qty,
    });

    // MAX VALIDATION
    if (
        (inputMode === "target" && value >= max) ||
        (inputMode !== "target" && value > max)
    ) {
        return { valid: false, reason: "max" };
    }

    // =========================
    // APPLY LOGIC
    // =========================

    // 🔵 PERCENT
    if (inputMode === "percent") {
        return {
            valid: true,
            appliedDiscount: {
                type: "percent",
                value,
            },
        };
    }

    // 💰 AMOUNT
    if (inputMode === "amount") {
        if (discountScope === "unit") {
            return {
                valid: true,
                appliedDiscount: {
                    type: "amount",
                    value: round2(value),
                },
            };
        }

        const unit = qty > 0 ? value / qty : 0;

        return {
            valid: true,
            appliedDiscount: {
                type: "amount",
                value: round2(unit),
            },
        };
    }

    // 🎯 TARGET
    if (inputMode === "target") {
        if (discountScope === "unit") {
            const discount = round2(unitPrice - value);

            return {
                valid: true,
                appliedDiscount: {
                    type: "amount",
                    value: discount,
                },
            };
        }

        // 🔥 LINE TARGET
        return {
            valid: true,
            lineTarget: round2(value),
        };
    }

    return { valid: false, reason: "invalid" };
};
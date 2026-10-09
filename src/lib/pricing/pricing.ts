import { CartItem } from "@/data/products";
const round2 = (n: number) => Math.round(n * 100) / 100;

export const getUnitPrice = (item: CartItem) => {
  return round2((item.basePrice ?? 0) + (item.optionPrice ?? 0));
};

export const getUnitDiscount = (item: CartItem) => {
  const unitPrice = getUnitPrice(item);
  const discountValue = item.discountValue || 0;

  if (!item.discountType) return 0;

  if (item.discountType === "percent") {
    return round2(Math.min(unitPrice, unitPrice * (discountValue / 100)));
  }

  return round2(Math.min(unitPrice, discountValue));
};

export const getFinalUnitPrice = (item: CartItem) => {
  if (item.isFree) return 0;

  if (item.lineTarget != null && item.quantity > 0) {
    return round2(item.lineTarget / item.quantity);
  }

  const unitPrice = getUnitPrice(item);
  const unitDiscount = getUnitDiscount(item);

  return round2(Math.max(0, unitPrice - unitDiscount));
};

export const getLineTotal = (item: CartItem) => {
  if (item.isFree) return 0;

  if (item.lineTarget != null) {
    return Math.max(0, item.lineTarget);
  }

  return round2(getFinalUnitPrice(item) * item.quantity);
};

export const getOriginalLineTotal = (item: CartItem) => {
  return round2(getUnitPrice(item) * item.quantity);
};

export const getCartTotal = (items: CartItem[]) => {
  return round2(items.reduce((sum, item) => sum + getLineTotal(item), 0));
};

export const normalizeItemAfterQtyChange = (item: CartItem): CartItem => {
  if (
    item.discountScope === "line" &&
    item.inputMode === "target" &&
    item.lineTarget != null
  ) {
    const original = getOriginalLineTotal(item);

    if (item.lineTarget >= original) {
      return {
        ...item,
        lineTarget: null,
        discountType: null,
        discountValue: 0,
        inputMode: "amount", // or null
      };
    }
  }

  return item;
};

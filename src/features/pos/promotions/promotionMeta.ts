import {
  Gift,
  ShoppingBag,
  Receipt,
  Hash,
  Clock,
  LucideIcon,
} from "lucide-react";
import type { Product } from "@/data/products";
import { formatTHB } from "@/lib/pricing/currency";
import type { Promotion, PromoType } from "./PromotionsProvider";

export const PROMO_TYPE_META: Record<
  PromoType,
  { label: string; icon: LucideIcon; tint: string }
> = {
  normal: { label: "Normal Reward", icon: Gift, tint: "text-primary" },
  buy_get: { label: "Buy A Get Reward", icon: ShoppingBag, tint: "text-primary" },
  bill_amount: { label: "Bill Amount", icon: Receipt, tint: "text-primary" },
  first_n: { label: "First XX Orders", icon: Hash, tint: "text-primary" },
  time_period: { label: "Time Period", icon: Clock, tint: "text-primary" },
};

export const PROMO_TYPE_ORDER: PromoType[] = [
  "normal",
  "buy_get",
  "bill_amount",
  "first_n",
  "time_period",
];

const productName = (products: Product[], id?: string) =>
  id ? products.find((p) => p.id === id)?.name ?? "Item" : "Item";

export function summarizeReward(promo: Promotion, products: Product[]): string {
  if (promo.rewardType === "discount") {
    if (promo.reward.discountPercent != null && promo.reward.discountPercent > 0)
      return `${promo.reward.discountPercent}% off`;
    if (promo.reward.discountFixed != null && promo.reward.discountFixed > 0)
      return `${formatTHB(promo.reward.discountFixed)} off`;
    return "Discount";
  }
  if (promo.rewardType === "free_item") {
    const name = productName(products, promo.reward.freeItemId);
    return `Free ${name} × ${promo.reward.freeQty ?? 1}`;
  }
  return "No reward";
}

export function summarizeCondition(
  promo: Promotion,
  products: Product[],
): string {
  switch (promo.promoType) {
    case "normal":
      return "Always";
    case "buy_get": {
      const name = productName(products, promo.conditions.buyItemId);
      return `Buy ${promo.conditions.buyQty ?? 1} × ${name}`;
    }
    case "bill_amount": {
      const min = promo.conditions.minBill;
      const max = promo.conditions.maxBill;
      if (min && max) return `Bill ${formatTHB(min)} – ${formatTHB(max)}`;
      if (min) return `Bill ≥ ${formatTHB(min)}`;
      if (max) return `Bill ≤ ${formatTHB(max)}`;
      return "Bill amount";
    }
    case "first_n":
      return `First ${promo.conditions.orderQuota ?? 0} orders`;
    case "time_period":
      return `${promo.conditions.startTime || "--:--"} – ${
        promo.conditions.endTime || "--:--"
      }`;
  }
}

export function summarizeSchedule(promo: Promotion): string {
  const d = promo.schedule.days ?? [];
  const everyDay = d.length === 7;
  const dayStr = everyDay
    ? "Every day"
    : d.length === 0
      ? "No days"
      : d.join(", ");
  const range =
    promo.schedule.startDate && promo.schedule.endDate
      ? ` · ${promo.schedule.startDate} → ${promo.schedule.endDate}`
      : "";
  return dayStr + range;
}

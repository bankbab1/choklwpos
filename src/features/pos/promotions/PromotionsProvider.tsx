import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type PromoType =
  | "normal"
  | "buy_get"
  | "bill_amount"
  | "first_n"
  | "time_period";

export type RewardType = "discount" | "free_item";

export type Weekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

export const ALL_WEEKDAYS: Weekday[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

export type QuotaPeriod = "lifetime" | "daily";

export interface PromotionConditions {
  buyItemId?: string;
  buyQty?: number;
  minBill?: number;
  maxBill?: number;
  orderQuota?: number;
  quotaPeriod?: QuotaPeriod; // for first_n; default lifetime
  startTime?: string; // HH:mm
  endTime?: string;
}

export interface PromotionReward {
  discountPercent?: number;
  discountFixed?: number;
  freeItemId?: string;
  freeQty?: number;
}

export interface PromotionSchedule {
  days: Weekday[];
  startDate?: string;
  endDate?: string;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  promoType: PromoType;
  rewardType: RewardType | null;
  isActive: boolean;
  conditions: PromotionConditions;
  reward: PromotionReward;
  schedule: PromotionSchedule;
  displayOrder: number;
}

export interface PromoUsage {
  lifetime: number;
  daily: Record<string, number>; // yyyy-mm-dd -> count
  lastAppliedAt?: number;
}

export type PromoState =
  | "inactive"
  | "scheduled"
  | "expired"
  | "off_day"
  | "out_of_hours"
  | "quota_full"
  | "active";

export interface PromoStatus {
  state: PromoState;
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
  used: number;
  quota: number | null;
  period: QuotaPeriod | null;
  remaining: number | null;
}

const STORAGE_KEY = "pos.promotions.v1";
const USAGE_KEY = "pos.promotions.usage.v1";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `promo_${Math.random().toString(36).slice(2)}_${Date.now()}`;

const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const WEEKDAY_MAP: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const createEmptyPromotion = (displayOrder: number): Promotion => ({
  id: uid(),
  name: "",
  description: "",
  promoType: "normal",
  rewardType: "discount",
  isActive: true,
  conditions: {},
  reward: {},
  schedule: { days: [...ALL_WEEKDAYS] },
  displayOrder,
});

const seedPromotions = (): Promotion[] => [
  {
    id: uid(),
    name: "10% Member Discount",
    description: "Flat discount for all members.",
    promoType: "normal",
    rewardType: "discount",
    isActive: true,
    conditions: {},
    reward: { discountPercent: 10 },
    schedule: { days: [...ALL_WEEKDAYS] },
    displayOrder: 1,
  },
  {
    id: uid(),
    name: "Bill ≥ 500 get ฿50 off",
    description: "Spend 500 THB or more.",
    promoType: "bill_amount",
    rewardType: "discount",
    isActive: true,
    conditions: { minBill: 500 },
    reward: { discountFixed: 50 },
    schedule: { days: [...ALL_WEEKDAYS] },
    displayOrder: 2,
  },
  {
    id: uid(),
    name: "Happy Hour 15:00–17:00",
    description: "20% off during happy hour.",
    promoType: "time_period",
    rewardType: "discount",
    isActive: false,
    conditions: { startTime: "15:00", endTime: "17:00" },
    reward: { discountPercent: 20 },
    schedule: { days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    displayOrder: 3,
  },
];

// ─── Status helpers ────────────────────────────────────────────
export function getPromoUsageCount(
  usage: PromoUsage | undefined,
  period: QuotaPeriod,
  now: Date,
): number {
  if (!usage) return 0;
  if (period === "lifetime") return usage.lifetime ?? 0;
  return usage.daily?.[dayKey(now)] ?? 0;
}

export function getPromoStatus(
  promo: Promotion,
  usage: PromoUsage | undefined,
  now: Date = new Date(),
): PromoStatus {
  const quota = promo.conditions.orderQuota ?? null;
  const period: QuotaPeriod | null =
    promo.promoType === "first_n"
      ? promo.conditions.quotaPeriod ?? "lifetime"
      : null;
  const used = period ? getPromoUsageCount(usage, period, now) : 0;
  const remaining = quota != null && period ? Math.max(0, quota - used) : null;

  const base = { used, quota, period, remaining };

  if (!promo.isActive)
    return { ...base, state: "inactive", label: "Disabled", tone: "neutral" };

  // Date range
  const todayKey = dayKey(now);
  if (promo.schedule.startDate && todayKey < promo.schedule.startDate)
    return { ...base, state: "scheduled", label: "Scheduled", tone: "neutral" };
  if (promo.schedule.endDate && todayKey > promo.schedule.endDate)
    return { ...base, state: "expired", label: "Expired", tone: "neutral" };

  // Weekday
  const todayWeekday = WEEKDAY_MAP[now.getDay()];
  if (
    promo.schedule.days.length > 0 &&
    !promo.schedule.days.includes(todayWeekday)
  )
    return { ...base, state: "off_day", label: "Off today", tone: "neutral" };

  // Time window (time_period)
  if (promo.promoType === "time_period") {
    const { startTime, endTime } = promo.conditions;
    if (startTime && endTime) {
      const cur = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;
      const inWindow =
        startTime <= endTime
          ? cur >= startTime && cur <= endTime
          : cur >= startTime || cur <= endTime;
      if (!inWindow)
        return {
          ...base,
          state: "out_of_hours",
          label: "Out of hours",
          tone: "neutral",
        };
    }
  }

  // Quota
  if (quota != null && period && used >= quota)
    return { ...base, state: "quota_full", label: "Quota full", tone: "danger" };

  return { ...base, state: "active", label: "Active", tone: "success" };
}

interface Ctx {
  promotions: Promotion[];
  usage: Record<string, PromoUsage>;
  addPromotion: () => Promotion;
  updatePromotion: (p: Promotion) => void;
  removePromotion: (id: string) => void;
  togglePromotionActive: (id: string) => void;
  reorderPromotions: (orderedIds: string[]) => void;
  recordPromoUsage: (id: string) => void;
  resetPromoUsage: (id: string) => void;
  getStatus: (p: Promotion, now?: Date) => PromoStatus;
}

const PromotionsContext = createContext<Ctx | null>(null);

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const [promotions, setPromotions] = useState<Promotion[]>(() => {
    if (typeof window === "undefined") return seedPromotions();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedPromotions();
      const parsed = JSON.parse(raw) as Promotion[];
      if (!Array.isArray(parsed)) return seedPromotions();
      return parsed;
    } catch {
      return seedPromotions();
    }
  });

  const [usage, setUsage] = useState<Record<string, PromoUsage>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(promotions));
    } catch {
      /* ignore */
    }
  }, [promotions]);

  useEffect(() => {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    } catch {
      /* ignore */
    }
  }, [usage]);

  const addPromotion = useCallback(() => {
    let created: Promotion;
    setPromotions((prev) => {
      const next = createEmptyPromotion(
        prev.length === 0
          ? 1
          : Math.max(...prev.map((p) => p.displayOrder ?? 0)) + 1,
      );
      created = next;
      return [...prev, next];
    });
    return created!;
  }, []);

  const updatePromotion = useCallback((p: Promotion) => {
    setPromotions((prev) => prev.map((x) => (x.id === p.id ? p : x)));
  }, []);

  const removePromotion = useCallback((id: string) => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    setUsage((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const togglePromotionActive = useCallback((id: string) => {
    setPromotions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p)),
    );
  }, []);

  const reorderPromotions = useCallback((orderedIds: string[]) => {
    setPromotions((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      const next: Promotion[] = [];
      orderedIds.forEach((id) => {
        const p = map.get(id);
        if (p) {
          next.push(p);
          map.delete(id);
        }
      });
      map.forEach((p) => next.push(p));
      return next.map((p, idx) => ({ ...p, displayOrder: idx + 1 }));
    });
  }, []);

  const recordPromoUsage = useCallback((id: string) => {
    setUsage((prev) => {
      const cur = prev[id] ?? { lifetime: 0, daily: {} };
      const k = dayKey(new Date());
      return {
        ...prev,
        [id]: {
          lifetime: (cur.lifetime ?? 0) + 1,
          daily: { ...cur.daily, [k]: (cur.daily?.[k] ?? 0) + 1 },
          lastAppliedAt: Date.now(),
        },
      };
    });
  }, []);

  const resetPromoUsage = useCallback((id: string) => {
    setUsage((prev) => ({ ...prev, [id]: { lifetime: 0, daily: {} } }));
  }, []);

  const getStatus = useCallback(
    (p: Promotion, now?: Date) => getPromoStatus(p, usage[p.id], now),
    [usage],
  );

  const value = useMemo(
    () => ({
      promotions,
      usage,
      addPromotion,
      updatePromotion,
      removePromotion,
      togglePromotionActive,
      reorderPromotions,
      recordPromoUsage,
      resetPromoUsage,
      getStatus,
    }),
    [
      promotions,
      usage,
      addPromotion,
      updatePromotion,
      removePromotion,
      togglePromotionActive,
      reorderPromotions,
      recordPromoUsage,
      resetPromoUsage,
      getStatus,
    ],
  );

  return (
    <PromotionsContext.Provider value={value}>
      {children}
    </PromotionsContext.Provider>
  );
}

export function usePromotions() {
  const ctx = useContext(PromotionsContext);
  if (!ctx)
    throw new Error("usePromotions must be used inside PromotionsProvider");
  return ctx;
}

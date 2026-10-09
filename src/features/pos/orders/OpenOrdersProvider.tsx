import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { CartItem } from "@/data/products";
import { ReferenceType } from "@/lib/businessType";
import { generateOrderId } from "@/lib/orderId/orderId";
import type { ReceiptPayment } from "@/features/pos/receipt/ReceiptDocument";
import { getLineTotal } from "@/lib/pricing/pricing";
import type { OrderService } from "@/features/pos/tables/TablesProvider";

export type OpenOrderStatus = "open" | "hold" | "cancelled" | "voided" | "completed";

export interface OpenOrder {
  id: string;
  items: CartItem[];
  reference?: { type: ReferenceType; value: string };
  /** Dine-in / takeaway, table and guest count. */
  service?: OrderService;
  status: OpenOrderStatus;
  /** Branch this order belongs to ( stamped at creation, never changes ). */
  storeId?: string;
  createdAt: number;
  updatedAt: number;
  // Completed-order snapshot
  payment?: ReceiptPayment;
  paidAt?: number;
  orderDiscount?: number;
  total?: number;
  // Reversal/return tracking
  /** If set, this order is a reversal of another order id. */
  reversalOf?: string;
  /** Map of cartItem.id -> qty already returned from this completed order. */
  returnedQty?: Record<string, number>;
  /** True when this is a full or partial reversal entry (total is negative). */
  isReversal?: boolean;
}

interface UpsertInput {
  id?: string;
  items: CartItem[];
  reference?: OpenOrder["reference"];
  service?: OrderService;
  status?: OpenOrderStatus;
  /** Branch to stamp on newly created orders. Ignored on updates. */
  storeId?: string;
  /** Branch token used when minting a new order id. */
  branch?: string;
}

interface CompleteInput {
  id?: string;
  items: CartItem[];
  reference?: OpenOrder["reference"];
  service?: OrderService;
  payment: ReceiptPayment;
  orderDiscount?: number;
  total: number;
  /** Branch to stamp on newly created orders. Ignored on updates. */
  storeId?: string;
  /** Branch token used when minting a new order id. */
  branch?: string;
}

export interface ReturnLine {
  itemId: string;
  qty: number;
}

interface Ctx {
  openOrders: OpenOrder[];
  activeOrderId: string | null;
  activeOrder: OpenOrder | null;
  setActiveOrderId: (id: string | null) => void;
  upsertOpenOrder: (input: UpsertInput) => OpenOrder;
  completeOpenOrder: (input: CompleteInput) => OpenOrder;
  closeOpenOrder: (id: string) => void;
  cancelOpenOrder: (id: string) => void;
  voidOpenOrder: (id: string) => OpenOrder | null;
  partialVoidOpenOrder: (id: string, lines: ReturnLine[]) => OpenOrder | null;
}

const OpenOrdersContext = createContext<Ctx | null>(null);

const sumLineRefund = (item: CartItem, qty: number) => {
  // Compute the line total at full ordered quantity, then prorate to the
  // returned qty so any line-level discount applies proportionally.
  const lineFinal = getLineTotal(item);
  const perUnit = item.quantity > 0 ? lineFinal / item.quantity : 0;
  return perUnit * qty;
};

export const OpenOrdersProvider = ({ children }: { children: ReactNode }) => {
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const upsertOpenOrder = useCallback(
    (input: UpsertInput): OpenOrder => {
      const now = Date.now();
      let result!: OpenOrder;
      setOpenOrders((prev) => {
        const idx = input.id ? prev.findIndex((o) => o.id === input.id) : -1;
        if (idx >= 0) {
          const updated: OpenOrder = {
            ...prev[idx],
            items: input.items,
            reference: input.reference ?? prev[idx].reference,
            service: input.service ?? prev[idx].service,
            status: input.status ?? prev[idx].status,
            updatedAt: now,
          };
          result = updated;
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        const created: OpenOrder = {
          id: input.id ?? generateOrderId({ branch: input.branch }),
          items: input.items,
          reference: input.reference,
          service: input.service,
          status: input.status ?? "open",
          storeId: input.storeId,
          createdAt: now,
          updatedAt: now,
        };
        result = created;
        return [created, ...prev];
      });
      return result;
    },
    [],
  );

  const completeOpenOrder = useCallback(
    (input: CompleteInput): OpenOrder => {
      const now = Date.now();
      let result!: OpenOrder;
      setOpenOrders((prev) => {
        const idx = input.id ? prev.findIndex((o) => o.id === input.id) : -1;
        if (idx >= 0) {
          const updated: OpenOrder = {
            ...prev[idx],
            items: input.items,
            reference: input.reference ?? prev[idx].reference,
            service: input.service ?? prev[idx].service,
            status: "completed",
            payment: input.payment,
            paidAt: now,
            orderDiscount: input.orderDiscount,
            total: input.total,
            updatedAt: now,
          };
          result = updated;
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        const created: OpenOrder = {
          id: input.id ?? generateOrderId({ branch: input.branch }),
          items: input.items,
          reference: input.reference,
          service: input.service,
          status: "completed",
          storeId: input.storeId,
          payment: input.payment,
          paidAt: now,
          orderDiscount: input.orderDiscount,
          total: input.total,
          createdAt: now,
          updatedAt: now,
        };
        result = created;
        return [created, ...prev];
      });
      setActiveOrderId((curr) => (curr === result.id ? null : curr));
      return result;
    },
    [],
  );

  const closeOpenOrder = useCallback((id: string) => {
    setOpenOrders((prev) => prev.filter((o) => o.id !== id));
    setActiveOrderId((curr) => (curr === id ? null : curr));
  }, []);

  const cancelOpenOrder = useCallback((id: string) => {
    const now = Date.now();
    setOpenOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "cancelled", updatedAt: now } : o)),
    );
    setActiveOrderId((curr) => (curr === id ? null : curr));
  }, []);

  /** Full void: mark parent as voided AND create a linked reversal order with the full negative amount. */
  const voidOpenOrder = useCallback((id: string): OpenOrder | null => {
    const now = Date.now();
    let reversal: OpenOrder | null = null;
    setOpenOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === id);
      if (idx < 0) return prev;
      const parent = prev[idx];
      if (parent.status === "voided") return prev;
      // Build a reversal of remaining (not-yet-returned) items
      const returned = parent.returnedQty ?? {};
      const reversalItems: CartItem[] = parent.items
        .map((it) => {
          const remaining = it.quantity - (returned[it.id] ?? 0);
          return remaining > 0 ? { ...it, quantity: remaining } : null;
        })
        .filter((x): x is CartItem => x !== null);
      const reversalAmount = -reversalItems.reduce(
        (s, it) => s + sumLineRefund(it, it.quantity),
        0,
      );
      reversal = {
        id: generateOrderId(),
        items: reversalItems,
        reference: parent.reference,
        service: parent.service,
        status: "voided",
        createdAt: now,
        updatedAt: now,
        reversalOf: parent.id,
        isReversal: true,
        storeId: parent.storeId,
        total: reversalAmount,
        payment: parent.payment,
        paidAt: now,
      };
      // Mark parent fully returned
      const fullyReturned: Record<string, number> = {};
      for (const it of parent.items) fullyReturned[it.id] = it.quantity;
      const updatedParent: OpenOrder = {
        ...parent,
        status: "voided",
        returnedQty: fullyReturned,
        updatedAt: now,
      };
      const copy = [...prev];
      copy[idx] = updatedParent;
      return [reversal, ...copy];
    });
    setActiveOrderId((curr) => (curr === id ? null : curr));
    return reversal;
  }, []);

  /** Partial void: create linked reversal for selected qty; if it consumes all remaining, parent becomes voided. */
  const partialVoidOpenOrder = useCallback(
    (id: string, lines: ReturnLine[]): OpenOrder | null => {
      const now = Date.now();
      let reversal: OpenOrder | null = null;
      const cleaned = lines.filter((l) => l.qty > 0);
      if (cleaned.length === 0) return null;
      setOpenOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === id);
        if (idx < 0) return prev;
        const parent = prev[idx];
        const prevReturned = parent.returnedQty ?? {};
        const reversalItems: CartItem[] = [];
        const nextReturned: Record<string, number> = { ...prevReturned };
        for (const l of cleaned) {
          const item = parent.items.find((it) => it.id === l.itemId);
          if (!item) continue;
          const already = prevReturned[item.id] ?? 0;
          const maxReturnable = item.quantity - already;
          const qty = Math.min(l.qty, maxReturnable);
          if (qty <= 0) continue;
          reversalItems.push({ ...item, quantity: qty });
          nextReturned[item.id] = already + qty;
        }
        if (reversalItems.length === 0) return prev;

        const reversalAmount = -reversalItems.reduce(
          (s, it) => s + sumLineRefund(it, it.quantity),
          0,
        );
        reversal = {
          id: generateOrderId(),
          items: reversalItems,
          reference: parent.reference,
        service: parent.service,
          status: "voided",
          createdAt: now,
          updatedAt: now,
          reversalOf: parent.id,
          isReversal: true,
          storeId: parent.storeId,
          total: reversalAmount,
          payment: parent.payment,
          paidAt: now,
        };

        // Did we void everything?
        const allReturned = parent.items.every(
          (it) => (nextReturned[it.id] ?? 0) >= it.quantity,
        );
        const updatedParent: OpenOrder = {
          ...parent,
          status: allReturned ? "voided" : "completed",
          returnedQty: nextReturned,
          updatedAt: now,
        };
        const copy = [...prev];
        copy[idx] = updatedParent;
        return [reversal, ...copy];
      });
      return reversal;
    },
    [],
  );

  const activeOrder = useMemo(
    () => openOrders.find((o) => o.id === activeOrderId) ?? null,
    [openOrders, activeOrderId],
  );

  return (
    <OpenOrdersContext.Provider
      value={{
        openOrders,
        activeOrderId,
        activeOrder,
        setActiveOrderId,
        upsertOpenOrder,
        completeOpenOrder,
        closeOpenOrder,
        cancelOpenOrder,
        voidOpenOrder,
        partialVoidOpenOrder,
      }}
    >
      {children}
    </OpenOrdersContext.Provider>
  );
};

export const useOpenOrders = () => {
  const ctx = useContext(OpenOrdersContext);
  if (!ctx)
    throw new Error("useOpenOrders must be used inside OpenOrdersProvider");
  return ctx;
};

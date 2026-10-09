import { serviceLabel, type OrderService } from "@/features/pos/tables/TablesProvider";
import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { Clock, CheckCircle2, PauseCircle, XCircle, Search, CalendarDays, X, ScanLine, UtensilsCrossed } from "lucide-react";
import { useSheetAnimation } from "@/hooks/useSheetAnimation";
import ScanOrderSheet from "./ScanOrderSheet";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatTHB } from "@/lib/pricing/currency";
import { getCartTotal } from "@/lib/pricing/pricing";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { useOpenOrders } from "@/features/pos/orders/OpenOrdersProvider";
import { useActiveStore, storeBranchToken } from "@/features/pos/store/ActiveStoreProvider";
import { useStores } from "@/features/pos/store/StoreProvider";
import { useEffect } from "react";
import { ReferenceType } from "@/lib/businessType";
import { generateOrderId } from "@/lib/orderId/orderId";

type OrderStatus = "open" | "hold" | "completed" | "cancelled" | "voided";
type DatePreset = "today" | "yesterday" | "week" | "all";

interface Order {
  id: string;
  items: number;
  total: number;
  time: string;
  timestamp: number;
  status: OrderStatus;
  reference?: { type: ReferenceType; value: string };
  service?: OrderService;
  storeId?: string;
}

const now = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Historical (paid / voided) sample data. Open + Hold come live from OpenOrdersProvider.
const mockOrder = (
  seq: number,
  offsetMs: number,
  items: number,
  total: number,
  status: OrderStatus,
  time: string,
): Order => {
  const ts = now - offsetMs;
  return {
    id: generateOrderId({ at: ts, seq }),
    items,
    total,
    time,
    timestamp: ts,
    status,
  };
};

const sampleOrders: Order[] = [
  mockOrder(40, 25 * 60 * 1000,   2, 95.0,  "completed", "25 min ago"),
  mockOrder(39, 38 * 60 * 1000,   4, 227.5, "completed", "38 min ago"),
  mockOrder(38, 1 * HOUR,         1, 45.0,  "voided",    "1 hr ago"),
  mockOrder(37, 1 * DAY,          6, 410.0, "completed", "Yesterday"),
  mockOrder(36, 1 * DAY + HOUR,   2, 88.0,  "completed", "Yesterday"),
  mockOrder(35, 3 * DAY,          3, 132.0, "completed", "3 days ago"),
];

const STATUS_META: Record<OrderStatus, { label: string; icon: typeof Clock; bg: string; fg: string }> = {
  open:      { label: "Open",      icon: Clock,         bg: "bg-primary/15",     fg: "text-primary" },
  hold:      { label: "Hold",      icon: PauseCircle,   bg: "bg-amber-500/15",   fg: "text-amber-600" },
  completed: { label: "Completed", icon: CheckCircle2,  bg: "bg-success/15",     fg: "text-success" },
  cancelled: { label: "Cancelled", icon: XCircle,       bg: "bg-muted",          fg: "text-muted-foreground" },
  voided:    { label: "Voided",    icon: XCircle,       bg: "bg-destructive/15", fg: "text-destructive" },
};

const STATUS_TABS: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "open",      label: "Open" },
  { key: "hold",      label: "Hold" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "voided",    label: "Voided" },
];


const DATE_TABS: { key: DatePreset; label: string }[] = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week",      label: "This week" },
  { key: "all",       label: "All time" },
];

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const endOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const inPreset = (ts: number, range: DatePreset) => {
  const todayStart = startOfDay(now);
  switch (range) {
    case "today":     return ts >= todayStart;
    case "yesterday": return ts >= todayStart - DAY && ts < todayStart;
    case "week":      return ts >= todayStart - 6 * DAY;
    case "all":       return true;
  }
};

interface OrdersCtx {
  statusFilter: "all" | OrderStatus;
  setStatusFilter: (s: "all" | OrderStatus) => void;
  datePreset: DatePreset | null;
  setDatePreset: (d: DatePreset | null) => void;
  customRange: DateRange | undefined;
  setCustomRange: (r: DateRange | undefined) => void;
  calendarOpen: boolean;
  setCalendarOpen: (o: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (o: boolean | ((v: boolean) => boolean)) => void;
  search: string;
  setSearch: (s: string) => void;
  counts: Record<string, number>;
  filtered: Order[];
  customLabel: string | undefined;
  /** Branches shown in the list. Empty array = all branches. */
  branchFilter: string[];
  setBranchFilter: (ids: string[]) => void;
  /** True when the list may contain more than one branch. */
  multiBranch: boolean;
}

const OrdersContext = createContext<OrdersCtx | null>(null);

export const useOrders = () => {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
};

export const OrdersProvider = ({ children }: { children: ReactNode }) => {
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [datePreset, setDatePreset] = useState<DatePreset | null>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchOpen, setSearchOpenState] = useState(false);
  const [search, setSearch] = useState("");

  const { openOrders: liveOpenOrders } = useOpenOrders();
  const { activeStoreId } = useActiveStore();
  const { stores } = useStores();
  const [branchFilter, setBranchFilter] = useState<string[]>(activeStoreId ? [activeStoreId] : []);
  // Follow the device branch whenever it changes.
  useEffect(() => {
    setBranchFilter(activeStoreId ? [activeStoreId] : []);
  }, [activeStoreId]);
  const multiBranch = branchFilter.length !== 1;
  const matchesBranch = (id?: string) =>
    branchFilter.length === 0 || (id !== undefined && branchFilter.includes(id));

  const setSearchOpen: OrdersCtx["setSearchOpen"] = (o) =>
    setSearchOpenState((prev) => (typeof o === "function" ? o(prev) : o));

  const matchesDate = (ts: number) => {
    if (customRange?.from) {
      const from = startOfDay(customRange.from.getTime());
      const to = endOfDay((customRange.to ?? customRange.from).getTime());
      return ts >= from && ts <= to;
    }
    if (datePreset) return inPreset(ts, datePreset);
    return true;
  };

  const allOrders = useMemo<Order[]>(() => {
    const live: Order[] = liveOpenOrders.map((o) => ({
      id: o.id,
      items: o.items.reduce((s, i) => s + i.quantity, 0),
      total: o.total ?? getCartTotal(o.items),
      time: format(new Date(o.updatedAt), "p"),
      timestamp: o.updatedAt,
      status: o.status,
      reference: o.reference,
      service: o.service,
      storeId: o.storeId ?? stores[0]?.id,
    }));
    // Demo history: spread sample orders across branches.
    const samples = sampleOrders.map((o, i) => {
      const store = stores.length ? stores[i % stores.length] : undefined;
      const token = storeBranchToken(store ?? null);
      return {
        ...o,
        storeId: store?.id,
        id: token ? o.id.replace(/_[A-Z0-9]{1,6}_/, `_${token}_`) : o.id,
      };
    });
    return [...live, ...samples];
  }, [liveOpenOrders, stores]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, open: 0, hold: 0, completed: 0, cancelled: 0, voided: 0 };
    for (const o of allOrders) {
      if (!matchesBranch(o.storeId)) continue;
      if (!matchesDate(o.timestamp)) continue;
      c.all++;
      c[o.status]++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, customRange, allOrders, branchFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOrders.filter((o) => {
      if (!matchesBranch(o.storeId)) return false;
      if (!matchesDate(o.timestamp)) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q && !o.id.toLowerCase().includes(q) && !(o.reference?.value.toLowerCase().includes(q))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, datePreset, customRange, search, allOrders, branchFilter]);

  const customLabel =
    customRange?.from &&
    (customRange.to && customRange.to.getTime() !== customRange.from.getTime()
      ? `${format(customRange.from, "d MMM")} – ${format(customRange.to, "d MMM")}`
      : format(customRange.from, "d MMM yyyy"));

  return (
    <OrdersContext.Provider
      value={{
        statusFilter, setStatusFilter,
        datePreset, setDatePreset,
        customRange, setCustomRange,
        calendarOpen, setCalendarOpen,
        searchOpen, setSearchOpen,
        search, setSearch,
        counts, filtered, customLabel,
        branchFilter, setBranchFilter, multiBranch,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export const OrdersHeader = () => {
  const {
    statusFilter, setStatusFilter,
    datePreset, setDatePreset,
    customRange, setCustomRange,
    calendarOpen, setCalendarOpen,
    search, setSearch,
    counts, customLabel,
  } = useOrders();

  const scanSheet = useSheetAnimation();

  return (
    <>
      {/* Search */}
      <div className="px-4 pb-2 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 flex items-center bg-secondary rounded-xl px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[16px] text-foreground placeholder:text-muted-foreground outline-none pr-8"
          />
          {search.length > 0 && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 active:scale-95 transition"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={scanSheet.openSheet}
          aria-label="Scan receipt"
          className="shrink-0 h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition shadow-sm shadow-primary/20"
        >
          <ScanLine className="h-5 w-5" />
        </button>
      </div>

      <ScanOrderSheet
        open={scanSheet.open}
        isOpening={scanSheet.isOpening}
        isClosing={scanSheet.isClosing}
        onClose={scanSheet.closeSheet}
        onResult={(value) => {
          setSearch(value);
          scanSheet.closeSheet();
        }}
      />

      {/* Status pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3">
        {STATUS_TABS.map((t) => {
          const active = statusFilter === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                "shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-all active:scale-95 flex items-center gap-1.5",
                active
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              <span>{t.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Date pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-1 pb-3">
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-all active:scale-95 flex items-center gap-1.5",
                customRange?.from
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              <CalendarDays className="h-4 w-4" />
              <span>{customLabel ?? "Pick date"}</span>
              {customRange?.from && (
                <X
                  className="h-3.5 w-3.5 ml-0.5 opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomRange(undefined);
                    setDatePreset("today");
                  }}
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(92vw,360px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0 flex flex-col"
            align="start"
            side="bottom"
            sideOffset={8}
            collisionPadding={12}
            avoidCollisions
          >
            {/* Range header */}
            <div className="px-4 pt-4 pb-3 border-b border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Select date range
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-secondary px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">From</p>
                  <p className="text-sm font-semibold text-foreground">
                    {customRange?.from ? format(customRange.from, "d MMM yyyy") : "—"}
                  </p>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex-1 rounded-lg bg-secondary px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">To</p>
                  <p className="text-sm font-semibold text-foreground">
                    {customRange?.to ? format(customRange.to, "d MMM yyyy") : "—"}
                  </p>
                </div>
              </div>
            </div>

            <Calendar
              mode="range"
              selected={customRange}
              onSelect={(r) => {
                setCustomRange(r);
                if (r?.from) setDatePreset(null);
              }}
              numberOfMonths={1}
              initialFocus
              defaultMonth={customRange?.from ?? new Date()}
              className={cn("p-3 w-full pointer-events-auto")}
              classNames={{
                months: "flex flex-col w-full",
                month: "space-y-4 w-full",
                table: "w-full border-collapse",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "flex-1 aspect-square text-center text-sm p-0 relative [&:has([aria-selected].day-range-start)]:rounded-l-md [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-full w-full p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center",
                day_range_start: "day-range-start rounded-l-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                day_range_end: "day-range-end rounded-r-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                day_today:
                  "ring-1 ring-primary/40 text-foreground font-semibold bg-transparent",
              }}
            />

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setCustomRange(undefined);
                  setDatePreset("today");
                }}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground active:scale-95 transition"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={!customRange?.from}
                onClick={() => setCalendarOpen(false)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-semibold transition active:scale-95",
                  customRange?.from
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-secondary text-muted-foreground cursor-not-allowed",
                )}
              >
                Apply
              </button>
            </div>
          </PopoverContent>

        </Popover>

        {DATE_TABS.map((t) => {
          const active = !customRange?.from && datePreset === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setCustomRange(undefined);
                setDatePreset(t.key);
              }}
              className={cn(
                "shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-all active:scale-95",
                active
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </>
  );
};

const dayLabel = (ts: number) => {
  const d = new Date(ts);
  const today = startOfDay(Date.now());
  const dayStart = startOfDay(ts);
  if (dayStart === today) return "Today";
  if (dayStart === today - DAY) return "Yesterday";
  if (d.getFullYear() === new Date().getFullYear()) return format(d, "EEE, d MMM");
  return format(d, "EEE, d MMM yyyy");
};

interface OrdersViewProps {
  onSelectOpen?: (id: string) => void;
  onSelectCompleted?: (id: string) => void;
}

const OrdersView = ({ onSelectOpen, onSelectCompleted }: OrdersViewProps = {}) => {
  const { filtered, multiBranch } = useOrders();
  const { openOrders: liveOpenOrders } = useOpenOrders();
  const { stores } = useStores();
  const branchOf = (id?: string) => storeBranchToken(stores.find((s) => s.id === id) ?? null);
  const liveIds = useMemo(() => new Set(liveOpenOrders.map((o) => o.id)), [liveOpenOrders]);

  const groups = useMemo(() => {
    const map = new Map<number, Order[]>();
    for (const o of filtered) {
      const key = startOfDay(o.timestamp);
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  return (
    <div className="px-4 py-3 pb-24">
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No orders found</p>
        </div>
      ) : (
        groups.map(([dayKey, orders]) => (
          <div key={dayKey} className="mb-4 last:mb-0">
            <div className="flex items-center gap-3 mb-2 mt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {dayLabel(dayKey)}
              </span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] font-medium text-muted-foreground">
                {orders.length} {orders.length === 1 ? "order" : "orders"}
              </span>
            </div>

            <div className="space-y-3">
              {orders.map((order) => {
                const meta = STATUS_META[order.status];
                const Icon = meta.icon;
                const isLive = order.status === "open" || order.status === "hold";
                // Completed/voided that originated live (present in OpenOrdersProvider) are viewable
                const isViewable =
                  (order.status === "completed" || order.status === "voided") &&
                  liveIds.has(order.id);
                const clickable = isLive || isViewable;
                const title = order.reference?.value || order.service?.tableName || order.id;
                const svc = serviceLabel(order.service);
                const handleTap = () => {
                  if (isLive) onSelectOpen?.(order.id);
                  else if (isViewable) onSelectCompleted?.(order.id);
                };
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={handleTap}
                    disabled={!clickable}
                    className={cn(
                      "w-full flex items-center gap-4 rounded-xl bg-card border border-border p-4 text-left transition",
                      clickable && "hover:border-primary/40 active:scale-[0.99] cursor-pointer",
                      !clickable && "cursor-default",
                    )}
                  >
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", meta.bg)}>
                      <Icon className={cn("h-5 w-5", meta.fg)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Row 1: full order number (+ table badge for live dine-in orders) */}
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground break-all leading-snug min-w-0">
                          {title}
                        </p>
                        {isLive && order.service?.tableName && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 px-2 py-0.5 text-[10px] font-semibold">
                            <UtensilsCrossed className="h-3 w-3" />
                            {order.service.tableName}
                            {order.service.guests ? ` · ${order.service.guests}p` : ""}
                          </span>
                        )}
                      </div>
                      {/* Row 2: items · status — time */}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-xs text-muted-foreground truncate">
                          {svc ? <span className="text-foreground/80">{svc} · </span> : null}
                          {order.reference?.value || order.service?.tableName ? (
                            <span className="text-muted-foreground/80">{order.id} · </span>
                          ) : null}
                          {order.items} items · <span className={meta.fg}>{meta.label}</span>
                        </p>
                        <p className="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5">
                          {multiBranch && branchOf(order.storeId) && (
                            <span className="rounded-full bg-primary/10 text-primary px-1.5 py-px text-[10px] font-semibold">
                              {branchOf(order.storeId)}
                            </span>
                          )}
                          {order.time}
                        </p>
                      </div>
                      {/* Row 3: total */}
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums mt-1",
                          order.total < 0 ? "text-destructive" : "text-primary",
                        )}
                      >
                        {order.total < 0
                          ? `-${formatTHB(Math.abs(order.total))}`
                          : formatTHB(order.total)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};


export default OrdersView;

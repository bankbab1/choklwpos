import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useStores } from "@/features/pos/store/StoreProvider";

/** A physical table that belongs to exactly one branch. */
export interface DiningTable {
  id: string;
  storeId: string;
  /** Short display name printed on bills, e.g. "T1", "A3", "Patio 2" (max 12). */
  name: string;
  /** Free-form zone/area for grouping, e.g. "Main", "Patio", "2nd Floor". */
  zone: string;
  /** Seating type within a zone, e.g. "Table", "Bar", "Booth". */
  seatingType: string;
  /** Normal seating capacity. Used as a hint and over-capacity warning. */
  seats: number;
  enabled: boolean;
}

export type ServiceMode = "dine_in" | "takeaway";

/** Service info stamped on an order. Table name is snapshotted for receipts. */
export interface OrderService {
  mode: ServiceMode;
  tableId?: string;
  tableName?: string;
  guests?: number;
}

export const serviceLabel = (s?: OrderService | null): string | undefined => {
  if (!s) return undefined;
  if (s.mode === "takeaway") return "Takeaway";
  const parts = ["Dine-in"];
  if (s.tableName) parts.push(s.tableName);
  if (s.guests) parts.push(`${s.guests} guest${s.guests > 1 ? "s" : ""}`);
  return parts.join(" · ");
};

const STORAGE_KEY = "pos.tables.v1";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tbl_${Math.random().toString(36).slice(2)}_${Date.now()}`;

export const makeTables = (
  storeId: string,
  opts: { prefix: string; start: number; count: number; zone: string; seatingType: string; seats: number },
): DiningTable[] =>
  Array.from({ length: Math.max(0, Math.min(200, opts.count)) }, (_, i) => ({
    id: uid(),
    storeId,
    name: `${opts.prefix}${opts.start + i}`.slice(0, 12),
    zone: opts.zone.trim() || "Main",
    seatingType: opts.seatingType.trim() || "Table",
    seats: Math.max(1, opts.seats),
    enabled: true,
  }));

interface Ctx {
  tables: DiningTable[];
  tablesForStore: (storeId?: string | null) => DiningTable[];
  addTables: (t: DiningTable[]) => void;
  updateTable: (t: DiningTable) => void;
  updateTables: (t: DiningTable[]) => void;
  removeTable: (id: string) => void;
}

const TablesContext = createContext<Ctx | null>(null);

const load = (): DiningTable[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((table) => ({ ...table, seatingType: table.seatingType?.trim() || "Table" }))
      : null;
  } catch {
    return null;
  }
};

export function TablesProvider({ children }: { children: ReactNode }) {
  const { stores } = useStores();
  // null = never configured → seed demo tables once stores are known.
  const [tables, setTables] = useState<DiningTable[]>(() => load() ?? []);
  const [seeded, setSeeded] = useState<boolean>(() => load() !== null);

  useEffect(() => {
    if (seeded || stores.length === 0) return;
    const demo = stores.flatMap((s) => [
      ...makeTables(s.id, { prefix: "T", start: 1, count: 8, zone: "Main", seatingType: "Table", seats: 4 }),
      ...makeTables(s.id, { prefix: "P", start: 1, count: 2, zone: "Patio", seatingType: "Patio table", seats: 2 }),
    ]);
    setTables(demo);
    setSeeded(true);
  }, [seeded, stores]);

  useEffect(() => {
    if (!seeded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
    } catch {
      // ignore
    }
  }, [tables, seeded]);

  const tablesForStore = useCallback(
    (storeId?: string | null) => (storeId ? tables.filter((t) => t.storeId === storeId) : []),
    [tables],
  );
  const addTables = useCallback((t: DiningTable[]) => setTables((p) => [...p, ...t]), []);
  const updateTable = useCallback(
    (t: DiningTable) => setTables((p) => p.map((x) => (x.id === t.id ? t : x))),
    [],
  );
  const removeTable = useCallback((id: string) => setTables((p) => p.filter((x) => x.id !== id)), []);
  const updateTables = useCallback((ts: DiningTable[]) => {
    const byId = new Map(ts.map((t) => [t.id, t]));
    setTables((p) => p.map((x) => byId.get(x.id) ?? x));
  }, []);

  const value = useMemo(
    () => ({ tables, tablesForStore, addTables, updateTable, updateTables, removeTable }),
    [tables, tablesForStore, addTables, updateTable, updateTables, removeTable],
  );
  return <TablesContext.Provider value={value}>{children}</TablesContext.Provider>;
}

export function useTables() {
  const ctx = useContext(TablesContext);
  if (!ctx) throw new Error("useTables must be used within TablesProvider");
  return ctx;
}

/** Group tables by zone, preserving first-seen zone order and natural name sort. */
export const groupByZone = (list: DiningTable[]): [string, DiningTable[]][] => {
  const map = new Map<string, DiningTable[]>();
  for (const t of list) {
    const z = t.zone || "Main";
    if (!map.has(z)) map.set(z, []);
    const zoneTables = map.get(z);
    if (zoneTables) zoneTables.push(t);
  }
  for (const arr of map.values())
    arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return [...map.entries()];
};

/** Group a zone's individual spots by seating type. */
export const groupByType = (list: DiningTable[]): [string, DiningTable[]][] => {
  const map = new Map<string, DiningTable[]>();
  for (const table of list) {
    const type = table.seatingType || "Table";
    const typeTables = map.get(type);
    if (typeTables) typeTables.push(table);
    else map.set(type, [table]);
  }
  return [...map.entries()];
};

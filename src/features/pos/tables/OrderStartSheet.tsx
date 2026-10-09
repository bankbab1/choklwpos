import { useStores } from "../store/StoreProvider";
import { isOrderModeEnabled, orderPreferences } from "../store/orderPreferences";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, UtensilsCrossed, Users } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupByType, groupByZone, useTables, type OrderService, type ServiceMode } from "./TablesProvider";

export interface BusyTable {
  orderId: string;
  guests?: number;
}

interface Props {
  open: boolean;
  isOpening: boolean;
  isClosing: boolean;
  onClose: () => void;
  storeId?: string;
  initial?: OrderService | null;
  /** tableId → open order occupying it (current order excluded). */
  busy: Record<string, BusyTable>;
  onConfirm: (s: OrderService) => void;
  /** Tap a busy table → jump into that table's order. */
  onOpenBusy: (orderId: string) => void;
}

const OrderStartSheet = ({ open, isOpening, isClosing, onClose, storeId, initial, busy, onConfirm, onOpenBusy }: Props) => {
  const { stores } = useStores();
  const prefs = orderPreferences(stores.find((s) => s.id === storeId)?.orderPreferences);
  const { tablesForStore } = useTables();
  const tables = useMemo(() => tablesForStore(storeId).filter((t) => t.enabled), [tablesForStore, storeId]);
  const zones = useMemo(() => groupByZone(tables), [tables]);

  const [mode, setMode] = useState<ServiceMode>(initial && isOrderModeEnabled(prefs, initial.mode) ? initial.mode : prefs.defaultOrderMode);
  const [tableId, setTableId] = useState<string | undefined>(initial?.tableId);
  const [guests, setGuests] = useState<number>(initial?.guests ?? 1);

  useEffect(() => {
    if (open && !isClosing) {
      setMode(initial && isOrderModeEnabled(prefs, initial.mode) ? initial.mode : prefs.defaultOrderMode);
      setTableId(initial?.tableId);
      setGuests(initial?.guests ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!isOrderModeEnabled(prefs, mode)) {
      setMode(prefs.defaultOrderMode);
      setTableId(undefined);
    }
  }, [mode, prefs.takeawayEnabled, prefs.dineInEnabled, prefs.defaultOrderMode]);

  const table = tables.find((t) => t.id === tableId);
  const needsTable = prefs.requireTable;
  const canConfirm = isOrderModeEnabled(prefs, mode) && (mode === "takeaway" || ((!needsTable || !!table) && guests >= 1));
  const overCapacity = table && guests > table.seats;

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm(
      mode === "takeaway"
        ? { mode }
        : { mode, tableId: table?.id, tableName: table?.name, guests },
    );
  };

  return (
    <BaseSheet open={open} isOpening={isOpening} isClosing={isClosing} onClose={onClose} className="h-[85dvh] rounded-t-3xl">
      {({ onDragStart, onDragMove, onDragEnd }) => (
        <div className="flex flex-col h-full min-h-0">
          <SheetHeader
            title="Start order"
            subtitle="Choose how the customer is ordering."
            onClose={onClose}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 space-y-5">
            {/* Mode */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "dine_in", label: "Dine-in", icon: UtensilsCrossed },
                { id: "takeaway", label: "Takeaway", icon: ShoppingBag },
              ] as const).filter((m) => isOrderModeEnabled(prefs, m.id)).map((m) => {
                const on = mode === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "h-16 rounded-2xl border flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98]",
                      on ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {mode === "dine_in" && (
              <>
                {/* Guests */}
                <section className="space-y-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Guests <span className="text-destructive">*</span>
                  </h3>
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2">
                    <button
                      type="button"
                      onClick={() => setGuests((g) => Math.max(0, g - 1))}
                      className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center active:scale-95"
                      aria-label="Fewer guests"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold tabular-nums text-foreground">{guests}</p>
                      <p className="text-[10px] text-muted-foreground">guests</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuests((g) => Math.min(99, g + 1))}
                      className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95"
                      aria-label="More guests"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  {overCapacity && (
                    <p className="text-xs text-primary">
                      {table?.name} seats {table?.seats} — more guests than usual.
                    </p>
                  )}
                </section>

                {/* Table map */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Table {needsTable && <span className="text-destructive">*</span>}
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-border bg-card" />Free</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-dashed border-muted-foreground/50 bg-muted" />Occupied</span>
                    </div>
                  </div>
                  {tables.length === 0 && (
                    <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 p-3">
                      No tables set up for this branch. Add tables or disable “Require table for dine-in” in the branch preferences.
                    </p>
                  )}
                  {!needsTable && <Button variant="outline" onClick={() => setTableId(undefined)}>No table</Button>}
                  {zones.map(([zone, list]) => (
                    <div key={zone} className="space-y-2">
                      <p className="text-xs font-bold text-foreground">{zone}</p>
                      {groupByType(list).map(([seatingType, typeTables]) => (
                        <div key={seatingType} className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{seatingType}</p>
                          <div className="grid grid-cols-4 gap-2">
                        {typeTables.map((t) => {
                          const b = busy[t.id];
                          const selected = t.id === tableId;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              disabled={!!b}
                              onClick={() => !b && setTableId(t.id)}
                              aria-label={b ? `${t.name} occupied` : `Table ${t.name}`}
                              className={cn(
                                "aspect-square rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition",
                                !b && "active:scale-95",
                                selected && "border-primary bg-primary text-primary-foreground",
                                !selected && b && "border-dashed border-border bg-muted text-muted-foreground opacity-60 cursor-not-allowed",
                                !selected && !b && "border-border bg-card text-foreground",
                              )}
                            >
                              <span className="text-sm font-bold">{t.name}</span>
                              <span className={cn("text-[10px] flex items-center gap-0.5", selected ? "opacity-90" : "text-muted-foreground")}>
                                <Users className="h-3 w-3" />
                                {b ? `${b.guests ?? "?"}/${t.seats}` : t.seats}
                              </span>
                            </button>
                          );
                        })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {Object.keys(busy).length > 0 && (
                    <p className="text-[11px] text-muted-foreground">Occupied tables can't be picked. To add items, switch to that table's order from the cart.</p>
                  )}
                </section>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <Button variant="outline" className="h-12 font-semibold" onClick={onClose}>
              Cancel
            </Button>
            <Button className="h-12 font-semibold" disabled={!canConfirm} onClick={confirm}>
              {initial ? "Update" : "Start"}
            </Button>
          </div>
        </div>
      )}
    </BaseSheet>
  );
};

export default OrderStartSheet;

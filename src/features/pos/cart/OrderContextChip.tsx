import { useState } from "react";
import { ChevronDown, Plus, UtensilsCrossed } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useOpenOrders } from "@/features/pos/orders/OpenOrdersProvider";
import { useBusinessPreset } from "@/lib/businessType";

interface Props {
  onSwitch: (orderId: string | null) => void;
}

export const OrderContextChip = ({ onSwitch }: Props) => {
  const { openOrders: allOrders, activeOrderId, activeOrder } = useOpenOrders();
  const openOrders = allOrders.filter((o) => o.status === "open" || o.status === "hold");
  const { preset } = useBusinessPreset();
  const [open, setOpen] = useState(false);

  const label = activeOrder
    ? activeOrder.reference?.value || activeOrder.id
    : "New Order";

  const handlePick = (id: string | null) => {
    setOpen(false);
    if (id !== activeOrderId) onSwitch(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-95 tabular-nums",
            activeOrder
              ? "bg-primary/15 text-primary border border-primary/30"
              : "bg-secondary text-secondary-foreground border border-border",
          )}
        >
          <span className="truncate max-w-[240px]">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <button
          onClick={() => handlePick(null)}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-muted active:scale-[0.98] transition flex items-center gap-2",
            !activeOrderId && "bg-muted",
          )}
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className={cn("flex-1", !activeOrderId && "font-semibold")}>
            New Order
          </span>
        </button>

        {openOrders.length > 0 ? (
          <>
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Add to existing
            </div>
            <div className="max-h-64 overflow-y-auto">
              {openOrders.map((o) => {
                const qty = o.items.reduce((s, i) => s + i.quantity, 0);
                const isActive = activeOrderId === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => handlePick(o.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-muted active:scale-[0.98] transition flex items-center justify-between gap-2",
                      isActive && "bg-muted",
                    )}
                  >
                    <span className="flex flex-col min-w-0 gap-0.5">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {o.service?.tableName && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 px-2 py-0.5 text-[11px] font-bold">
                            <UtensilsCrossed className="h-3 w-3" />
                            {o.service.tableName}
                            {o.service.guests ? ` · ${o.service.guests}p` : ""}
                          </span>
                        )}
                        <span className={cn("truncate", isActive && "font-semibold")}>
                          {o.reference?.value || (o.service?.tableName ? (o.service.mode === "dine_in" ? "Dine-in" : "") : o.id)}
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {o.id} · {o.status === "hold" ? "Hold" : "Open"}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {qty} pcs
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="px-3 py-3 text-[11px] text-muted-foreground leading-relaxed">
            No open orders yet. Save an order from Review to create one (asks
            for {preset.referenceLabel.toLowerCase()}).
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

import { LayoutGrid, ShoppingCart, Clock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  cartCount: number;
  onCartOpen: () => void;
  cartShake?: boolean;
  ordersShake?: boolean;
}

const tabs = [
  { id: "menu", label: "Menu", icon: LayoutGrid },
  { id: "cart", label: "Cart", icon: ShoppingCart },
  { id: "orders", label: "Orders", icon: Clock },
  { id: "settings", label: "Settings", icon: Settings },
];

const BottomNav = ({
  activeTab,
  onTabChange,
  cartCount,
  onCartOpen,
  cartShake,
  ordersShake,
}: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isCart = tab.id === "cart";
          const isOrders = tab.id === "orders";
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isCart) {
                  onCartOpen();
                } else {
                  onTabChange(tab.id);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 py-1 transition-colors relative",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "relative",
                  isCart && cartShake && "cart-shake",
                  isOrders && ordersShake && "cart-shake ring-2 ring-primary/40 rounded-full"
                )}
              >
                <Icon className="h-5 w-5" />
                {isCart && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

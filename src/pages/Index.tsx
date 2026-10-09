import { orderPreferences } from "@/features/pos/store/orderPreferences";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRef } from "react";
import { Search, Sun, Moon, X, LayoutGrid, Rows3, ScanLine, Store, ChevronDown, Check, ShoppingBag, UtensilsCrossed } from "lucide-react";
import ScanOrderSheet from "@/features/pos/orders/ScanOrderSheet";
import { Product, CartItem } from "@/data/products";
import { MasterProvider, useMaster } from "@/features/pos/master/MasterProvider";
import MasterView from "@/features/pos/master/MasterView";
import {
  getCartTotal,
  normalizeItemAfterQtyChange,
  getLineTotal, // ✅ ADD THIS
} from "@/lib/pricing/pricing";
import CategoryTabs from "@/features/pos/shared/CategoryTabs";
import ProductGrid from "@/features/pos/product/ProductGrid";
import SectionedProductList, { sectionIdFor } from "@/features/pos/product/SectionedProductList";
import ProductCustomizer from "@/features/pos/product/ProductCustomizer";
import CartSheet from "@/features/pos/cart/CartSheet";
import BottomNav from "@/features/pos/cart/BottomNav";
import OrdersView, { OrdersProvider, OrdersHeader, useOrders } from "@/features/pos/orders/OrdersView";
import { OpenOrdersProvider, useOpenOrders } from "@/features/pos/orders/OpenOrdersProvider";
import { BusinessProvider, useBusinessPreset } from "@/lib/businessType";
import SettingsView from "@/features/pos/settings/SettingsView";
import BankAccountsView from "@/features/pos/bank/BankAccountsView";
import { BankAccountsProvider } from "@/features/pos/bank/BankAccountsProvider";
import StoresView from "@/features/pos/store/StoresView";
import { StoreProvider, type Store as StoreT } from "@/features/pos/store/StoreProvider";
import { Button } from "@/components/ui/button";
import { ActiveStoreProvider, useActiveStore, storeShortLabel, storeBranchToken } from "@/features/pos/store/ActiveStoreProvider";
import ReceiptTemplateView from "@/features/pos/receipt/ReceiptTemplateView";
import { ReceiptTemplateProvider } from "@/features/pos/receipt/ReceiptTemplateProvider";
import PromotionsView from "@/features/pos/promotions/PromotionsView";
import { PromotionsProvider } from "@/features/pos/promotions/PromotionsProvider";
import DiscountMasterView from "@/features/pos/discounts/DiscountMasterView";
import ReviewOrder from "@/features/pos/order/ReviewOrder";
import { SaveOpenOrderDialog } from "@/features/pos/order/SaveOpenOrderDialog";
import { useSheetAnimation } from "@/hooks/useSheetAnimation";
import { formatTHB } from "@/lib/pricing/currency";
import { generateOrderId } from "@/lib/orderId/orderId";

import OrderDiscountEditor from "@/features/pos/order/OrderDiscountEditor";
import PaymentMethodSheet, { PaymentMethod } from "@/features/pos/order/PaymentMethodSheet";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import QrBankPickerSheet from "@/features/pos/order/QrBankPickerSheet";
import QrPaymentSheet from "@/features/pos/order/QrPaymentSheet";
import BillSheet from "@/features/pos/receipt/BillSheet";
import PaymentSuccessSheet from "@/features/pos/receipt/PaymentSuccessSheet";
import VoidOrderSheet from "@/features/pos/orders/VoidOrderSheet";
import type { ReceiptPayment } from "@/features/pos/receipt/ReceiptDocument";
import type { BankAccount } from "@/features/pos/bank/BankAccountsProvider";
import { BANK_META, useBankAccounts, isAccountForStore } from "@/features/pos/bank/BankAccountsProvider";
import { InputMode } from "@/lib/discount/discount";
import { toast } from "sonner";
import { TablesProvider, serviceLabel, type OrderService } from "@/features/pos/tables/TablesProvider";
import OrderStartSheet, { type BusyTable } from "@/features/pos/tables/OrderStartSheet";
import TablesView from "@/features/pos/tables/TablesView";

/** Combined label for bills/receipts: "Dine-in · T3 · 4 guests · Somchai". */
const orderContextLabel = (
  reference?: { value: string } | null,
  service?: OrderService | null,
): string | undefined => {
  const parts: string[] = [];
  const sl = serviceLabel(service);
  if (sl) parts.push(sl);
  const ref = reference?.value?.trim();
  if (ref && ref !== service?.tableName) parts.push(ref);
  return parts.length ? parts.join(" · ") : undefined;
};

const CUSTOM_PRODUCT_ID = "__custom__";

const CUSTOM_PRODUCT: Product = {
  id: "__custom__",
  name: "Custom Item",
  price: 0,
  category: "Onetime Item",
};

const Index = () => (
  <BusinessProvider>
    <MasterProvider>
      <BankAccountsProvider>
        <StoreProvider>
          <ActiveStoreProvider>
          <TablesProvider>
          <ReceiptTemplateProvider>
            <PromotionsProvider>
              <OpenOrdersProvider>
                <OrdersProvider>
                  <IndexInner />
                </OrdersProvider>
              </OpenOrdersProvider>
            </PromotionsProvider>
          </ReceiptTemplateProvider>
          </TablesProvider>
          </ActiveStoreProvider>
        </StoreProvider>
      </BankAccountsProvider>
    </MasterProvider>
  </BusinessProvider>
);

const IndexInner = () => {
  const ANIMATION_DURATION = 300;
  const { preset } = useBusinessPreset();
  const { products } = useMaster();
  const [showMaster, setShowMaster] = useState<null | "product" | "category">(null);
  const [showBank, setShowBank] = useState(false);
  const [showStores, setShowStores] = useState(false);
  const [showReceiptTemplate, setShowReceiptTemplate] = useState(false);
  const [showPromotions, setShowPromotions] = useState(false);
  const [showDiscountMaster, setShowDiscountMaster] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const {
    openOrders,
    activeOrderId,
    activeOrder,
    setActiveOrderId,
    upsertOpenOrder,
    completeOpenOrder,
    cancelOpenOrder,
    voidOpenOrder,
    partialVoidOpenOrder,
  } = useOpenOrders();
  const { accounts, defaultAccount } = useBankAccounts();
  const { activeStore, activeStoreId, enabledStores, setActiveStoreId } = useActiveStore();
  const storePickerSheet = useSheetAnimation(ANIMATION_DURATION);
  const openStorePicker = storePickerSheet.openSheet;
  const closeStorePicker = storePickerSheet.closeSheet;
  // Orders-screen branch view filter (admin). Staff-level permission scoping
  // comes later with user accounts; for now every device acts as admin.
  const CAN_VIEW_ALL_BRANCHES = true;
  const ordersBranchSheet = useSheetAnimation(ANIMATION_DURATION);
  const { branchFilter, setBranchFilter } = useOrders();
  const branchToken = useMemo(() => storeBranchToken(activeStore), [activeStore]);

  // Branch the current cart belongs to: an existing order keeps its original
  // branch; a fresh cart belongs to this device's active branch.
  const cartStoreId = activeOrder?.storeId ?? activeStoreId ?? undefined;

  const switchSheet = (closeFn: () => void, openFn: () => void) => {
    closeFn();

    requestAnimationFrame(() => {
      setTimeout(openFn, ANIMATION_DURATION - 50);
    });
  };

  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  // Dine-in/takeaway for a fresh (not yet saved) cart. Saved orders carry their own.
  const [draftService, setDraftService] = useState<OrderService | null>(null);
  const cartService: OrderService | null = activeOrder?.service ?? draftService;
  const orderStartSheet = useSheetAnimation(ANIMATION_DURATION);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [returnToCartAfterService, setReturnToCartAfterService] = useState(false);

  const requestSwitchStore = useCallback(
    (id: string) => {
      if (id === activeStoreId) {
        closeStorePicker();
        return;
      }
      if (cart.length > 0) {
        toast.warning("Finish or clear the current order before switching branch");
        return;
      }
      setActiveStoreId(id);
      closeStorePicker();
      const target = enabledStores.find((s) => s.id === id);
      toast.success(`This device is now ${storeShortLabel(target ?? null)}`);
    },
    [activeStoreId, cart.length, enabledStores, setActiveStoreId, closeStorePicker],
  );

  type OrderDiscountState = {
    value: number; // computed discount
    inputMode: InputMode;
    inputValue: number; // 🔥 ADD THIS
  };

  const [orderDiscount, setOrderDiscount] = useState<OrderDiscountState>({
    value: 0,
    inputMode: "amount",
    inputValue: 0,
  });

  const [cartShake, setCartShake] = useState(false);
  const menuScanSheet = useSheetAnimation();
  const customizerSheet = useSheetAnimation(ANIMATION_DURATION);
  const cartSheet = useSheetAnimation(ANIMATION_DURATION);
  const billSheet = useSheetAnimation(ANIMATION_DURATION);
  const [activeTab, setActiveTab] = useState("menu");
  const [ordersShake, setOrdersShake] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [closingProduct, setClosingProduct] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  const findProductFromItem = (item: CartItem): Product | null => {
    if (item.productId === CUSTOM_PRODUCT_ID) return CUSTOM_PRODUCT;

    return products.find((p) => p.id === item.productId) ?? null;
  };

  const [invalidItems, setInvalidItems] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const mainRef = useRef<HTMLDivElement>(null);
  const suppressObserverRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePillSelect = useCallback((cat: string) => {
    setActiveCategory(cat);
    const container = mainRef.current;
    if (!container) return;

    // Suppress observer briefly so it doesn't fight programmatic scroll
    suppressObserverRef.current = true;
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => {
      suppressObserverRef.current = false;
    }, 700);

    if (cat === "All") {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const id = sectionIdFor(cat);
    const el = document.getElementById(id);
    if (!el) return;

    const containerTop = container.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    const target = container.scrollTop + (elTop - containerTop) - 4;
    container.scrollTo({ top: target, behavior: "smooth" });
  }, []);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";

      return false; // ✅ ALWAYS LIGHT by default
    }
    return false;
  });

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("productViewMode");
      if (saved === "grid" || saved === "list") return saved;
    }
    return "grid";
  });

  useEffect(() => {
    localStorage.setItem("productViewMode", viewMode);
  }, [viewMode]);

  const closeCustomizer = () => {
    setEditingItem(null); // 🔥 add this

    setClosingProduct(selectedProduct);
    customizerSheet.closeSheet();

    setTimeout(() => {
      setSelectedProduct(null);
      setClosingProduct(null);
    }, ANIMATION_DURATION);
  };

  const openCart = cartSheet.openSheet;
  const closeCart = cartSheet.closeSheet;

  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCartShake = () => {
    setCartShake(true);

    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }

    shakeTimeoutRef.current = setTimeout(() => {
      setCartShake(false);
    }, ANIMATION_DURATION);
  };

  const handleUpdateItem = (updated: CartItem) => {
    setCart((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const isSameCartItem = (a: CartItem, b: CartItem) => {
    const normalizeOptions = (options?: CartItem["options"]) =>
      JSON.stringify(
        [...(options || [])].sort((x, y) => {
          const ax = `${x.groupId}-${x.optionId}-${x.optionName}`;
          const by = `${y.groupId}-${y.optionId}-${y.optionName}`;
          return ax.localeCompare(by);
        }),
      );

    return (
      a.productId === b.productId &&
      a.isCustom === b.isCustom &&
      a.name === b.name &&
      a.description === b.description &&
      a.note === b.note &&
      a.image === b.image &&
      a.basePrice === b.basePrice &&
      a.optionPrice === b.optionPrice &&
      normalizeOptions(a.options) === normalizeOptions(b.options) &&
      a.discountType === b.discountType &&
      a.discountValue === b.discountValue &&
      a.discountScope === b.discountScope &&
      a.inputMode === b.inputMode &&
      a.inputValue === b.inputValue &&
      a.lineTarget === b.lineTarget &&
      a.isFree === b.isFree
    );
  };

  const handleAddItem = (item: CartItem) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => isSameCartItem(i, item));

      if (existingIndex !== -1) {
        const updated = [...prev];

        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(
            9999,
            updated[existingIndex].quantity + item.quantity,
          ),
        };

        return updated;
      }

      return [
        ...prev,
        {
          ...item,
          quantity: Math.min(9999, item.quantity),
        },
      ];
    });
  };

  const ordersShakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const triggerOrdersShake = () => {
    setOrdersShake(true);

    if (ordersShakeTimeoutRef.current) {
      clearTimeout(ordersShakeTimeoutRef.current);
    }

    ordersShakeTimeoutRef.current = setTimeout(() => {
      setOrdersShake(false);
    }, ANIMATION_DURATION);
  };


  useEffect(() => {
    mainRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [activeTab]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const filteredProducts = useMemo(() => {
    let filtered: Product[] = [];

    if (activeCategory === "All") {
      filtered = products.filter((p) => p.active !== false);
    } else if (activeCategory === "Onetime Item") {
      filtered = [CUSTOM_PRODUCT]; // ✅ ONLY here
    } else {
      filtered = products.filter(
        (p) => p.category === activeCategory && p.active !== false,
      );
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [activeCategory, search, products]);

  const cartBaseTotal = useMemo(
    () => cart.reduce((sum, i) => sum + getLineTotal(i), 0),
    [cart],
  );

  const cartCount = useMemo(
    () => cart.reduce((s, i) => s + i.quantity, 0),
    [cart],
  );

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const newQty = Math.min(9999, Math.max(0, item.quantity + delta));

        const updated = { ...item, quantity: newQty };

        const normalized = normalizeItemAfterQtyChange(updated);

        if (item.lineTarget != null && normalized.lineTarget == null) {
          toast.warning("Set price removed due to quantity change");
        }

        return normalized;
      }),
    );
  }, []);

  const handleSetQuantity = (id: string, qty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, quantity: qty };
        const normalized = normalizeItemAfterQtyChange(updated);

        if (item.lineTarget != null && normalized.lineTarget == null) {
          toast.warning("Set price removed due to quantity change");

          // 🔥 mark invalid item
          setInvalidItems((prev) =>
            prev.includes(item.id) ? prev : [...prev, item.id],
          );

          // 🔥 auto clear after animation
          setTimeout(() => {
            setInvalidItems((prev) => prev.filter((i) => i !== item.id));
          }, 5500);
        }

        return normalized;
      }),
    );
  };

  useEffect(() => {
    if (invalidItems.length === 0) return;

    const lastInvalidId = invalidItems[invalidItems.length - 1];

    const el = document.getElementById(`cart-item-${lastInvalidId}`);

    if (!el) return;

    setTimeout(() => {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100); // sync with animation
  }, [invalidItems]);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const lastClearedOrderRef = useRef<{
    id: string;
    reference?: { type: any; value: string };
    status: "open" | "hold";
  } | null>(null);

  const clearCart = useCallback((): void => {
    if (activeOrder && (activeOrder.status === "open" || activeOrder.status === "hold")) {
      lastClearedOrderRef.current = {
        id: activeOrder.id,
        reference: activeOrder.reference,
        status: activeOrder.status,
      };
      cancelOpenOrder(activeOrder.id);
      setActiveOrderId(null);
    } else {
      lastClearedOrderRef.current = null;
    }
    setCart([]);
    setDraftService(null);
  }, [activeOrder, cancelOpenOrder, setActiveOrderId]);

  const restoreCart = useCallback(
    (items: CartItem[]): void => {
      const snap = lastClearedOrderRef.current;
      if (snap) {
        upsertOpenOrder({
          id: snap.id,
          items,
          status: snap.status,
          reference: snap.reference,
        });
        setActiveOrderId(snap.id);
        lastClearedOrderRef.current = null;
      }
      setCart(items);
    },
    [upsertOpenOrder, setActiveOrderId],
  );

  const successSheet = useSheetAnimation(ANIMATION_DURATION);

  const handleCheckout = useCallback((method: PaymentMethod, account?: BankAccount | null) => {
    const total = getCartTotal(cart);

    // Mint a final order ID for this payment (branch-specific numbering).
    const paidId = activeOrderId ?? generateOrderId({ branch: branchToken });

    const methodLabel = method === "cash" ? "Cash" : "QR";
    toast.success(`Paid ${formatTHB(total)} · ${methodLabel}`, {
      description: paidId,
      duration: 2500,
    });

    const bankMeta = account?.bank ? BANK_META[account.bank] : null;
    const payment: ReceiptPayment = {
      method,
      bankName: bankMeta?.name,
      accountName: account?.name,
      accountRef: account?.ref,
      bank: account?.bank ?? undefined,
      type: account?.type ?? undefined,
    };

    // Capture snapshot for the receipt before clearing cart
    setPaidSnapshot({
      items: cart,
      total,
      orderId: paidId,
      contextLabel: orderContextLabel(activeOrder?.reference, cartService),
      issuedAt: new Date(),
      orderDiscount: orderDiscount.value ?? 0,
      payment,
      storeId: cartStoreId,
    });

    // Persist as completed (keeps it visible in Orders → Completed)
    completeOpenOrder({
      id: activeOrderId ?? paidId,
      items: cart,
      reference: activeOrder?.reference,
      service: cartService ?? undefined,
      payment,
      orderDiscount: orderDiscount.value ?? 0,
      total,
      storeId: cartStoreId,
      branch: branchToken,
    });

    setCart([]);
    setDraftService(null);
    setOrderDiscount({ value: 0, inputMode: "amount", inputValue: 0 });
    closeCart();
    // Open the success sheet
    setTimeout(() => successSheet.openSheet(), 50);
  }, [cart, closeCart, activeOrderId, activeOrder, completeOpenOrder, orderDiscount.value, successSheet, cartStoreId, branchToken, cartService]);

  const handleHold = useCallback(() => {
    if (cart.length === 0) return;
    upsertOpenOrder({ id: activeOrderId ?? undefined, items: cart, status: "hold", storeId: cartStoreId, branch: branchToken, service: cartService ?? undefined });
    toast.success("Order held", {
      description: "Resume from Orders → Hold",
    });
    setCart([]);
    setDraftService(null);
    setActiveOrderId(null);
    closeCart();
    setTimeout(() => {
      triggerOrdersShake();
    }, ANIMATION_DURATION);
  }, [cart, closeCart, triggerOrdersShake, upsertOpenOrder, cartStoreId, branchToken, cartService, activeOrderId, setActiveOrderId]);

  const [saveOpenDialogOpen, setSaveOpenDialogOpen] = useState(false);
  const [pendingBillAfterSave, setPendingBillAfterSave] = useState(false);

  const openSaveOpenDialog = useCallback(() => {
    if (cart.length === 0) return;
    setSaveOpenDialogOpen(true);
  }, [cart.length]);

  const handleSaveOpenSubmit = useCallback(
    (label: string) => {
      const saved = upsertOpenOrder({
        items: cart,
        status: "open",
        storeId: cartStoreId,
        branch: branchToken,
        service: cartService ?? undefined,
        reference: label
          ? { type: preset.referenceType, value: label }
          : undefined,
      });
      setSaveOpenDialogOpen(false);
      setDraftService(null);

      if (pendingBillAfterSave) {
        setPendingBillAfterSave(false);
        setActiveOrderId(saved.id);
        toast.success("Saved as open order", {
          description: "Showing bill — share or print for customer.",
          duration: 2500,
        });
        setTimeout(() => {
          billSheet.openSheet();
        }, ANIMATION_DURATION);
        return;
      }

      toast.success("Saved as open order", {
        description: label ? `Find under ${label} in Orders → Open` : "Pay later from Orders → Open",
        duration: 2500,
      });
      setCart([]);
      closeCart();
      setTimeout(() => {
        triggerOrdersShake();
      }, ANIMATION_DURATION);
    },
    [cart, closeCart, triggerOrdersShake, upsertOpenOrder, preset.referenceType, pendingBillAfterSave, setActiveOrderId, billSheet, cartStoreId, branchToken, cartService],
  );

  const handleUpdateOrder = useCallback(() => {
    if (!activeOrderId) return;
    upsertOpenOrder({ id: activeOrderId, items: cart });
    toast.success("Order updated");
    setCart([]);
    setActiveOrderId(null);
    closeCart();
    setTimeout(() => {
      triggerOrdersShake();
    }, ANIMATION_DURATION);
  }, [cart, activeOrderId, upsertOpenOrder, setActiveOrderId, closeCart, triggerOrdersShake]);

  const handleConvertToOpen = useCallback(() => {
    if (!activeOrderId) return;
    upsertOpenOrder({ id: activeOrderId, items: cart, status: "open" });
    toast.success("Saved as open order");
    setCart([]);
    setActiveOrderId(null);
    closeCart();
    setTimeout(() => {
      triggerOrdersShake();
    }, ANIMATION_DURATION);
  }, [cart, activeOrderId, upsertOpenOrder, setActiveOrderId, closeCart, triggerOrdersShake]);

  // Switch context (from chip in cart or from Orders list tap).
  const handleSwitchContext = useCallback(
    (newId: string | null) => {
      // Auto-save current state before switching.
      if (activeOrderId) {
        upsertOpenOrder({ id: activeOrderId, items: cart });
      } else if (cart.length > 0) {
        upsertOpenOrder({ items: cart, status: "hold", storeId: cartStoreId, branch: branchToken, service: draftService ?? undefined });
      }
      setDraftService(null);
      if (newId) {
        const next = openOrders.find((o) => o.id === newId);
        setCart(next ? next.items : []);
      } else {
        setCart([]);
      }
      setActiveOrderId(newId);
    },
    [activeOrderId, cart, openOrders, upsertOpenOrder, setActiveOrderId, cartStoreId, branchToken, draftService],
  );

  // Tap on an open/hold order in Orders → focus it + open cart.
  const handleFocusOpenOrder = useCallback(
    (id: string) => {
      handleSwitchContext(id);
      openCart();
    },
    [handleSwitchContext, openCart],
  );

  // Tap on a completed/voided order in Orders → open read-only receipt viewer.
  const completedViewSheet = useSheetAnimation(ANIMATION_DURATION);
  const voidSheet = useSheetAnimation(ANIMATION_DURATION);
  const [viewingCompletedId, setViewingCompletedId] = useState<string | null>(null);
  const viewingCompleted = useMemo(
    () => (viewingCompletedId ? openOrders.find((o) => o.id === viewingCompletedId) ?? null : null),
    [viewingCompletedId, openOrders],
  );

  const handleViewCompleted = useCallback(
    (id: string) => {
      setViewingCompletedId(id);
      completedViewSheet.openSheet();
    },
    [completedViewSheet],
  );

  const reviewSheet = useSheetAnimation(ANIMATION_DURATION);
  const discountSheet = useSheetAnimation(ANIMATION_DURATION);
  const paymentSheet = useSheetAnimation(ANIMATION_DURATION);
  const qrBankSheet = useSheetAnimation(ANIMATION_DURATION);
  const qrPaymentSheet = useSheetAnimation(ANIMATION_DURATION);
  // billSheet declared earlier (hoisted so handleSaveOpenSubmit can reference it).
  const [qrAccount, setQrAccount] = useState<BankAccount | null>(null);

  // Snapshot of the just-paid order for the success sheet (cart is cleared on checkout)
  const [paidSnapshot, setPaidSnapshot] = useState<{
    items: CartItem[];
    total: number;
    orderId: string;
    contextLabel?: string;
    payment: ReceiptPayment;
    issuedAt: Date;
    orderDiscount: number;
    storeId?: string;
  } | null>(null);


  const busyTables: Record<string, BusyTable> = {};
  for (const o of openOrders) {
    if ((o.status === "open" || o.status === "hold") && o.id !== activeOrderId && o.service?.tableId && o.storeId === cartStoreId) {
      busyTables[o.service.tableId] = { orderId: o.id, guests: o.service.guests };
    }
  }

  // "At order start": the first product of a fresh cart asks Dine-in/Takeaway first.
  const selectProduct = (p: Product) => {
    if (cart.length === 0 && !cartService) {
      const prefs = orderPreferences(activeStore?.orderPreferences);
      if (prefs.defaultOrderMode === "takeaway" || !prefs.requireTable) {
        setDraftService({ mode: prefs.defaultOrderMode, ...(prefs.defaultOrderMode === "dine_in" ? { guests: 1 } : {}) });
        setSelectedProduct(p);
        customizerSheet.openSheet();
        return;
      }
      setPendingProduct(p);
      orderStartSheet.openSheet();
      return;
    }
    setSelectedProduct(p);
    customizerSheet.openSheet();
  };

  const handleServiceConfirm = (svc: OrderService) => {
    if (activeOrder) upsertOpenOrder({ id: activeOrder.id, items: cart, service: svc });
    else setDraftService(svc);
    orderStartSheet.closeSheet();
    const p = pendingProduct;
    const shouldReturnToCart = returnToCartAfterService;
    setPendingProduct(null);
    setReturnToCartAfterService(false);
    if (p) {
      setTimeout(() => {
        setSelectedProduct(p);
        customizerSheet.openSheet();
      }, ANIMATION_DURATION);
    } else if (shouldReturnToCart) setTimeout(openCart, ANIMATION_DURATION);
  };

  const editServiceFromCart = () => {
    setReturnToCartAfterService(true);
    switchSheet(closeCart, orderStartSheet.openSheet);
  };

  if (showMaster || showBank || showStores || showReceiptTemplate || showPromotions || showDiscountMaster || showTables) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        {showTables ? (
          <TablesView onBack={() => setShowTables(false)} />
        ) : showBank ? (
          <BankAccountsView onBack={() => setShowBank(false)} />
        ) : showStores ? (
          <StoresView onBack={() => setShowStores(false)} />
        ) : showReceiptTemplate ? (
          <ReceiptTemplateView onBack={() => setShowReceiptTemplate(false)} />
        ) : showPromotions ? (
          <PromotionsView onBack={() => setShowPromotions(false)} />
        ) : showDiscountMaster ? (
          <DiscountMasterView onBack={() => setShowDiscountMaster(false)} />
        ) : (
          <MasterView mode={showMaster!} onBack={() => setShowMaster(null)} />
        )}
      </div>
    );
  }

  // Payment QR account scoped to the bill's branch: prefer the default
  // account when it's eligible for that branch, else first eligible account.
  const billEligibleAccounts = accounts.filter(
    (a) =>
      a.enabled && a.bank && a.type && (!cartStoreId || isAccountForStore(a, cartStoreId)),
  );
  const billQrAccount =
    (defaultAccount && billEligibleAccounts.some((a) => a.id === defaultAccount.id)
      ? defaultAccount
      : null) ?? billEligibleAccounts[0];
  const billPayment: ReceiptPayment | undefined = billQrAccount
    ? {
        method: "qr",
        bankName: billQrAccount.bank ? BANK_META[billQrAccount.bank]?.name : undefined,
        accountName: billQrAccount.name,
        accountRef: billQrAccount.ref,
        bank: billQrAccount.bank,
        type: billQrAccount.type,
      }
    : undefined;

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">
                LWCHOK<span className="text-primary">POS</span>
              </h1>
              {activeTab === "orders" && CAN_VIEW_ALL_BRANCHES && enabledStores.length >= 1 ? (
                <button
                  type="button"
                  onClick={ordersBranchSheet.openSheet}
                  aria-label="Filter orders by branch"
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 active:scale-95 transition"
                >
                  <Store className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary max-w-[80px] truncate">
                    {branchFilter.length === 0
                      ? "All"
                      : branchFilter.length === 1
                        ? storeBranchToken(enabledStores.find((s) => s.id === branchFilter[0]) ?? null) ?? "1 branch"
                        : `${branchFilter.length} branches`}
                  </span>
                  <ChevronDown className="h-3 w-3 text-primary" />
                </button>
              ) : activeTab !== "settings" && enabledStores.length >= 1 && activeStore ? (
                <button
                  type="button"
                  onClick={openStorePicker}
                  aria-label="Change this device's branch"
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 active:scale-95 transition"
                >
                  <Store className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary max-w-[80px] truncate">
                    {storeBranchToken(activeStore) ?? storeShortLabel(activeStore)}
                  </span>
                  <ChevronDown className="h-3 w-3 text-primary" />
                </button>
              ) : null}
              {activeTab === "menu" && cartService && (
                <button
                  type="button"
                  onClick={orderStartSheet.openSheet}
                  aria-label="Change dine-in or takeaway"
                  className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2 py-0.5 active:scale-95 transition"
                >
                  {cartService.mode === "takeaway" ? (
                    <ShoppingBag className="h-3 w-3 text-foreground" />
                  ) : (
                    <UtensilsCrossed className="h-3 w-3 text-foreground" />
                  )}
                  <span className="text-[10px] font-semibold text-foreground max-w-[90px] truncate">
                    {cartService.mode === "takeaway"
                      ? "Takeaway"
                      : [cartService.tableName, cartService.guests ? `${cartService.guests}p` : null].filter(Boolean).join(" · ") || "Dine-in"}
                  </span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Point of Sale
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* THEME TOGGLE */}
            <button
              onClick={() => setDark((d) => !d)}
              className="
      h-8 w-8 rounded-full
      bg-card border border-border
      flex items-center justify-center
      hover:bg-primary/10 active:scale-95
      transition-all
    "
            >
              {dark ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* USER AVATAR */}
            <div
              className="
      h-8 w-8 rounded-full
      bg-primary/20
      flex items-center justify-center
      shadow-sm
    "
            >
              <span className="text-xs font-bold text-primary">JD</span>
            </div>
          </div>
        </div>

        {activeTab === "menu" && (
          <>
            {/* Search */}
            <div className="px-4 pb-2 flex items-center gap-2">
              {/* VIEW MODE TOGGLE */}
              <button
                type="button"
                onClick={() =>
                  setViewMode((m) => (m === "grid" ? "list" : "grid"))
                }
                aria-label={
                  viewMode === "grid"
                    ? "Switch to list view"
                    : "Switch to grid view"
                }
                className="
                  shrink-0 h-11 w-11 rounded-xl
                  bg-secondary flex items-center justify-center
                  active:scale-95 transition
                "
              >
                {viewMode === "grid" ? (
                  <Rows3 className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              <div className="relative min-w-0 flex-1 flex items-center bg-secondary rounded-xl px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />

                <input
                  type="text"
                  placeholder="Search menu..."
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
                onClick={menuScanSheet.openSheet}
                aria-label="Scan product code"
                className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition shadow-sm shadow-primary/20 shrink-0"
              >
                <ScanLine className="h-5 w-5" />
              </button>
            </div>

            <ScanOrderSheet
              open={menuScanSheet.open}
              isOpening={menuScanSheet.isOpening}
              isClosing={menuScanSheet.isClosing}
              onClose={menuScanSheet.closeSheet}
              title="Scan product"
              subtitle="Align the barcode inside the frame"
              onResult={(value) => {
                const code = value.trim();
                menuScanSheet.closeSheet();
                if (!code) return;
                const match = products.find(
                  (p) => (p.code || "").toLowerCase() === code.toLowerCase(),
                );
                if (match) {
                  setActiveCategory("All");
                  setSearch("");
                  selectProduct(match);
                } else {
                  setSearch(code);
                  toast.error("No product matches that code");
                }
              }}
            />




            {/* Categories */}
            <CategoryTabs
              active={activeCategory}
              onSelect={handlePillSelect}
              activeTab={activeTab}
            />
          </>
        )}

        {activeTab === "orders" && <OrdersHeader />}
      </header>

      {/* Content */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto overscroll-contain pb-[calc(80px+env(safe-area-inset-bottom))]"
      >
        {activeTab === "menu" && (
          <>
            <SectionedProductList
              products={products}
              viewMode={viewMode}
              search={search}
              scrollContainerRef={mainRef}
              onActiveCategoryChange={setActiveCategory}
              suppressObserverRef={suppressObserverRef}
              onSelect={selectProduct}
            />
          </>
        )}
        {activeTab === "orders" && (
          <OrdersView onSelectOpen={handleFocusOpenOrder} onSelectCompleted={handleViewCompleted} />
        )}
        {activeTab === "settings" && <SettingsView onOpenMaster={() => setShowMaster("product")} onOpenCategoryMaster={() => setShowMaster("category")} onOpenBankAccounts={() => setShowBank(true)} onOpenStores={() => setShowStores(true)} onOpenReceiptTemplate={() => setShowReceiptTemplate(true)} onOpenPromotions={() => setShowPromotions(true)} onOpenDiscountMaster={() => setShowDiscountMaster(true)} onOpenTables={orderPreferences(activeStore?.orderPreferences).dineInEnabled ? () => setShowTables(true) : undefined} />}
      </main>


      {/* Cart Sheet */}
      {(cartSheet.open || cartSheet.isClosing) && (
        <CartSheet
          onEditItem={(item) => {
            setEditingItem(item);

            const product = findProductFromItem(item);
            if (!product) return;

            setSelectedProduct(product);

            switchSheet(closeCart, () => customizerSheet.openSheet());
          }}
          items={cart}
          onAddItem={handleAddItem}
          onUpdateQuantity={updateQuantity}
          onSetQuantity={handleSetQuantity}
          onRemove={removeItem}
          onClear={clearCart}
          onRestore={restoreCart}
          onCheckout={() => {
            switchSheet(closeCart, reviewSheet.openSheet);
          }}
          onHold={handleHold}
          onSwitchContext={handleSwitchContext}
          service={cartService}
          onEditService={editServiceFromCart}
          isExistingOrder={!!activeOrderId}
          open={cartSheet.open}
          isOpening={cartSheet.isOpening}
          isClosing={cartSheet.isClosing}
          onClose={closeCart}
          invalidItems={invalidItems}
        />
      )}

      {/* 🔥 ADD HERE */}
      {(customizerSheet.open || customizerSheet.isClosing) &&
        (selectedProduct || closingProduct) && (
          <ProductCustomizer
            product={selectedProduct || closingProduct}
            initialItem={editingItem}
            onClose={closeCustomizer}
            open={customizerSheet.open}
            isOpening={customizerSheet.isOpening}
            isClosing={customizerSheet.isClosing}
            onConfirm={(item) => {
              if (editingItem) {
                handleUpdateItem({
                  ...item,
                  id: editingItem.id,
                });

                toast.success(`${item.name} updated`);
              } else {
                handleAddItem(item);
                toast.success(`${item.name} added`);
              }

              setEditingItem(null);
              closeCustomizer();

              setTimeout(() => {
                triggerCartShake();
              }, ANIMATION_DURATION);
            }}
          />
        )}

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cartCount={cartCount}
        onCartOpen={openCart}
        cartShake={cartShake}
        ordersShake={ordersShake}
      />

      {(reviewSheet.open || reviewSheet.isClosing) && (
        <ReviewOrder
          items={cart}
          invalidItems={invalidItems}
          orderDiscount={orderDiscount}
          onEditOrderDiscount={() => {
            switchSheet(reviewSheet.closeSheet, discountSheet.openSheet);
          }}
          open={reviewSheet.open}
          isOpening={reviewSheet.isOpening}
          isClosing={reviewSheet.isClosing}
          onBack={() => {
            switchSheet(reviewSheet.closeSheet, openCart);
          }}
          onConfirm={() => {
            switchSheet(reviewSheet.closeSheet, paymentSheet.openSheet);
          }}
          onSaveOpen={() => {
            reviewSheet.closeSheet();
            setTimeout(() => {
              openSaveOpenDialog();
            }, ANIMATION_DURATION);
          }}
          onUpdateOrder={() => {
            reviewSheet.closeSheet();
            setTimeout(() => {
              handleUpdateOrder();
            }, ANIMATION_DURATION);
          }}
          onConvertToOpen={() => {
            reviewSheet.closeSheet();
            setTimeout(() => {
              handleConvertToOpen();
            }, ANIMATION_DURATION);
          }}
          isExistingOrder={!!activeOrderId}
          existingOrderStatus={activeOrder?.status as "open" | "hold" | undefined}
          contextLabel={orderContextLabel(activeOrder?.reference, cartService) || activeOrder?.id}
          onEditItem={(item) => {
            reviewSheet.closeSheet();

            setTimeout(() => {
              setEditingItem(item);

              const product = findProductFromItem(item);
              if (!product) return;

              setSelectedProduct(product);
              customizerSheet.openSheet();
            }, ANIMATION_DURATION); // 🔥 smoother timing
          }}
          onViewBill={() => {
            if (activeOrderId) {
              switchSheet(reviewSheet.closeSheet, billSheet.openSheet);
              return;
            }
            setPendingBillAfterSave(true);
            reviewSheet.closeSheet();
            setTimeout(() => {
              openSaveOpenDialog();
            }, ANIMATION_DURATION);
          }}
        />
      )}

      {(discountSheet.open || discountSheet.isClosing) && (
        <OrderDiscountEditor
          baseTotal={cartBaseTotal}
          initialValue={orderDiscount.inputValue} // ✅ raw value
          initialMode={orderDiscount.inputMode} // ✅ ADD THIS
          hasExistingDiscount={orderDiscount.value > 0}
          open={discountSheet.open}
          isOpening={discountSheet.isOpening}
          isClosing={discountSheet.isClosing}
          onClose={() => {
            switchSheet(discountSheet.closeSheet, reviewSheet.openSheet);
          }}
          onApply={(data) => {
            setOrderDiscount(data);

            switchSheet(discountSheet.closeSheet, reviewSheet.openSheet);
          }}
        />
      )}

      {(paymentSheet.open || paymentSheet.isClosing) && (
        <PaymentMethodSheet
          open={paymentSheet.open}
          isOpening={paymentSheet.isOpening}
          isClosing={paymentSheet.isClosing}
          total={Math.max(0, cartBaseTotal - (orderDiscount.value ?? 0))}
          onClose={() => {
            switchSheet(paymentSheet.closeSheet, reviewSheet.openSheet);
          }}
          onConfirm={(method) => {
            if (method === "qr") {
              switchSheet(paymentSheet.closeSheet, qrBankSheet.openSheet);
              return;
            }
            paymentSheet.closeSheet();
            setTimeout(() => {
              handleCheckout(method);
            }, ANIMATION_DURATION);
          }}
        />
      )}

      {(qrBankSheet.open || qrBankSheet.isClosing) && (
        <QrBankPickerSheet
          open={qrBankSheet.open}
          isOpening={qrBankSheet.isOpening}
          isClosing={qrBankSheet.isClosing}
          total={Math.max(0, cartBaseTotal - (orderDiscount.value ?? 0))}
          storeId={cartStoreId}
          onClose={() => {
            switchSheet(qrBankSheet.closeSheet, paymentSheet.openSheet);
          }}
          onConfirm={(account) => {
            setQrAccount(account);
            switchSheet(qrBankSheet.closeSheet, qrPaymentSheet.openSheet);
          }}
        />
      )}

      {(qrPaymentSheet.open || qrPaymentSheet.isClosing) && (
        <QrPaymentSheet
          open={qrPaymentSheet.open}
          isOpening={qrPaymentSheet.isOpening}
          isClosing={qrPaymentSheet.isClosing}
          total={Math.max(0, cartBaseTotal - (orderDiscount.value ?? 0))}
          account={qrAccount}
          onClose={() => {
            switchSheet(qrPaymentSheet.closeSheet, qrBankSheet.openSheet);
          }}
          onPaid={() => {
            qrPaymentSheet.closeSheet();
            setTimeout(() => {
              handleCheckout("qr", qrAccount);
              setQrAccount(null);
            }, ANIMATION_DURATION);
          }}
        />
      )}

      {(billSheet.open || billSheet.isClosing) && (
        <BillSheet
          open={billSheet.open}
          isOpening={billSheet.isOpening}
          isClosing={billSheet.isClosing}
          onClose={() => switchSheet(billSheet.closeSheet, reviewSheet.openSheet)}
          items={cart}
          orderId={activeOrderId ?? undefined}
          contextLabel={orderContextLabel(activeOrder?.reference, cartService)}
          orderDiscount={orderDiscount.value ?? 0}
          payment={billPayment}
          storeId={cartStoreId}
        />
      )}

      {(successSheet.open || successSheet.isClosing) && paidSnapshot && (
        <PaymentSuccessSheet
          open={successSheet.open}
          isOpening={successSheet.isOpening}
          isClosing={successSheet.isClosing}
          onClose={() => {
            successSheet.closeSheet();
            setTimeout(() => setPaidSnapshot(null), ANIMATION_DURATION);
          }}
          items={paidSnapshot.items}
          orderId={paidSnapshot.orderId}
          contextLabel={paidSnapshot.contextLabel}
          issuedAt={paidSnapshot.issuedAt}
          orderDiscount={paidSnapshot.orderDiscount}
          payment={paidSnapshot.payment}
          total={paidSnapshot.total}
          storeId={paidSnapshot.storeId}
        />
      )}

      {(completedViewSheet.open || completedViewSheet.isClosing) && viewingCompleted && (
        <PaymentSuccessSheet
          open={completedViewSheet.open}
          isOpening={completedViewSheet.isOpening}
          isClosing={completedViewSheet.isClosing}
          onClose={() => {
            completedViewSheet.closeSheet();
            setTimeout(() => setViewingCompletedId(null), ANIMATION_DURATION);
          }}
          items={viewingCompleted.items}
          orderId={viewingCompleted.id}
          contextLabel={orderContextLabel(viewingCompleted.reference, viewingCompleted.service)}
          issuedAt={new Date(viewingCompleted.paidAt ?? viewingCompleted.updatedAt)}
          orderDiscount={viewingCompleted.orderDiscount ?? 0}
          payment={viewingCompleted.payment}
          total={viewingCompleted.total ?? getCartTotal(viewingCompleted.items)}
          storeId={viewingCompleted.storeId}
          viewMode="view"
          voided={viewingCompleted.status === "voided"}
          onVoid={() => {
            voidSheet.openSheet();
          }}
        />
      )}

      {(voidSheet.open || voidSheet.isClosing) && viewingCompleted && (
        <VoidOrderSheet
          open={voidSheet.open}
          isOpening={voidSheet.isOpening}
          isClosing={voidSheet.isClosing}
          onClose={voidSheet.closeSheet}
          orderId={viewingCompleted.id}
          items={viewingCompleted.items}
          returnedQty={viewingCompleted.returnedQty}
          onFullVoid={() => {
            const r = voidOpenOrder(viewingCompleted.id);
            toast.success("Order voided", {
              description: r ? `Reversal ${r.id}` : viewingCompleted.id,
            });
            voidSheet.closeSheet();
            completedViewSheet.closeSheet();
            setTimeout(() => setViewingCompletedId(null), ANIMATION_DURATION);
          }}
          onPartialVoid={(lines) => {
            const r = partialVoidOpenOrder(viewingCompleted.id, lines);
            if (r) {
              toast.success("Items returned", { description: `Reversal ${r.id}` });
            }
            voidSheet.closeSheet();
            completedViewSheet.closeSheet();
            setTimeout(() => setViewingCompletedId(null), ANIMATION_DURATION);
          }}
        />
      )}


      <SaveOpenOrderDialog
        open={saveOpenDialogOpen}
        onClose={() => setSaveOpenDialogOpen(false)}
        onSubmit={handleSaveOpenSubmit}
        initialValue={cartService?.tableName ?? ""}
      />

      {(orderStartSheet.open || orderStartSheet.isClosing) && (
        <OrderStartSheet
          open={orderStartSheet.open}
          isOpening={orderStartSheet.isOpening}
          isClosing={orderStartSheet.isClosing}
          onClose={() => {
            orderStartSheet.closeSheet();
            setPendingProduct(null);
            if (returnToCartAfterService) {
              setReturnToCartAfterService(false);
              setTimeout(openCart, ANIMATION_DURATION);
            }
          }}
          storeId={cartStoreId}
          initial={cartService}
          busy={busyTables}
          onConfirm={handleServiceConfirm}
          onOpenBusy={(orderId) => {
            orderStartSheet.closeSheet();
            const p = pendingProduct;
            setPendingProduct(null);
            handleSwitchContext(orderId);
            const o = openOrders.find((x) => x.id === orderId);
            toast.success(`Opened ${o?.service?.tableName ?? o?.reference?.value ?? "order"}`);
            setTimeout(() => {
              if (p) {
                setSelectedProduct(p);
                customizerSheet.openSheet();
              } else openCart();
            }, ANIMATION_DURATION);
          }}
        />
      )}

      {/* Branch picker — this device's active store (same sheet style as product modal) */}
      {(storePickerSheet.open || storePickerSheet.isClosing) && (
        <BaseSheet
          open={storePickerSheet.open}
          isOpening={storePickerSheet.isOpening}
          isClosing={storePickerSheet.isClosing}
          onClose={closeStorePicker}
          className="h-[60dvh] rounded-t-3xl"
        >
          {({ onDragStart, onDragMove, onDragEnd }) => (
            <>
              <SheetHeader
                title="This device's branch"
                subtitle="New orders from this device are stamped with the selected branch."
                onClose={closeStorePicker}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
              <div className="px-4 pb-4 pt-3 space-y-2 overflow-y-auto max-h-[50vh]">
                {enabledStores.map((s) => {
                  const isActive = s.id === activeStoreId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => requestSwitchStore(s.id)}
                      className={
                        isActive
                          ? "w-full rounded-2xl border border-primary bg-primary/5 px-4 py-3 flex items-center gap-3 text-left"
                          : "w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition"
                      }
                    >
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {s.name || "Untitled Store"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.branch || s.address_line1 || "No branch info"}
                        </p>
                      </div>
                      {isActive && <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </BaseSheet>
      )}
      {(ordersBranchSheet.open || ordersBranchSheet.isClosing) && (
        <OrdersBranchSheet
          sheet={ordersBranchSheet}
          stores={enabledStores}
          value={branchFilter}
          onApply={(ids) => {
            setBranchFilter(ids);
            ordersBranchSheet.closeSheet();
          }}
        />
      )}
    </div>
  );
};

export default Index;

const OrdersBranchSheet = ({
  sheet,
  stores,
  value,
  onApply,
}: {
  sheet: ReturnType<typeof useSheetAnimation>;
  stores: StoreT[];
  value: string[];
  onApply: (ids: string[]) => void;
}) => {
  const [draft, setDraft] = useState<string[]>(value.length === 0 ? stores.map((s) => s.id) : value);
  const allSelected = stores.length > 0 && stores.every((s) => draft.includes(s.id));
  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  return (
    <BaseSheet
      open={sheet.open}
      isOpening={sheet.isOpening}
      isClosing={sheet.isClosing}
      onClose={sheet.closeSheet}
      className="h-[60dvh] rounded-t-3xl"
    >
      {({ onDragStart, onDragMove, onDragEnd }) => (
        <div className="flex flex-col h-full min-h-0">
          <SheetHeader
            title="Show orders from"
            subtitle="Pick one, several, or all branches. Doesn't change this device's branch."
            onClose={sheet.closeSheet}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
          <div className="flex-1 min-h-0 px-4 pb-4 pt-3 space-y-2 overflow-y-auto">
            <button
              type="button"
              onClick={() => setDraft(allSelected ? [] : stores.map((s) => s.id))}
              className={
                allSelected
                  ? "w-full rounded-2xl border border-primary bg-primary/5 px-4 py-3 flex items-center gap-3 text-left"
                  : "w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition"
              }
            >
              <div className="flex-1 text-sm font-semibold text-foreground">All branches</div>
              {allSelected && <Check className="h-5 w-5 text-primary" />}
            </button>
            {stores.map((s) => {
              const on = draft.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={
                    on
                      ? "w-full rounded-2xl border border-primary bg-primary/5 px-4 py-3 flex items-center gap-3 text-left"
                      : "w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition"
                  }
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {storeBranchToken(s) ?? s.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.branchName || s.name || "Untitled Store"}
                    </p>
                  </div>
                  {on && <Check className="h-5 w-5 text-primary" />}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <Button variant="outline" className="h-12 font-semibold" onClick={sheet.closeSheet}>
              Cancel
            </Button>
            <Button
              className="h-12 font-semibold"
              disabled={draft.length === 0}
              onClick={() => onApply(allSelected ? [] : draft)}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </BaseSheet>
  );
};

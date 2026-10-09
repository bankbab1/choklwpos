import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Product, products as seedProducts, categories as seedCategories } from "@/data/products";
import {
  OptionGroup,
  optionGroups as seedGroups,
  itemOptionMap as seedItemMap,
} from "@/data/options";

const PRODUCTS_KEY = "master.products.v1";
const GROUPS_KEY = "master.optionGroups.v1";
const PRODUCT_OPTIONS_KEY = "master.productOptions.v1";
const CATEGORIES_KEY = "master.categories.v1";
const INACTIVE_CATEGORIES_KEY = "master.inactiveCategories.v1";
const DISCOUNTS_KEY = "master.discounts.v1";

export type DiscountMode = "percent" | "amount" | "final" | "free";

export interface ProductDiscount {
  mode: DiscountMode;
  /**
   * raw value:
   * - percent: 0-100
   * - amount: fixed currency amount off
   * - final: the final selling price (overrides base)
   * - free: ignored (effective price is always 0)
   */
  value: number;
  active: boolean;
}

export type DiscountMap = Record<string, ProductDiscount>;

/** Compute the effective price for a product given its discount entry. */
export const effectivePrice = (
  basePrice: number,
  d?: ProductDiscount,
): number => {
  if (!d || !d.active) return basePrice;
  if (d.mode === "free") return 0;
  if (!d.value || d.value <= 0) return basePrice;
  let next: number;
  switch (d.mode) {
    case "percent":
      next = basePrice * (1 - Math.min(100, d.value) / 100);
      break;
    case "amount":
      next = basePrice - d.value;
      break;
    case "final":
      next = Math.min(d.value, basePrice);
      break;
    default:
      next = basePrice;
  }
  return Math.max(0, Number(next.toFixed(2)));
};

/** Categories that are auto-managed and never user-editable. */
export const RESERVED_CATEGORIES = ["All", "Onetime Item"] as const;
const isReserved = (c: string) => (RESERVED_CATEGORIES as readonly string[]).includes(c);

export interface ProductOptionLink {
  libraryGroupIds: string[];
  customGroups: OptionGroup[];
}

type ProductOptionsMap = Record<string, ProductOptionLink>;

const readJSON = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const seedProductOptions = (): ProductOptionsMap => {
  const out: ProductOptionsMap = {};
  for (const p of seedProducts) {
    out[p.id] = {
      libraryGroupIds: seedItemMap[p.id] ? [...seedItemMap[p.id]] : [],
      customGroups: [],
    };
  }
  return out;
};

const seedLibrary = (): OptionGroup[] => Object.values(seedGroups);

const seedUserCategories = (): string[] =>
  seedCategories.filter((c) => !isReserved(c));

interface Ctx {
  /** Products with effective (post-discount) price already applied. */
  products: Product[];
  /** Raw products as stored (un-discounted). Used by Discount Master screen. */
  originalProducts: Product[];
  optionGroups: OptionGroup[];
  productOptions: ProductOptionsMap;
  /** User-managed categories only (excludes "All" / "Onetime Item"). */
  categories: string[];
  /** Full display order including reserved: ["All", ...categories, "Onetime Item"]. */
  displayCategories: string[];
  /** Active user categories only. */
  activeCategories: string[];
  /** Display order filtered to active: ["All", ...activeCategories, "Onetime Item"]. */
  activeDisplayCategories: string[];
  /** Names of categories the user toggled off. */
  inactiveCategories: string[];

  upsertProduct: (p: Product, link?: ProductOptionLink) => void;
  deleteProduct: (id: string) => void;
  toggleProductActive: (id: string) => void;
  isProductActive: (p: Product) => boolean;

  upsertGroup: (g: OptionGroup) => void;
  deleteGroup: (id: string) => void;
  toggleGroupActive: (id: string) => void;
  isGroupActive: (g: OptionGroup) => boolean;
  moveGroup: (id: string, dir: -1 | 1) => void;

  setProductLink: (productId: string, link: ProductOptionLink) => void;

  addCategory: (name: string) => boolean;
  renameCategory: (oldName: string, newName: string) => boolean;
  /** Returns false if category has mapped products (delete blocked). */
  deleteCategory: (name: string) => boolean;
  moveCategory: (name: string, dir: -1 | 1) => void;
  toggleCategoryActive: (name: string) => void;
  isCategoryActive: (name: string) => boolean;
  /** Reorder a product among its same-category siblings. */
  moveProductInCategory: (productId: string, dir: -1 | 1) => void;
  categoryUsageCount: (name: string) => number;

  getOptionsForProduct: (productId: string) => OptionGroup[];

  groupUsageCount: (groupId: string) => number;

  /** Discount master */
  discounts: DiscountMap;
  setDiscount: (productId: string, d: ProductDiscount) => void;
  clearDiscount: (productId: string) => void;
  toggleDiscountActive: (productId: string) => void;
  setAllDiscounts: (map: DiscountMap) => void;
  getEffectivePrice: (productId: string, basePrice: number) => number;

  newId: (prefix?: string) => string;
}


const MasterContext = createContext<Ctx | null>(null);

export const MasterProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>(() =>
    readJSON<Product[]>(PRODUCTS_KEY, seedProducts),
  );
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>(() =>
    readJSON<OptionGroup[]>(GROUPS_KEY, seedLibrary()),
  );
  const [productOptions, setProductOptions] = useState<ProductOptionsMap>(() =>
    readJSON<ProductOptionsMap>(PRODUCT_OPTIONS_KEY, seedProductOptions()),
  );
  const [categories, setCategories] = useState<string[]>(() =>
    readJSON<string[]>(CATEGORIES_KEY, seedUserCategories()),
  );
  const [inactiveCategories, setInactiveCategories] = useState<string[]>(() =>
    readJSON<string[]>(INACTIVE_CATEGORIES_KEY, []),
  );
  const [discounts, setDiscounts] = useState<DiscountMap>(() =>
    readJSON<DiscountMap>(DISCOUNTS_KEY, {}),
  );

  useEffect(() => {
    localStorage.setItem(DISCOUNTS_KEY, JSON.stringify(discounts));
  }, [discounts]);

  useEffect(() => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories]);
  useEffect(() => {
    localStorage.setItem(INACTIVE_CATEGORIES_KEY, JSON.stringify(inactiveCategories));
  }, [inactiveCategories]);

  useEffect(() => {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }, [products]);
  useEffect(() => {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(optionGroups));
  }, [optionGroups]);
  useEffect(() => {
    localStorage.setItem(PRODUCT_OPTIONS_KEY, JSON.stringify(productOptions));
  }, [productOptions]);

  const newId = useCallback((prefix = "id") => {
    return `${prefix}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }, []);

  const upsertProduct = useCallback(
    (p: Product, link?: ProductOptionLink) => {
      setProducts((prev) => {
        const idx = prev.findIndex((x) => x.id === p.id);
        if (idx === -1) return [...prev, p];
        const copy = [...prev];
        copy[idx] = p;
        return copy;
      });
      if (link) {
        setProductOptions((prev) => ({ ...prev, [p.id]: link }));
      } else {
        setProductOptions((prev) =>
          prev[p.id]
            ? prev
            : { ...prev, [p.id]: { libraryGroupIds: [], customGroups: [] } },
        );
      }
    },
    [],
  );

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setProductOptions((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const toggleProductActive = useCallback((id: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, active: p.active === false ? true : false } : p,
      ),
    );
  }, []);

  const isProductActive = useCallback((p: Product) => p.active !== false, []);

  const setProductLink = useCallback(
    (productId: string, link: ProductOptionLink) => {
      setProductOptions((prev) => ({ ...prev, [productId]: link }));
    },
    [],
  );

  const upsertGroup = useCallback((g: OptionGroup) => {
    setOptionGroups((prev) => {
      const idx = prev.findIndex((x) => x.id === g.id);
      if (idx === -1) return [...prev, g];
      const copy = [...prev];
      copy[idx] = g;
      return copy;
    });
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setOptionGroups((prev) => prev.filter((g) => g.id !== id));
    // strip from any product references
    setProductOptions((prev) => {
      const copy: ProductOptionsMap = {};
      for (const [pid, link] of Object.entries(prev)) {
        copy[pid] = {
          ...link,
          libraryGroupIds: link.libraryGroupIds.filter((gid) => gid !== id),
        };
      }
      return copy;
    });
  }, []);

  const toggleGroupActive = useCallback((id: string) => {
    setOptionGroups((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, active: g.active === false ? true : false } : g,
      ),
    );
  }, []);

  const isGroupActive = useCallback((g: OptionGroup) => g.active !== false, []);

  const moveGroup = useCallback((id: string, dir: -1 | 1) => {
    setOptionGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      const j = idx + dir;
      if (idx === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }, []);

  const groupsById = useMemo(() => {
    const m: Record<string, OptionGroup> = {};
    for (const g of optionGroups) m[g.id] = g;
    return m;
  }, [optionGroups]);

  const getOptionsForProduct = useCallback(
    (productId: string): OptionGroup[] => {
      const link = productOptions[productId];
      if (!link) return [];
      const lib = link.libraryGroupIds
        .map((gid) => groupsById[gid])
        .filter(Boolean) as OptionGroup[];
      return [...lib, ...link.customGroups].filter((g) => g.active !== false);
    },
    [productOptions, groupsById],
  );

  const groupUsageCount = useCallback(
    (groupId: string): number => {
      let n = 0;
      for (const link of Object.values(productOptions)) {
        if (link.libraryGroupIds.includes(groupId)) n++;
      }
      return n;
    },
    [productOptions],
  );

  const categoryUsageCount = useCallback(
    (name: string) => products.filter((p) => p.category === name).length,
    [products],
  );

  const addCategory = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean || isReserved(clean)) return false;
      let added = false;
      setCategories((prev) => {
        if (prev.some((c) => c.toLowerCase() === clean.toLowerCase())) return prev;
        added = true;
        return [...prev, clean];
      });
      return added;
    },
    [],
  );

  const renameCategory = useCallback(
    (oldName: string, newName: string) => {
      const clean = newName.trim();
      if (!clean || isReserved(clean) || isReserved(oldName)) return false;
      if (clean === oldName) return true;
      let ok = false;
      setCategories((prev) => {
        if (!prev.includes(oldName)) return prev;
        if (prev.some((c) => c.toLowerCase() === clean.toLowerCase())) return prev;
        ok = true;
        return prev.map((c) => (c === oldName ? clean : c));
      });
      if (ok) {
        setProducts((prev) =>
          prev.map((p) => (p.category === oldName ? { ...p, category: clean } : p)),
        );
      }
      return ok;
    },
    [],
  );

  const deleteCategory = useCallback(
    (name: string): boolean => {
      if (isReserved(name)) return false;
      // Block delete if any product is still mapped to this category.
      const inUse = products.some((p) => p.category === name);
      if (inUse) return false;
      setCategories((prev) => prev.filter((c) => c !== name));
      return true;
    },
    [products],
  );

  const moveCategory = useCallback((name: string, dir: -1 | 1) => {
    setCategories((prev) => {
      const idx = prev.indexOf(name);
      const j = idx + dir;
      if (idx === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }, []);

  const moveProductInCategory = useCallback(
    (productId: string, dir: -1 | 1) => {
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === productId);
        if (idx === -1) return prev;
        const cat = prev[idx].category;
        // Find nearest sibling in same category in the given direction.
        let j = idx + dir;
        while (j >= 0 && j < prev.length && prev[j].category !== cat) {
          j += dir;
        }
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[j]] = [next[j], next[idx]];
        return next;
      });
    },
    [],
  );

  const inactiveSet = useMemo(() => new Set(inactiveCategories), [inactiveCategories]);

  const isCategoryActive = useCallback(
    (name: string) => isReserved(name) || !inactiveSet.has(name),
    [inactiveSet],
  );

  const toggleCategoryActive = useCallback((name: string) => {
    if (isReserved(name)) return;
    setInactiveCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );
  }, []);

  const displayCategories = useMemo(
    () => ["All", ...categories, "Onetime Item"],
    [categories],
  );

  const activeCategories = useMemo(
    () => categories.filter((c) => !inactiveSet.has(c)),
    [categories, inactiveSet],
  );

  const activeDisplayCategories = useMemo(
    () => ["All", ...activeCategories, "Onetime Item"],
    [activeCategories],
  );

  // ── Discount master helpers ───────────────────────────────────
  const setDiscount = useCallback((productId: string, d: ProductDiscount) => {
    setDiscounts((prev) => ({ ...prev, [productId]: d }));
  }, []);
  const clearDiscount = useCallback((productId: string) => {
    setDiscounts((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  }, []);
  const toggleDiscountActive = useCallback((productId: string) => {
    setDiscounts((prev) => {
      const cur = prev[productId];
      if (!cur) return prev;
      return { ...prev, [productId]: { ...cur, active: !cur.active } };
    });
  }, []);
  const setAllDiscounts = useCallback((map: DiscountMap) => {
    setDiscounts(map);
  }, []);

  const getEffectivePrice = useCallback(
    (productId: string, basePrice: number) =>
      effectivePrice(basePrice, discounts[productId]),
    [discounts],
  );

  // Products exposed to the rest of the app already have discount applied.
  const effectiveProducts = useMemo<Product[]>(
    () =>
      products.map((p) => {
        const d = discounts[p.id];
        if (!d || !d.active) return p;
        const next = effectivePrice(p.price, d);
        return next === p.price ? p : { ...p, price: next };
      }),
    [products, discounts],
  );

  const value = useMemo<Ctx>(
    () => ({
      products: effectiveProducts,
      originalProducts: products,
      optionGroups,
      productOptions,
      categories,
      displayCategories,
      activeCategories,
      activeDisplayCategories,
      inactiveCategories,
      upsertProduct,
      deleteProduct,
      toggleProductActive,
      isProductActive,
      upsertGroup,
      deleteGroup,
      toggleGroupActive,
      isGroupActive,
      moveGroup,
      setProductLink,
      addCategory,
      renameCategory,
      deleteCategory,
      moveCategory,
      toggleCategoryActive,
      isCategoryActive,
      moveProductInCategory,
      categoryUsageCount,
      getOptionsForProduct,
      groupUsageCount,
      discounts,
      setDiscount,
      clearDiscount,
      toggleDiscountActive,
      setAllDiscounts,
      getEffectivePrice,
      newId,
    }),
    [
      products,
      effectiveProducts,
      optionGroups,
      productOptions,
      categories,
      displayCategories,
      activeCategories,
      activeDisplayCategories,
      inactiveCategories,
      upsertProduct,
      deleteProduct,
      toggleProductActive,
      isProductActive,
      upsertGroup,
      deleteGroup,
      toggleGroupActive,
      isGroupActive,
      moveGroup,
      setProductLink,
      addCategory,
      renameCategory,
      deleteCategory,
      moveCategory,
      toggleCategoryActive,
      isCategoryActive,
      moveProductInCategory,
      categoryUsageCount,
      getOptionsForProduct,
      groupUsageCount,
      discounts,
      setDiscount,
      clearDiscount,
      toggleDiscountActive,
      setAllDiscounts,
      getEffectivePrice,
      newId,
    ],
  );

  return (
    <MasterContext.Provider value={value}>{children}</MasterContext.Provider>
  );
};

export const useMaster = () => {
  const ctx = useContext(MasterContext);
  if (!ctx) throw new Error("useMaster must be used inside MasterProvider");
  return ctx;
};

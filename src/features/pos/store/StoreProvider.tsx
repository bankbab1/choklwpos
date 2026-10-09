import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export interface Store {
  id: string;
  // Identity
  name: string;
  /** Short branch code, max 6 chars (e.g. "BR0001") — used in order IDs and the POS header chip. */
  branchShortCode: string;
  /** Branch display name, max 25 chars (e.g. "Sukhumvit 31"). */
  branchName: string;
  /** Legacy combined label ("BR0001 · Sukhumvit 31") — kept synced from code+name. */
  branch: string;
  logo: string; // data URL or http(s) url
  headline: string; // optional tagline under shop name (e.g. "Specialty coffee since 2018")

  // Address (printed below shop name)
  address_line1: string;
  address_line2: string;
  address_line3: string;
  address_line4: string;

  // Contact (printed as small print under address)
  phone: string;
  taxId: string;          // Thai TIN — 13 digits
  branchCode: string;     // Thai branch code — 5 digits (00000 = HQ)
  vatRegistered: boolean; // ภ.พ.20 registered → print "ใบกำกับภาษีอย่างย่อ"
  website: string;


  // QR caption (when QR is shown on the receipt)
  qrCaption: string;

  // Receipt-bottom messaging (rendered at the very end of receipts)
  receiptFooterTitle: string;
  receiptFooterSub: string;
  receiptFooterNote1: string;
  receiptFooterNote2: string;

  // Bill-bottom messaging (rendered at the very end of bills)
  billFooterTitle: string;
  billFooterSub: string;
  billFooterNote1: string;
  billFooterNote2: string;

  enabled: boolean;
}

const STORAGE_KEY = "pos.stores.v2";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `store_${Math.random().toString(36).slice(2)}_${Date.now()}`;

/** Combined legacy label from the split code + name fields. */
export const deriveBranchLabel = (code: string, name: string): string => {
  const c = code.trim();
  const n = name.trim();
  if (c && n) return `${c} · ${n}`;
  return c || n;
};

export const createEmptyStore = (): Store => ({
  id: uid(),
  name: "",
  branchShortCode: "",
  branchName: "",
  branch: "",
  logo: "",
  headline: "",
  address_line1: "",
  address_line2: "",
  address_line3: "",
  address_line4: "",
  phone: "",
  taxId: "",
  branchCode: "00000",
  vatRegistered: false,
  website: "",

  qrCaption: "Scan to look up your order",
  receiptFooterTitle: "Thank you!",
  receiptFooterSub: "Have a wonderful day",
  receiptFooterNote1: "",
  receiptFooterNote2: "",
  billFooterTitle: "Please present at counter to pay",
  billFooterSub: "This is a bill — not a tax receipt",
  billFooterNote1: "",
  billFooterNote2: "",
  enabled: true,
});

/** Migrate v1 store records (with notes_line1-4) to v2 shape. */
const migrate = (raw: any): Store => {
  const base = createEmptyStore();
  const m = { ...base, ...raw, id: raw?.id || base.id };
  // best-effort lift of legacy notes_line* into structured fields
  const legacy = [raw?.notes_line1, raw?.notes_line2, raw?.notes_line3, raw?.notes_line4]
    .filter((l) => typeof l === "string" && l.trim()) as string[];
  for (const line of legacy) {
    const low = line.toLowerCase();
    if (!m.taxId && low.includes("tax")) m.taxId = line.replace(/^.*?:\s*/, "");
    else if (!m.phone && (low.includes("tel") || low.includes("phone"))) m.phone = line.replace(/^.*?:\s*/, "");
    else if (!m.website && (low.includes("http") || low.includes("www") || low.includes(".com"))) m.website = line;
    // anything else (e.g. "Thank you for visiting!") is dropped — it belongs in footer now
  }
  // split legacy combined branch label ("BR0001 · Sukhumvit 31") into code + name
  if (!m.branchShortCode && !m.branchName && typeof raw?.branch === "string" && raw.branch.trim()) {
    const parts = raw.branch.split("·");
    if (parts.length > 1) {
      m.branchShortCode = parts[0].trim().slice(0, 6);
      m.branchName = parts.slice(1).join("·").trim().slice(0, 25);
    } else {
      m.branchName = raw.branch.trim().slice(0, 25);
    }
  }
  m.branchShortCode = (m.branchShortCode || "").slice(0, 6);
  m.branchName = (m.branchName || "").slice(0, 25);
  // keep the legacy combined label in sync
  m.branch = deriveBranchLabel(m.branchShortCode, m.branchName);
  // strip legacy keys
  delete (m as any).notes_line1;
  delete (m as any).notes_line2;
  delete (m as any).notes_line3;
  delete (m as any).notes_line4;
  return m as Store;
};

const mockStores = (): Store[] => [
  {
    ...createEmptyStore(),
    name: "Mint Cafe",
    branchShortCode: "BR0001",
    branchName: "Sukhumvit 31",
    branch: "BR0001 · Sukhumvit 31",
    headline: "Specialty coffee since 2018",
    address_line1: "88/1 Sukhumvit Soi 31",
    address_line2: "Khlong Toei Nuea, Watthana",
    address_line3: "Bangkok 10110",
    address_line4: "Thailand",
    phone: "02-123-4567",
    taxId: "0105561234567",
    branchCode: "00000",
    vatRegistered: true,
    website: "mintcafe.co",
    enabled: true,
  },
  {
    ...createEmptyStore(),
    name: "Mint Cafe",
    branchShortCode: "BR0002",
    branchName: "Thonglor",
    branch: "BR0002 · Thonglor",
    headline: "Specialty coffee since 2018",
    address_line1: "55 Thonglor Soi 10",
    address_line2: "Khlong Tan Nuea, Watthana",
    address_line3: "Bangkok 10110",
    address_line4: "Thailand",
    phone: "02-987-6543",
    taxId: "0105561234567",
    branchCode: "00001",
    vatRegistered: true,
    website: "mintcafe.co",
    enabled: false,
  },
];



interface Ctx {
  stores: Store[];
  addStore: () => Store;
  updateStore: (s: Store) => void;
  removeStore: (id: string) => void;
  reorderStores: (orderedIds: string[]) => void;
}

const StoreContext = createContext<Ctx | null>(null);

const loadInitial = (): Store[] => {
  if (typeof window === "undefined") return mockStores();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(migrate);
    }
    // attempt one-time migration from v1
    const v1 = localStorage.getItem("pos.stores.v1");
    if (v1) {
      const parsed = JSON.parse(v1);
      if (Array.isArray(parsed)) return parsed.map(migrate);
    }
    return mockStores();
  } catch {
    return mockStores();
  }
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
    } catch (e) {
      // surface to console — typically QuotaExceeded from large logo data URLs
      console.error("[StoreProvider] failed to persist stores", e);
    }
  }, [stores]);

  const addStore = useCallback(() => {
    const s = createEmptyStore();
    setStores((prev) => [...prev, s]);
    return s;
  }, []);

  const updateStore = useCallback((s: Store) => {
    setStores((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }, []);

  const removeStore = useCallback((id: string) => {
    setStores((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reorderStores = useCallback((orderedIds: string[]) => {
    setStores((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      const next: Store[] = [];
      orderedIds.forEach((id) => {
        const s = map.get(id);
        if (s) {
          next.push(s);
          map.delete(id);
        }
      });
      map.forEach((s) => next.push(s));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ stores, addStore, updateStore, removeStore, reorderStores }),
    [stores, addStore, updateStore, removeStore, reorderStores],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStores() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStores must be used within StoreProvider");
  return ctx;
}

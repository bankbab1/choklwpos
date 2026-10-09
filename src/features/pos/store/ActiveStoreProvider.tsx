import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Store, useStores } from "./StoreProvider";

const STORAGE_KEY = "pos.activeStoreId.v1";

interface Ctx {
  /** The branch this device is currently operating as. */
  activeStore: Store | null;
  activeStoreId: string | null;
  enabledStores: Store[];
  setActiveStoreId: (id: string) => void;
}

const ActiveStoreContext = createContext<Ctx | null>(null);

const loadInitial = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Per-device active branch. Persisted in localStorage so each staff device
 * remembers which branch it belongs to. Self-healing: if the stored branch
 * is deleted or disabled, falls back to the first enabled store.
 */
export function ActiveStoreProvider({ children }: { children: ReactNode }) {
  const { stores } = useStores();
  const [storedId, setStoredId] = useState<string | null>(loadInitial);

  const enabledStores = useMemo(() => stores.filter((s) => s.enabled), [stores]);

  const activeStore = useMemo(() => {
    const stored = storedId
      ? enabledStores.find((s) => s.id === storedId)
      : undefined;
    return stored ?? enabledStores[0] ?? null;
  }, [storedId, enabledStores]);

  // Persist the resolved id (also heals stale/disabled selections).
  useEffect(() => {
    try {
      if (activeStore) localStorage.setItem(STORAGE_KEY, activeStore.id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore quota errors
    }
  }, [activeStore]);

  const setActiveStoreId = useCallback((id: string) => {
    setStoredId(id);
  }, []);

  const value = useMemo(
    () => ({
      activeStore,
      activeStoreId: activeStore?.id ?? null,
      enabledStores,
      setActiveStoreId,
    }),
    [activeStore, enabledStores, setActiveStoreId],
  );

  return (
    <ActiveStoreContext.Provider value={value}>
      {children}
    </ActiveStoreContext.Provider>
  );
}

export function useActiveStore() {
  const ctx = useContext(ActiveStoreContext);
  if (!ctx) throw new Error("useActiveStore must be used within ActiveStoreProvider");
  return ctx;
}

/** Short human label for chips — the branch name, e.g. "Sukhumvit 31". */
export const storeShortLabel = (store: Store | null): string => {
  if (!store) return "";
  const name = store.branchName?.trim();
  if (name) return name;
  // legacy combined label fallback
  const branch = store.branch?.trim();
  if (branch) {
    const parts = branch.split("·");
    const label = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
    if (label) return label;
  }
  return store.name || "Store";
};

/** Branch code for the header chip and order IDs, e.g. "BR0001" (max 6 chars). */
export const storeBranchToken = (store: Store | null): string | undefined => {
  if (!store) return undefined;
  const code = store.branchShortCode?.trim();
  if (code) return code.slice(0, 6).toUpperCase();
  // legacy combined label fallback
  const raw = store.branch?.split(/[·\-–\s]/)[0]?.trim();
  if (!raw) return undefined;
  return raw.slice(0, 6).toUpperCase();
};

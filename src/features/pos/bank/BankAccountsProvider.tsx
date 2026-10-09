import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type BankCode = "KBANK" | "SCB" | "KTB" | "BBL";

export type AccountType =
  | "phone"
  | "idcard"
  | "bank"
  | "kshop"
  | "maemanee"
  | "merchant";

export interface BankAccount {
  id: string;
  name: string;
  bank: BankCode | null;
  type: AccountType | null;
  ref: string;
  /** Store/branch ids this account is available for. Empty = all branches. */
  storeIds: string[];
  enabled: boolean;
}

const STORAGE_KEY = "pos.bankAccounts.v4";
const DEFAULT_KEY = "pos.bankAccounts.defaultId.v1";

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `acc_${Math.random().toString(36).slice(2)}_${Date.now()}`);

export const createEmptyAccount = (): BankAccount => ({
  id: uid(),
  name: "",
  bank: null,
  type: null,
  ref: "",
  storeIds: [],
  enabled: true,
});

/** Ensure older stored records get the new fields. */
const migrateAccount = (raw: any): BankAccount => ({
  ...createEmptyAccount(),
  ...raw,
  storeIds: Array.isArray(raw?.storeIds) ? raw.storeIds : [],
});


const mockAccounts = (): BankAccount[] => [
  // SCB
  { id: uid(), name: "SCB · Mae Manee",       bank: "SCB",   type: "maemanee", ref: "014000005710504", storeIds: [], enabled: true },
  { id: uid(), name: "SCB · Biller ID",       bank: "SCB",   type: "merchant", ref: "027556200106117", storeIds: [], enabled: true },
  { id: uid(), name: "SCB · PromptPay Phone", bank: "SCB",   type: "phone",    ref: "0859941717",      storeIds: [], enabled: true },
  { id: uid(), name: "SCB · PromptPay ID",    bank: "SCB",   type: "idcard",   ref: "1100200913741",   storeIds: [], enabled: true },

  // KBANK
  { id: uid(), name: "KBank · KShop (KPS)",   bank: "KBANK", type: "kshop",    ref: "KPS004KB000001880699", storeIds: [], enabled: true },
  { id: uid(), name: "KBank · KShop (EMP)",   bank: "KBANK", type: "kshop",    ref: "EMPKB000001601874001", storeIds: [], enabled: true },
  { id: uid(), name: "KBank · Account",       bank: "KBANK", type: "bank",     ref: "004999013604243",  storeIds: [], enabled: true },
  { id: uid(), name: "KBank · Make by KBank", bank: "KBANK", type: "bank",     ref: "004666014608446",  storeIds: [], enabled: true },

  // BBL
  { id: uid(), name: "BBL · PromptPay",       bank: "BBL",   type: "phone",    ref: "0895209724",      storeIds: [], enabled: true },

  // KTB
  { id: uid(), name: "KTB · PromptPay",       bank: "KTB",   type: "phone",    ref: "0982356952",      storeIds: [], enabled: true },
];

interface Ctx {
  accounts: BankAccount[];
  defaultId: string | null;
  defaultAccount: BankAccount | null;
  setDefaultAccount: (id: string | null) => void;
  addAccount: () => BankAccount;
  updateAccount: (acc: BankAccount) => void;
  removeAccount: (id: string) => void;
  reorderAccounts: (orderedIds: string[]) => void;
}

const BankAccountsContext = createContext<Ctx | null>(null);

export function BankAccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<BankAccount[]>(() => {
    if (typeof window === "undefined") return mockAccounts();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return mockAccounts();
      const parsed = JSON.parse(raw) as any[];
      if (!Array.isArray(parsed)) return mockAccounts();
      return parsed.map(migrateAccount);

    } catch {
      return mockAccounts();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch {
      /* ignore */
    }
  }, [accounts]);

  const [defaultId, setDefaultId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(DEFAULT_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (defaultId) localStorage.setItem(DEFAULT_KEY, defaultId);
      else localStorage.removeItem(DEFAULT_KEY);
    } catch {
      /* ignore */
    }
  }, [defaultId]);

  // Always ensure there's a valid default: if current default is missing or
  // disabled, auto-promote the first enabled account (by current order).
  useEffect(() => {
    const current = defaultId ? accounts.find((a) => a.id === defaultId) : null;
    if (current && current.enabled) return;
    const fallback = accounts.find((a) => a.enabled);
    setDefaultId(fallback ? fallback.id : null);
  }, [accounts, defaultId]);

  const setDefaultAccount = useCallback((id: string | null) => {
    setDefaultId(id);
  }, []);

  const addAccount = useCallback(() => {
    const acc = createEmptyAccount();
    setAccounts((prev) => [...prev, acc]);
    return acc;
  }, []);

  const updateAccount = useCallback((acc: BankAccount) => {
    setAccounts((prev) => prev.map((a) => (a.id === acc.id ? acc : a)));
  }, []);

  const removeAccount = useCallback((id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setDefaultId((prev) => (prev === id ? null : prev));
  }, []);

  const reorderAccounts = useCallback((orderedIds: string[]) => {
    setAccounts((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      const next: BankAccount[] = [];
      orderedIds.forEach((id) => {
        const a = map.get(id);
        if (a) {
          next.push(a);
          map.delete(id);
        }
      });
      // Append any not included (safety)
      map.forEach((a) => next.push(a));
      return next;
    });
  }, []);

  const defaultAccount = useMemo(
    () => (defaultId ? accounts.find((a) => a.id === defaultId) ?? null : null),
    [accounts, defaultId],
  );

  const value = useMemo(
    () => ({
      accounts,
      defaultId,
      defaultAccount,
      setDefaultAccount,
      addAccount,
      updateAccount,
      removeAccount,
      reorderAccounts,
    }),
    [accounts, defaultId, defaultAccount, setDefaultAccount, addAccount, updateAccount, removeAccount, reorderAccounts],
  );

  return <BankAccountsContext.Provider value={value}>{children}</BankAccountsContext.Provider>;
}

export function useBankAccounts() {
  const ctx = useContext(BankAccountsContext);
  if (!ctx) throw new Error("useBankAccounts must be used within BankAccountsProvider");
  return ctx;
}

/** Is this account available for the given store/branch? Empty scope = all branches. */
export function isAccountForStore(acc: BankAccount, storeId: string | null): boolean {
  if (!acc.storeIds || acc.storeIds.length === 0) return true;
  return !!storeId && acc.storeIds.includes(storeId);
}




export const BANK_META: Record<BankCode, { name: string; short: string; color: string }> = {
  KBANK: { name: "KBank", short: "K", color: "bg-emerald-600" },
  SCB: { name: "SCB", short: "S", color: "bg-purple-600" },
  KTB: { name: "KTB", short: "T", color: "bg-sky-600" },
  BBL: { name: "BBL", short: "B", color: "bg-blue-800" },
};

export type AccountTypeOption = {
  uiValue: string;
  value: AccountType;
  label: string;
};

export const ACCOUNT_TYPE_BY_BANK: Record<BankCode, AccountTypeOption[]> = {
  KBANK: [
    { uiValue: "phone", value: "phone", label: "PromptPay (Phone)" },
    { uiValue: "idcard", value: "idcard", label: "PromptPay (ID Card)" },
    { uiValue: "bank_normal", value: "bank", label: "Bank Account" },
    { uiValue: "bank_makeby", value: "bank", label: "Make by KBank" },
    { uiValue: "kshop", value: "kshop", label: "KShop" },
  ],
  SCB: [
    { uiValue: "phone", value: "phone", label: "PromptPay (Phone)" },
    { uiValue: "idcard", value: "idcard", label: "PromptPay (ID Card)" },
    { uiValue: "merchant", value: "merchant", label: "SCB Company Biller" },
    { uiValue: "maemanee", value: "maemanee", label: "Mae Manee" },
  ],
  KTB: [
    { uiValue: "phone", value: "phone", label: "PromptPay (Phone)" },
    { uiValue: "idcard", value: "idcard", label: "PromptPay (ID Card)" },
  ],
  BBL: [
    { uiValue: "phone", value: "phone", label: "PromptPay (Phone)" },
    { uiValue: "idcard", value: "idcard", label: "PromptPay (ID Card)" },
  ],
};

export function sanitizeReferenceInput(type: AccountType | null, text: string): string {
  switch (type) {
    case "phone":
    case "idcard":
    case "bank":
    case "maemanee":
    case "merchant":
      return text.replace(/\D/g, "");
    case "kshop":
      return text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    default:
      return text;
  }
}

export function isReferenceValid(type: AccountType | null, value: string): boolean {
  switch (type) {
    case "phone":
      return /^0\d{9}$/.test(value);
    case "idcard":
      return /^\d{13}$/.test(value);
    case "bank":
    case "maemanee":
    case "merchant":
      return /^\d{15}$/.test(value);
    case "kshop":
      return /^[A-Za-z0-9]{20}$/.test(value);
    default:
      return false;
  }
}

export function getRefConfig(type: AccountType | null): { maxLength?: number; inputMode?: "numeric" | "text" } {
  switch (type) {
    case "phone":
      return { maxLength: 10, inputMode: "numeric" };
    case "idcard":
      return { maxLength: 13, inputMode: "numeric" };
    case "bank":
    case "maemanee":
    case "merchant":
      return { maxLength: 15, inputMode: "numeric" };
    case "kshop":
      return { maxLength: 20, inputMode: "text" };
    default:
      return {};
  }
}

export function getRefPlaceholder(type: AccountType | null): string {
  switch (type) {
    case "phone":
      return "0XXXXXXXXX";
    case "idcard":
      return "13-digit ID card";
    case "maemanee":
      return "15-digit Mae Manee ref. ID";
    case "bank":
      return "15-digit reference number";
    case "merchant":
      return "15-digit Company Biller ID";
    case "kshop":
      return "20-character KShop reference";
    default:
      return "Enter reference number";
  }
}

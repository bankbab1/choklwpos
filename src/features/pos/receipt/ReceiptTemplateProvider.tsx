import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

/**
 * Receipt template controls layout and toggles only.
 * All store-specific wording (address, contact, headline, footer thank-you,
 * QR caption) lives in the Store master and is pulled at render time.
 */
export interface ReceiptTemplate {
  defaultStoreId: string | null;

  // Header toggles
  showLogo: boolean;
  showShopName: boolean;
  showBranch: boolean;
  showHeadline: boolean;
  showAddress: boolean;
  showContact: boolean; // phone / taxId / website

  // Meta toggles
  showOrderNo: boolean;
  showRef: boolean;
  showDate: boolean;
  showCashier: boolean;
  showCustomer: boolean;

  // Body / footer toggles
  showItemDiscounts: boolean;
  showQr: boolean; // receipt-side order-lookup QR
  qrCaption: string; // caption shown under order-lookup QR
  showBillPaymentQr: boolean; // bill-side payment QR (PromptPay)
  showFooter: boolean; // store's footer thank-you block

  // Document-type labels (describe document state, not store branding)
  billTitle: string;
  receiptTitle: string;
  billSubLabel: string;
  receiptCashLabel: string;
  receiptQrLabel: string;

  // Style
  paperWidth: "narrow" | "wide";
  textScale: "sm" | "md" | "lg";
}

export const DEFAULT_TEMPLATE: ReceiptTemplate = {
  defaultStoreId: null,
  showLogo: true,
  showShopName: true,
  showBranch: true,
  showHeadline: true,
  showAddress: true,
  showContact: true,
  showOrderNo: true,
  showRef: true,
  showDate: true,
  showCashier: true,
  showCustomer: true,
  showItemDiscounts: true,
  showQr: true,
  qrCaption: "Scan to look up your order",
  showBillPaymentQr: true,
  showFooter: true,
  billTitle: "BILL",
  receiptTitle: "RECEIPT",
  billSubLabel: "Not yet paid",
  receiptCashLabel: "Paid by Cash",
  receiptQrLabel: "Paid by QR",
  paperWidth: "narrow",
  textScale: "md",
};

export const STORAGE_KEY = "pos.receiptTemplates.v3";
const LEGACY_KEYS = ["pos.receiptTemplate.v2", "pos.receiptTemplate.v1"];

/** A named template assigned to zero or more branches. */
export interface NamedTemplate extends ReceiptTemplate {
  id: string;
  name: string;
  /** Branches using this template. A branch belongs to at most one template. */
  storeIds: string[];
}

const newId = () => `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const normalize = (raw: any): NamedTemplate => {
  const next: any = { ...DEFAULT_TEMPLATE };
  for (const k of Object.keys(DEFAULT_TEMPLATE)) if (raw && k in raw) next[k] = raw[k];
  next.id = typeof raw?.id === "string" ? raw.id : newId();
  next.name = typeof raw?.name === "string" && raw.name.trim() ? raw.name : "Standard";
  next.storeIds = Array.isArray(raw?.storeIds) ? raw.storeIds.filter((x: any) => typeof x === "string") : [];
  return next as NamedTemplate;
};

export const createTemplate = (name = "New template"): NamedTemplate => ({
  ...DEFAULT_TEMPLATE,
  id: newId(),
  name,
  storeIds: [],
});

interface Store {
  templates: NamedTemplate[];
  defaultId: string;
}

const load = (): Store => {
  const fallback = () => {
    const t = normalize({ name: "Standard" });
    return { templates: [t], defaultId: t.id };
  };
  if (typeof window === "undefined") return fallback();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const templates: NamedTemplate[] = (parsed.templates ?? []).map(normalize);
      if (templates.length) {
        const defaultId = templates.some((t) => t.id === parsed.defaultId) ? parsed.defaultId : templates[0].id;
        return { templates, defaultId };
      }
    }
    for (const k of LEGACY_KEYS) {
      const legacy = localStorage.getItem(k);
      if (legacy) {
        const t = normalize({ ...JSON.parse(legacy), name: "Standard" });
        return { templates: [t], defaultId: t.id };
      }
    }
  } catch {
    /* ignore */
  }
  return fallback();
};

interface Ctx {
  /** Default template (fallback for branches without an assignment). */
  template: NamedTemplate;
  templates: NamedTemplate[];
  defaultId: string;
  templateForStore: (storeId?: string | null) => NamedTemplate;
  /** Insert or replace; enforces one template per branch. */
  saveTemplate: (t: NamedTemplate) => void;
  deleteTemplate: (id: string) => void;
  setDefaultTemplate: (id: string) => void;
}

const TemplateContext = createContext<Ctx | null>(null);

export function ReceiptTemplateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Store>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const saveTemplate = useCallback((t: NamedTemplate) => {
    setState((prev) => {
      const claimed = new Set(t.storeIds);
      const others = prev.templates.map((x) =>
        x.id === t.id ? x : { ...x, storeIds: x.storeIds.filter((s) => !claimed.has(s)) },
      );
      const exists = others.some((x) => x.id === t.id);
      const templates = exists ? others.map((x) => (x.id === t.id ? t : x)) : [...others, t];
      return { ...prev, templates };
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setState((prev) => {
      if (id === prev.defaultId || prev.templates.length <= 1) return prev;
      return { ...prev, templates: prev.templates.filter((t) => t.id !== id) };
    });
  }, []);

  const setDefaultTemplate = useCallback((id: string) => {
    setState((prev) => (prev.templates.some((t) => t.id === id) ? { ...prev, defaultId: id } : prev));
  }, []);

  const value = useMemo<Ctx>(() => {
    const def = state.templates.find((t) => t.id === state.defaultId) ?? state.templates[0];
    return {
      template: def,
      templates: state.templates,
      defaultId: def.id,
      templateForStore: (storeId) =>
        (storeId && state.templates.find((t) => t.storeIds.includes(storeId))) || def,
      saveTemplate,
      deleteTemplate,
      setDefaultTemplate,
    };
  }, [state, saveTemplate, deleteTemplate, setDefaultTemplate]);

  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>;
}

export function useReceiptTemplate() {
  const ctx = useContext(TemplateContext);
  if (!ctx) throw new Error("useReceiptTemplate must be used within ReceiptTemplateProvider");
  return ctx;
}

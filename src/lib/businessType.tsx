import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  Utensils,
  Beer,
  ShoppingBag,
  Scissors,
  Tag,
  Circle,
  type LucideIcon,
} from "lucide-react";

export type ReferenceType =
  | "table"
  | "tab"
  | "pickup"
  | "appointment"
  | "custom";

export interface BusinessPreset {
  id: string;
  label: string;
  description: string;
  referenceType: ReferenceType;
  referenceLabel: string;
  referencePlaceholder: string;
  icon: LucideIcon;
}

export const BUSINESS_PRESETS: BusinessPreset[] = [
  {
    id: "generic",
    label: "Generic",
    description: "Free-form labels for any business",
    referenceType: "custom",
    referenceLabel: "Label",
    referencePlaceholder: "Name or note",
    icon: Circle,
  },
  {
    id: "restaurant",
    label: "Restaurant",
    description: "Dine-in tables and open tabs",
    referenceType: "table",
    referenceLabel: "Table",
    referencePlaceholder: "e.g. Table 3",
    icon: Utensils,
  },
  {
    id: "cafe",
    label: "Café",
    description: "Customer name on each open order",
    referenceType: "pickup",
    referenceLabel: "Customer",
    referencePlaceholder: "Customer name",
    icon: Utensils,
  },
  {
    id: "bar",
    label: "Bar / Pub",
    description: "Open tabs by name or seat",
    referenceType: "tab",
    referenceLabel: "Tab",
    referencePlaceholder: "Name or seat",
    icon: Beer,
  },
  {
    id: "qsr",
    label: "QSR / Takeaway",
    description: "Pickup orders by customer",
    referenceType: "pickup",
    referenceLabel: "Order for",
    referencePlaceholder: "Customer name",
    icon: ShoppingBag,
  },
  {
    id: "salon",
    label: "Salon / Service",
    description: "Appointments and clients",
    referenceType: "appointment",
    referenceLabel: "Appointment",
    referencePlaceholder: "Time · Customer",
    icon: Scissors,
  },
  {
    id: "retail",
    label: "Retail / Quote",
    description: "Quotes, layaway, holds",
    referenceType: "custom",
    referenceLabel: "Quote",
    referencePlaceholder: "Customer or PO #",
    icon: Tag,
  },
];

const STORAGE_KEY = "businessPresetId";

export const getBusinessPreset = (id: string): BusinessPreset =>
  BUSINESS_PRESETS.find((p) => p.id === id) ?? BUSINESS_PRESETS[0];

interface Ctx {
  preset: BusinessPreset;
  presetId: string;
  setPresetId: (id: string) => void;
}

const BusinessContext = createContext<Ctx | null>(null);

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const [presetId, setPresetIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "generic";
    return localStorage.getItem(STORAGE_KEY) || "generic";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, presetId);
  }, [presetId]);

  return (
    <BusinessContext.Provider
      value={{
        preset: getBusinessPreset(presetId),
        presetId,
        setPresetId: setPresetIdState,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusinessPreset = () => {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusinessPreset must be used inside BusinessProvider");
  return ctx;
};

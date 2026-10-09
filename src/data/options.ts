// src/data/options.ts

export type OptionType = "single" | "multiple";

export interface OptionItem {
  id: string;
  name: string;
  price?: number;
  isDefault?: boolean;
  /** Optional link to a Product whose name/price seeded this choice. */
  productId?: string;
}

export interface OptionGroup {
  id: string;
  name: string;
  type: OptionType;
  required?: boolean;
  options: OptionItem[];
  /** When false, group is hidden from product customizer. Defaults to true. */
  active?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  image?: string;
  quantity: number;
  options?: any[];
  note?: string;
  basePrice: number;
  optionPrice: number;
  unitPrice: number;
  finalUnitPrice: number;
  discountType?: "amount" | "percent" | null;
  discountValue?: number;
  discountAmount?: number;
  isFree?: boolean;
}

/* =========================
   OPTION GROUP MASTER
========================= */
export const optionGroups: Record<string, OptionGroup> = {
  size: {
    id: "size",
    name: "Size",
    type: "single",
    required: true,
    options: [
      { id: "small", name: "Small", isDefault: true },
      { id: "medium", name: "Medium", price: 10 },
      { id: "large", name: "Large", price: 20 },
    ],
  },

  sweetness: {
    id: "sweetness",
    name: "Sweet Level",
    type: "single",
    required: true,
    options: [
      { id: "0", name: "0%" },
      { id: "25", name: "25%" },
      { id: "50", name: "50%", isDefault: true },
      { id: "75", name: "75%" },
      { id: "100", name: "100%" },
    ],
  },

  ice: {
    id: "ice",
    name: "Ice Level",
    type: "single",
    required: true,
    options: [
      { id: "no_ice", name: "No Ice" },
      { id: "less_ice", name: "Less Ice" },
      { id: "normal_ice", name: "Normal Ice", isDefault: true },
      { id: "extra_ice", name: "Extra Ice" },
    ],
  },

  topping: {
    id: "topping",
    name: "Toppings",
    type: "multiple",
    options: [
      { id: "boba", name: "Boba", price: 10 },
      { id: "cheese_foam", name: "Cheese Foam", price: 15 },
      { id: "whipped_cream", name: "Whipped Cream", price: 10 },
    ],
  },

  syrup: {
    id: "syrup",
    name: "Syrup",
    type: "single",
    options: [
      { id: "caramel", name: "Caramel", price: 10 },
      { id: "mint", name: "Mint", price: 10 },
      { id: "honey", name: "Honey", price: 10 },
    ],
  },

  addon: {
    id: "addon",
    name: "Add-ons",
    type: "multiple",
    options: [
      { id: "extra_shot", name: "Extra Shot", price: 20 },
      { id: "oat_milk", name: "Oat Milk", price: 15 },
      { id: "extra_syrup", name: "Extra Syrup", price: 10 },
    ],
  },
};
/* =========================
   ITEM → OPTION MAPPING
========================= */

export const itemOptionMap: Record<string, string[]> = {
  // Coffee
  "1": ["size"], // Espresso
  "2": ["size", "sweetness", "ice"], // Cappuccino
  "3": ["size", "sweetness", "ice", "addon", "syrup"],
  "4": ["size"], // Americano
  "5": ["size", "sweetness", "addon"], // Mocha
  "6": ["size", "ice"], // Cold Brew

  // Food
  "7": ["addon"], // Croissant
  "8": ["addon"], // Bagel
  "9": ["addon"], // Sandwich

  // Drinks
  "12": ["sweetness"], // Orange Juice
  "13": ["sweetness", "topping"], // Smoothie
  "14": ["sweetness", "ice"], // Iced Tea

  // Desserts
  "16": ["topping"], // Cheesecake

  // Others = no options
};

export const getOptionsForProduct = (productId: string): OptionGroup[] => {
  const groupIds = itemOptionMap[productId] || [];

  return groupIds.map((id) => optionGroups[id]).filter(Boolean);
};

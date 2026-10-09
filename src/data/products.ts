export interface Product {
  id: string;
  /** SKU / product code. Optional, used for barcode scan & quick lookup. */
  code?: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  /** When false, hidden from POS menu. Undefined = active. */
  active?: boolean;
}

export interface CartOption {
  groupId: string;
  groupName: string;
  optionId?: string;
  optionName?: string;
  price: number;
}

export type DiscountScope = "unit" | "line"; // optional but clean

export type CartItem = {
  id: string;

  productId?: string;
  isCustom?: boolean;

  name: string;
  description?: string;
  note?: string;
  image?: string;

  quantity: number;
  basePrice: number;
  optionPrice: number;

  options?: CartOption[];

  discountType?: "amount" | "percent" | null;
  discountValue?: number;
  discountScope?: DiscountScope;

  inputMode?: "amount" | "percent" | "target";
  inputValue?: number;
  lineTarget?: number | null;

  isFree?: boolean;
};

export const categories = [
  "All",
  "Coffee",
  "Food",
  "Drinks",
  "Desserts",
  "Extras",
  "Onetime Item",
];

export const products: Product[] = [
  // Coffee
  {
    id: "1",
    code: "COF-001",
    name: "Espresso",
    description:
      "Strong and bold shot of pure coffee, rich in flavor and aroma.",
    price: 70,
    category: "Coffee",
    image: "https://picsum.photos/seed/espresso/100",
  },
  {
    id: "2",
    code: "COF-002",
    name: "Cappuccino",
    description: "Espresso with steamed milk and thick foam.",
    price: 90,
    category: "Coffee",
    image: "https://picsum.photos/seed/cappuccino/100",
  },
  {
    id: "3",
    code: "COF-003",
    name: "Latte",
    description: "Creamy espresso with steamed milk.",
    price: 95,
    category: "Coffee",
    image: "https://picsum.photos/seed/latte/100",
  },
  {
    id: "4",
    code: "COF-004",
    name: "Americano",
    description: "Smooth black coffee.",
    price: 65,
    category: "Coffee",
  },
  {
    id: "5",
    code: "COF-005",
    name: "Mocha",
    description: "Chocolate espresso drink.",
    price: 100,
    category: "Coffee",
    image: "https://picsum.photos/seed/mocha/100",
  },
  {
    id: "6",
    code: "COF-006",
    name: "Cold Brew",
    description: "Smooth cold coffee.",
    price: 85,
    category: "Coffee",
    image: "https://picsum.photos/seed/coldbrew/100",
  },

  // Food
  {
    id: "7",
    code: "FOOD-007",
    name: "Croissant",
    description: "Flaky buttery pastry.",
    price: 60,
    category: "Food",
    image: "https://picsum.photos/seed/croissant/100",
  },
  {
    id: "8",
    code: "FOOD-008",
    name: "Bagel",
    description: "Chewy baked bread.",
    price: 70,
    category: "Food",
    image: "https://picsum.photos/seed/bagel/100",
  },
  {
    id: "9",
    code: "FOOD-009",
    name: "Sandwich",
    description: "Fresh savory sandwich.",
    price: 120,
    category: "Food",
    image: "https://picsum.photos/seed/sandwich/100",
  },
  {
    id: "10",
    code: "FOOD-010",
    name: "Salad Bowl",
    description: "Healthy mixed greens.",
    price: 140,
    category: "Food",
    image: "https://picsum.photos/seed/salad/100",
  },
  {
    id: "11",
    code: "FOOD-011",
    name: "Wrap",
    description: "Tortilla wrap with filling.",
    price: 110,
    category: "Food",
    image: "https://picsum.photos/seed/wrap/100",
  },

  // Drinks
  {
    id: "12",
    code: "DRK-012",
    name: "Orange Juice",
    description: "Fresh juice.",
    price: 80,
    category: "Drinks",
    image: "https://picsum.photos/seed/orangejuice/100",
  },
  {
    id: "13",
    code: "DRK-013",
    name: "Smoothie",
    description: "Blended fruits.",
    price: 110,
    category: "Drinks",
    image: "https://picsum.photos/seed/smoothie/100",
  },
  {
    id: "14",
    code: "DRK-014",
    name: "Iced Tea",
    description: "Refreshing tea.",
    price: 60,
    category: "Drinks",
    image: "https://picsum.photos/seed/icedtea/100",
  },
  {
    id: "15",
    code: "DRK-015",
    name: "Sparkling Water",
    description: "Carbonated water.",
    price: 40,
    category: "Drinks",
    image: "https://picsum.photos/seed/water/100",
  },

  // Desserts
  {
    id: "16",
    code: "DES-016",
    name: "Cheesecake",
    description: "Rich creamy cake.",
    price: 120,
    category: "Desserts",
    image: "https://picsum.photos/seed/cheesecake/100",
  },
  {
    id: "17",
    code: "DES-017",
    name: "Brownie",
    description: "Chocolate dessert.",
    price: 70,
    category: "Desserts",
    image: "https://picsum.photos/seed/brownie/100",
  },
  {
    id: "18",
    code: "DES-018",
    name: "Cookie",
    description: "Sweet cookie.",
    price: 40,
    category: "Desserts",
    image: "https://picsum.photos/seed/cookie/100",
  },
  {
    id: "19",
    code: "DES-019",
    name: "Muffin",
    description: "Soft baked muffin.",
    price: 60,
    category: "Desserts",
    image: "https://picsum.photos/seed/muffin/100",
  },

  // Extras
  {
    id: "20",
    code: "EXT-020",
    name: "Extra Shot",
    description: "Extra espresso.",
    price: 20,
    category: "Extras",
    image: "https://picsum.photos/seed/extrashot/100",
  },
  {
    id: "21",
    code: "EXT-021",
    name: "Oat Milk",
    description: "Plant-based milk.",
    price: 15,
    category: "Extras",
    image: "https://picsum.photos/seed/oatmilk/100",
  },
  {
    id: "22",
    code: "EXT-022",
    name: "Syrup",
    description: "Flavor syrup.",
    price: 10,
    category: "Extras",
    image: "https://picsum.photos/seed/syrup/100",
  },
];

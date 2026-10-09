## Promotion Settings

Build a "Promotions" entry under Settings with the same look & flow as **Bank Accounts** and **Master**. Functionality mirrors the reference code (5 promo types, 2 reward types, schedule), redesigned with the existing design system (semantic tokens, sheets, cards, lucide icons, Switch, etc).

### Scope (this task)

CRUD + management UI only. Auto-applying promotions to the live cart at checkout is a separate follow-up — I'll flag it but not build it now to keep this focused.

### Data model

`src/features/pos/promotions/PromotionsProvider.tsx` — context + `localStorage` persistence (mirrors `BankAccountsProvider`).

```ts
type PromoType = "normal" | "buy_get" | "bill_amount" | "first_n" | "time_period";
type RewardType = "discount" | "free_item";
type Weekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

interface Promotion {
  id: string;
  name: string;
  description?: string;
  promoType: PromoType;
  rewardType: RewardType | null;
  isActive: boolean;
  conditions: {
    buyItemId?: string; buyQty?: number;
    minBill?: number; maxBill?: number;
    orderQuota?: number;
    startTime?: string; endTime?: string; // HH:mm
  };
  reward: {
    discountPercent?: number; discountFixed?: number;
    freeItemId?: string; freeQty?: number;
  };
  schedule: { days: Weekday[]; startDate?: string; endDate?: string };
  displayOrder: number;
}
```

API: `promotions`, `addPromotion`, `updatePromotion`, `removePromotion`, `togglePromotionActive`, `reorderPromotions`. Seeded with 2–3 sample promos.

### UI components

1. `PromotionsView.tsx` — list screen, Bank-Accounts-style:
   - Sticky header with back button + "Settings / Promotions" title
   - Search bar + circular `+` add button
   - Sortable list (`@dnd-kit`) of promo cards: icon by type (Gift / ShoppingBag / Receipt / Hash / Clock), name, type label + summary line, active `Switch`, edit/delete buttons
   - Empty state + "Add Promotion" dashed button (same pattern as bank list)

2. `PromotionEditorSheet.tsx` — full-screen `BaseSheet` form using `SheetHeader` / `SheetFooter`:
   - Sections: **Basics** (Name, Description, Active Switch)
   - **Promotion Type** (Select with 5 options)
   - **Conditions** — dynamic by type, using the existing `ProductPickerDialog` for buy/free item selection:
     - Normal Reward → reward block only
     - Buy A Get Reward → Buy item + qty
     - Bill Amount → min/max bill THB
     - First XX Order → quota
     - Time Period → start/end time
   - **Reward** — `RewardType` segmented selector (Discount / Free Item), then either Percent + Fixed THB pair (mutually exclusive) or Free Item picker + qty
   - **Schedule** — "Every day" Switch + weekday chip grid + start/end date pair (with end ≥ start validation, same UX as reference)
   - Footer: Cancel + Save buttons, delete in the header for edit mode (matches `AccountEditorSheet`)
   - Inline validation; toast on save/delete via sonner

### Wiring

- `Index.tsx`: register `PromotionsProvider`, add `showPromotions` route state and render `<PromotionsView onBack={…}/>` similar to `BankAccountsView`.
- `SettingsView.tsx`: add a "Promotions" entry below "Bank Account" using `Tag`/`Gift` icon, calling a new `onOpenPromotions` prop.

### Files

```text
src/features/pos/promotions/
  PromotionsProvider.tsx       (new)
  PromotionsView.tsx           (new)
  PromotionEditorSheet.tsx     (new)
  promotionMeta.ts             (new — type labels, icons, summary helper)
src/features/pos/settings/SettingsView.tsx   (edit — add entry)
src/pages/Index.tsx                           (edit — provider + route)
```

### Out of scope (next step)

Evaluating promotions in the cart / checkout flow (matching items, choosing best promo, generating free-item lines, validating schedule against `Date.now()`). Happy to build that next as a focused task.

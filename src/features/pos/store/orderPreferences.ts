export type OrderMode = "takeaway" | "dine_in";
export interface OrderPreferences {
  takeawayEnabled: boolean;
  dineInEnabled: boolean;
  defaultOrderMode: OrderMode;
  requireTable: boolean;
}
export function orderPreferences(value?: Partial<OrderPreferences> | null): OrderPreferences {
  const takeawayEnabled = value?.takeawayEnabled !== false;
  const dineInEnabled = value?.dineInEnabled !== false || !takeawayEnabled;
  const requested = value?.defaultOrderMode ?? "dine_in";
  const defaultOrderMode = requested === "takeaway" && takeawayEnabled ? "takeaway"
    : requested === "dine_in" && dineInEnabled ? "dine_in"
    : takeawayEnabled ? "takeaway" : "dine_in";
  return { takeawayEnabled, dineInEnabled, defaultOrderMode, requireTable: value?.requireTable !== false };
}

/** Current branch settings govern every explicit order-type change. */
export function isOrderModeEnabled(prefs: OrderPreferences, mode: OrderMode): boolean {
  return mode === "takeaway" ? prefs.takeawayEnabled : prefs.dineInEnabled;
}

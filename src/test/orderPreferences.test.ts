import { describe, expect, it } from "vitest";
import { orderPreferences } from "../features/pos/store/orderPreferences";

describe("branch order preferences", () => {
  it("keeps legacy branches enabled for both types", () => {
    expect(orderPreferences()).toMatchObject({ takeawayEnabled: true, dineInEnabled: true, defaultOrderMode: "dine_in" });
  });
  it("moves the default to takeaway when dine-in is disabled", () => {
    expect(orderPreferences({ dineInEnabled: false, defaultOrderMode: "dine_in" }).defaultOrderMode).toBe("takeaway");
  });
  it("moves the default to dine-in when takeaway is disabled", () => {
    expect(orderPreferences({ takeawayEnabled: false, defaultOrderMode: "takeaway" }).defaultOrderMode).toBe("dine_in");
  });
  it("repairs invalid settings with both service types disabled", () => {
    expect(orderPreferences({ takeawayEnabled: false, dineInEnabled: false }).dineInEnabled).toBe(true);
  });
  it("allows dine-in without numbered tables", () => {
    expect(orderPreferences({ requireTable: false }).requireTable).toBe(false);
  });
});

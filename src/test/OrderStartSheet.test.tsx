import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderStartSheet from "../features/pos/tables/OrderStartSheet";

vi.mock("../features/pos/store/StoreProvider", () => ({
  useStores: () => ({ stores: [{ id: "branch2", orderPreferences: { dineInEnabled: false } }] }),
}));
vi.mock("../features/pos/tables/TablesProvider", () => ({
  useTables: () => ({ tablesForStore: () => [] }),
  groupByZone: () => [],
  groupByType: () => [],
}));
vi.mock("../features/pos/shared/BaseSheet", () => ({
  BaseSheet: ({ children }: { children: (props: object) => React.ReactNode }) => children({}),
}));
vi.mock("../features/pos/shared/SheetHeader", () => ({ SheetHeader: () => null }));

describe("cart order type respects branch preferences", () => {
  it.each(["takeaway", "dine_in"] as const)("never offers disabled dine-in for an initial %s cart", (mode) => {
    const onConfirm = vi.fn();
    const view = render(<OrderStartSheet open isOpening={false} isClosing={false}
      onClose={() => {}} storeId="branch2" initial={{ mode, guests: 2 }}
      busy={{}} onConfirm={onConfirm} onOpenBusy={() => {}} />);
    expect(screen.queryByRole("button", { name: "Dine-in" })).toBeNull();
    expect(screen.queryByText("Guests")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onConfirm).toHaveBeenCalledWith({ mode: "takeaway" });
    view.unmount();
  });
});

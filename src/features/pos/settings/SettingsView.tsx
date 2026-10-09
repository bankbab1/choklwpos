import {
  User,
  Store,
  Receipt,
  Bell,
  HelpCircle,
  LogOut,
  Package,
  Tag,
  ChevronRight,
  Landmark,
  Gift,
  LayoutGrid,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onOpenMaster?: () => void;
  onOpenCategoryMaster?: () => void;
  onOpenBankAccounts?: () => void;
  onOpenStores?: () => void;
  onOpenReceiptTemplate?: () => void;
  onOpenPromotions?: () => void;
  onOpenDiscountMaster?: () => void;
  onOpenTables?: () => void;
}

type Row = {
  icon: LucideIcon;
  label: string;
  desc: string;
  onClick?: () => void;
  tone?: "primary" | "muted";
  disabled?: boolean;
};

type Section = {
  title: string;
  rows: Row[];
};

const SettingsView = ({
  onOpenMaster,
  onOpenCategoryMaster,
  onOpenBankAccounts,
  onOpenStores,
  onOpenReceiptTemplate,
  onOpenPromotions,
  onOpenDiscountMaster,
  onOpenTables,
}: Props) => {
  const sections: Section[] = [
    {
      title: "Catalog",
      rows: [
        {
          icon: Package,
          label: "Product Master",
          desc: "Manage products & option library",
          onClick: onOpenMaster,
          tone: "primary",
        },
        {
          icon: Tag,
          label: "Category Master",
          desc: "Manage menu categories & order",
          onClick: onOpenCategoryMaster,
          tone: "primary",
        },
        {
          icon: Tag,
          label: "Discount Master",
          desc: "Per-product discounted prices",
          onClick: onOpenDiscountMaster,
          tone: "primary",
        },
      ],
    },
    {
      title: "Sales",
      rows: [
        {
          icon: Gift,
          label: "Promotions",
          desc: "Discounts, free items & schedules",
          onClick: onOpenPromotions,
          tone: "primary",
        },
        {
          icon: Landmark,
          label: "Bank Account",
          desc: "Manage payment receiving accounts",
          onClick: onOpenBankAccounts,
          tone: "primary",
        },
      ],
    },
    {
      title: "Store",
      rows: [
        {
          icon: Store,
          label: "Stores",
          desc: "Branches, address & receipt info",
          onClick: onOpenStores,
          tone: "primary",
        },
        {
          icon: LayoutGrid,
          label: "Tables",
          desc: "Tables, zones & seats per branch",
          onClick: onOpenTables,
          disabled: !onOpenTables,
          tone: "primary",
        },
        {
          icon: Receipt,
          label: "Receipt Template",
          desc: "Customize bill & receipt layout",
          onClick: onOpenReceiptTemplate,
          tone: "primary",
        },
        { icon: Receipt, label: "Tax & Receipts", desc: "Configure tax rates", disabled: true },
        { icon: Bell, label: "Notifications", desc: "Alert preferences", disabled: true },
      ],
    },
    {
      title: "Account",
      rows: [
        { icon: User, label: "Profile", desc: "Manage your account", disabled: true },
        { icon: HelpCircle, label: "Help & Support", desc: "Get assistance", disabled: true },
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header — same compact subpage style as Master */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/10 shrink-0">
            <SettingsIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">
              Workspace
            </p>
            <h1 className="text-lg font-bold text-foreground truncate leading-tight mt-0.5">
              Settings
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-[calc(96px+env(safe-area-inset-bottom))] space-y-6">
        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </h2>
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {section.rows.filter((row) => row.label !== "Tables" || !!onOpenTables).map((row) => {
                const Icon = row.icon;
                const isPrimary = row.tone === "primary";
                return (
                  <button
                    key={row.label}
                    onClick={row.onClick}
                    disabled={row.disabled}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-3.5 text-left transition active:bg-muted/60",
                      row.disabled && "opacity-50 cursor-not-allowed active:bg-transparent",
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                        isPrimary
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {row.label}
                        </p>
                        {row.disabled && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Soon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {row.desc}
                      </p>
                    </div>
                    {!row.disabled && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {/* Sign out */}
        <section className="pt-2">
          <button className="flex items-center justify-center gap-2 w-full rounded-2xl bg-card border border-destructive/30 px-4 py-3.5 text-destructive font-semibold text-sm hover:bg-destructive/5 active:scale-[0.99] transition">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
          <p className="text-center text-[10px] text-muted-foreground mt-3">
            Point of Joy · v1.0
          </p>
        </section>
      </main>
    </div>
  );
};

export default SettingsView;

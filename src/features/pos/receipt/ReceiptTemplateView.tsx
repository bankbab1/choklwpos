import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Receipt as ReceiptIcon, Plus, Star, Pencil, Store as StoreIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStores } from "@/features/pos/store/StoreProvider";
import {
    useBankAccounts,
    BANK_META,
} from "@/features/pos/bank/BankAccountsProvider";
import {
    ReceiptTemplate,
    useReceiptTemplate,
    DEFAULT_TEMPLATE,
    NamedTemplate,
    createTemplate,
} from "@/features/pos/receipt/ReceiptTemplateProvider";
import ReceiptDocument, {
    shopInfoFromStore,
} from "@/features/pos/receipt/ReceiptDocument";
import type { ReceiptPayment } from "@/features/pos/receipt/ReceiptDocument";
import { CartItem } from "@/data/products";

interface Props {
    onBack: () => void;
}

interface EditorProps {
    templateId: string | null;
    onBack: () => void;
}

const sampleItems: CartItem[] = [
    {
        id: "demo-1",
        productId: "p1",
        name: "Iced Latte",
        basePrice: 95,
        optionPrice: 10,
        quantity: 2,
        options: [
            { groupId: "g1", groupName: "Size", optionId: "o1", optionName: "Large", price: 10 },
        ],
    } as CartItem,
    {
        id: "demo-2",
        productId: "p2",
        name: "Butter Croissant",
        basePrice: 75,
        optionPrice: 0,
        quantity: 1,
    } as CartItem,
];

const SectionCard = ({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) => (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <header className="px-4 pt-3 pb-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {title}
            </h2>
            {subtitle && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
        </header>
        <div className="divide-y divide-border">{children}</div>
    </section>
);

const ToggleRow = ({
    label,
    desc,
    checked,
    onChange,
}: {
    label: string;
    desc?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) => (
    <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
    </label>
);

const TextRow = ({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) => (
    <div className="px-4 py-3 space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-10"
        />
    </div>
);

const ReceiptTemplateEditor = ({ templateId, onBack }: EditorProps) => {
    const { templates, saveTemplate, deleteTemplate, defaultId } = useReceiptTemplate();
    const [original] = useState<NamedTemplate>(
        () => templates.find((t) => t.id === templateId) ?? createTemplate(`Template ${templates.length + 1}`),
    );
    const isNew = !templates.some((t) => t.id === original.id);
    const isDefaultTpl = original.id === defaultId;
    const template = original;
    const { stores } = useStores();
    const { defaultAccount, accounts } = useBankAccounts();
    const confirm = useConfirm();
    const [previewMode, setPreviewMode] = useState<"bill" | "receipt">("receipt");
    const [draft, setDraft] = useState<NamedTemplate>(template);

    const billQrAccount =
        (defaultAccount && defaultAccount.enabled && defaultAccount.bank && defaultAccount.type
            ? defaultAccount
            : null) ?? accounts.find((a) => a.enabled && a.bank && a.type);
    const billPreviewPayment: ReceiptPayment | undefined = billQrAccount
        ? {
              method: "qr",
              bankName: billQrAccount.bank ? BANK_META[billQrAccount.bank]?.name : undefined,
              accountName: billQrAccount.name,
              accountRef: billQrAccount.ref,
              bank: billQrAccount.bank ?? undefined,
              type: billQrAccount.type ?? undefined,
          }
        : undefined;

    const isDirty = useMemo(
        () => isNew || JSON.stringify(draft) !== JSON.stringify(template),
        [draft, template],
    );

    const set = <K extends keyof NamedTemplate>(k: K, v: NamedTemplate[K]) =>
        setDraft((prev) => ({ ...prev, [k]: v }));

    const previewShop = useMemo(() => {
        const store =
            (draft.storeIds[0] && stores.find((s) => s.id === draft.storeIds[0])) ||
            (draft.defaultStoreId &&
                stores.find((s) => s.id === draft.defaultStoreId)) ||
            stores.find((s) => s.enabled) ||
            stores[0];
        return shopInfoFromStore(store);
    }, [draft.defaultStoreId, draft.storeIds, stores]);

    const handleSave = () => {
        if (!draft.name.trim()) {
            toast.error("Template name is required");
            return;
        }
        saveTemplate({ ...draft, name: draft.name.trim() });
        toast.success(isNew ? "Template created" : "Template updated");
        onBack();
    };

    const handleReset = () =>
        confirm({
            title: "Reset receipt template?",
            description: "All toggles and document labels will return to defaults.",
            confirmText: "Reset",
            variant: "destructive",
            onConfirm: () => {
                setDraft((d) => ({ ...DEFAULT_TEMPLATE, id: d.id, name: d.name, storeIds: d.storeIds }));
                toast.success("Toggles reset — tap Update to keep");
            },
        });

    const handleBack = () => {
        if (isDirty) {
            confirm({
                title: "Discard unsaved changes?",
                description: "You have unsaved changes to the receipt template.",
                confirmText: "Discard",
                cancelText: "Keep editing",
                variant: "destructive",
                onConfirm: onBack,
            });
        } else {
            onBack();
        }
    };

    return (
        <div className="h-full flex flex-col bg-background">
            <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
                <div className="flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={handleBack}
                        className="h-9 w-9 flex items-center justify-center rounded-full bg-card border border-border active:scale-95 shrink-0"
                        aria-label="Back to settings"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">
                            Settings
                        </p>
                        <h1 className="text-lg font-bold text-foreground truncate leading-tight mt-0.5">
                            {draft.name || "Receipt Template"}
                            {isDirty && (
                                <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500 align-middle" />
                            )}
                        </h1>
                    </div>
                    <button
                        onClick={handleReset}
                        className="h-9 px-3 rounded-full bg-card border border-border text-xs font-medium flex items-center gap-1.5 active:scale-95"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-4 space-y-4">
                {/* Live preview */}
                <section className="rounded-2xl border border-border bg-muted/40 overflow-hidden">
                    <header className="px-4 pt-3 pb-2 flex items-center gap-2">
                        <ReceiptIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex-1">
                            Live Preview — {previewMode === "bill" ? "Bill" : "Receipt"}
                        </h2>
                    </header>
                    <div className="px-3 pb-3">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {(["bill", "receipt"] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setPreviewMode(m)}
                                    className={cn(
                                        "h-9 rounded-lg border text-xs font-semibold uppercase tracking-wide transition",
                                        previewMode === m
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-card text-foreground",
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                        <div className="mx-auto max-w-[340px] bg-white rounded-xl shadow-sm border border-border/60 overflow-hidden">
                            <ReceiptDocument
                                mode={previewMode}
                                items={sampleItems}
                                orderId={previewMode === "bill" ? "BILL-PREVIEW-001" : "ORD-PREVIEW-001"}
                                issuedAt={new Date()}
                                payment={previewMode === "receipt" ? { method: "cash" } : billPreviewPayment}
                                shopOverride={previewShop}
                                templateOverride={draft}
                            />
                        </div>
                    </div>
                </section>

                {/* Name + branch assignment */}
                <SectionCard
                    title="Template & Branches"
                    subtitle="Each branch uses one template. Branches not assigned anywhere use the default template."
                >
                    <div className="px-4 py-3 space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">Template name</p>
                        <Input
                            value={draft.name}
                            maxLength={30}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="e.g. Standard, Kiosk"
                            className="h-10"
                        />
                    </div>
                    {stores.map((s) => {
                        const checked = draft.storeIds.includes(s.id);
                        const owner = templates.find((t) => t.id !== draft.id && t.storeIds.includes(s.id));
                        return (
                            <label key={s.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {s.branchShortCode || s.name || "Untitled"}
                                        {s.branchName ? ` · ${s.branchName}` : ""}
                                    </p>
                                    {owner && !checked && (
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Currently uses "{owner.name}" — ticking moves it here
                                        </p>
                                    )}
                                </div>
                                <Switch
                                    checked={checked}
                                    onCheckedChange={(v) =>
                                        set(
                                            "storeIds",
                                            v ? [...draft.storeIds, s.id] : draft.storeIds.filter((x) => x !== s.id),
                                        )
                                    }
                                />
                            </label>
                        );
                    })}
                </SectionCard>

                {/* Default Store */}
                <SectionCard
                    title="Default Store"
                    subtitle="All wording — logo, name, address, contact, headline, QR caption, footer — comes from the selected Store. Edit it in Settings → Stores."
                >
                    <div className="px-4 py-3 space-y-1.5">
                        <Select
                            value={draft.defaultStoreId ?? "__auto__"}
                            onValueChange={(v) =>
                                set("defaultStoreId", v === "__auto__" ? null : v)
                            }
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Auto (first active)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__auto__">Auto · first active store</SelectItem>
                                {stores.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name || "Untitled"} {s.branch ? `· ${s.branch}` : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </SectionCard>

                {/* Header sections */}
                <SectionCard
                    title="Header"
                    subtitle="Toggle what shows at the top. Content comes from Settings → Stores."
                >
                    <ToggleRow
                        label="Logo"
                        desc="From Store → Store logo"
                        checked={draft.showLogo}
                        onChange={(v) => set("showLogo", v)}
                    />
                    <ToggleRow
                        label="Shop name"
                        desc="From Store → Basic info → Store name"
                        checked={draft.showShopName}
                        onChange={(v) => set("showShopName", v)}
                    />
                    <ToggleRow
                        label="Branch"
                        desc="From Store → Basic info → Branch"
                        checked={draft.showBranch}
                        onChange={(v) => set("showBranch", v)}
                    />
                    <ToggleRow
                        label="Headline / tagline"
                        desc="From Store → Basic info → Headline / tagline"
                        checked={draft.showHeadline}
                        onChange={(v) => set("showHeadline", v)}
                    />
                    <ToggleRow
                        label="Address lines"
                        desc="From Store → Address (lines 1–4)"
                        checked={draft.showAddress}
                        onChange={(v) => set("showAddress", v)}
                    />
                    <ToggleRow
                        label="Contact"
                        desc="From Store → Contact (Phone, Tax ID, Website)"
                        checked={draft.showContact}
                        onChange={(v) => set("showContact", v)}
                    />
                </SectionCard>

                {/* Meta rows */}
                <SectionCard
                    title="Order Info"
                    subtitle="Auto-generated per order — not editable in Store."
                >
                    <ToggleRow
                        label="Order number"
                        checked={draft.showOrderNo}
                        onChange={(v) => set("showOrderNo", v)}
                    />
                    <ToggleRow
                        label="Reference"
                        checked={draft.showRef}
                        onChange={(v) => set("showRef", v)}
                    />
                    <ToggleRow
                        label="Date & time"
                        checked={draft.showDate}
                        onChange={(v) => set("showDate", v)}
                    />
                    <ToggleRow
                        label="Cashier"
                        checked={draft.showCashier}
                        onChange={(v) => set("showCashier", v)}
                    />
                    <ToggleRow
                        label="Customer"
                        checked={draft.showCustomer}
                        onChange={(v) => set("showCustomer", v)}
                    />
                </SectionCard>

                {/* Body / Footer toggles */}
                <SectionCard
                    title="Body & Footer"
                    subtitle="Toggle what shows below the totals. Content comes from Settings → Stores."
                >
                    <ToggleRow
                        label="Item discount lines"
                        desc="Auto from cart discounts"
                        checked={draft.showItemDiscounts}
                        onChange={(v) => set("showItemDiscounts", v)}
                    />
                    <ToggleRow
                        label="Payment QR on bill"
                        desc={
                            billQrAccount
                                ? `Default account: ${billQrAccount.name || (billQrAccount.bank ? BANK_META[billQrAccount.bank]?.name : "—")}`
                                : "No active bank account — QR will be hidden on the bill until you add one in Settings → Bank Accounts"
                        }
                        checked={draft.showBillPaymentQr}
                        onChange={(v) => set("showBillPaymentQr", v)}
                    />
                    {draft.showBillPaymentQr && !billQrAccount && (
                        <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 flex items-start gap-2">
                            <span className="text-amber-600 text-sm leading-none mt-0.5">⚠</span>
                            <p className="text-[11px] text-amber-800 leading-snug">
                                Payment QR is enabled but will be <strong>hidden</strong> on bills
                                because no active bank account is set as default. Add or enable
                                one in <strong>Settings → Bank Accounts</strong>.
                            </p>
                        </div>
                    )}
                    <ToggleRow
                        label="Order-lookup QR"
                        desc="Small staff-side QR on the bill (for table lookup at the counter) and on the receipt — visually separated from the payment QR"
                        checked={draft.showQr}
                        onChange={(v) => set("showQr", v)}
                    />
                    {draft.showQr && (
                        <TextRow
                            label="Order-lookup QR caption"
                            value={draft.qrCaption}
                            onChange={(v) => set("qrCaption", v)}
                            placeholder="e.g. Scan to look up this order"
                        />
                    )}
                    <ToggleRow
                        label="Footer message"
                        desc="From Store → Receipt footer / Bill footer (Title, Subtitle, Footer note 1 & 2)"
                        checked={draft.showFooter}
                        onChange={(v) => set("showFooter", v)}
                    />
                </SectionCard>

                {/* Document-type labels */}
                <SectionCard
                    title="Document Labels"
                    subtitle="Describes the document state — not store branding."
                >
                    <TextRow
                        label="Bill title"
                        value={draft.billTitle}
                        onChange={(v) => set("billTitle", v)}
                        placeholder="BILL"
                    />
                    <TextRow
                        label="Receipt title"
                        value={draft.receiptTitle}
                        onChange={(v) => set("receiptTitle", v)}
                        placeholder="RECEIPT"
                    />
                    <TextRow
                        label="Bill sub-label"
                        value={draft.billSubLabel}
                        onChange={(v) => set("billSubLabel", v)}
                        placeholder="Not yet paid"
                    />
                    <TextRow
                        label="Receipt — cash label"
                        value={draft.receiptCashLabel}
                        onChange={(v) => set("receiptCashLabel", v)}
                        placeholder="Paid by Cash"
                    />
                    <TextRow
                        label="Receipt — QR label"
                        value={draft.receiptQrLabel}
                        onChange={(v) => set("receiptQrLabel", v)}
                        placeholder="Paid by QR"
                    />
                </SectionCard>

                {/* Style */}
                <SectionCard title="Paper & Text">
                    <div className="px-4 py-3 space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">Paper width</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(["narrow", "wide"] as const).map((w) => (
                                <button
                                    key={w}
                                    type="button"
                                    onClick={() => set("paperWidth", w)}
                                    className={cn(
                                        "h-10 rounded-lg border text-sm font-medium capitalize transition",
                                        draft.paperWidth === w
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-card text-foreground",
                                    )}
                                >
                                    {w === "narrow" ? "Narrow (58mm)" : "Wide (80mm)"}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">Text size</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(["sm", "md", "lg"] as const).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => set("textScale", s)}
                                    className={cn(
                                        "h-10 rounded-lg border text-sm font-medium uppercase transition",
                                        draft.textScale === s
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-card text-foreground",
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </SectionCard>

                {!isNew && !isDefaultTpl && (
                    <Button
                        type="button"
                        variant="destructive"
                        className="w-full h-12 font-semibold"
                        onClick={() =>
                            confirm({
                                title: `Delete "${original.name}"?`,
                                description: "Its branches will fall back to the default template.",
                                confirmText: "Delete",
                                variant: "destructive",
                                onConfirm: () => {
                                    deleteTemplate(original.id);
                                    toast.success("Template deleted");
                                    onBack();
                                },
                            })
                        }
                    >
                        Delete template
                    </Button>
                )}
            </main>

            <footer className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-xl border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 font-semibold"
                        onClick={handleBack}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="h-12 font-semibold"
                        disabled={!isDirty}
                        onClick={handleSave}
                    >
                        {isNew ? "Save" : isDirty ? "Update" : "Saved"}
                    </Button>
                </div>
            </footer>
        </div>
    );
};

const ReceiptTemplateView = ({ onBack }: Props) => {
    const { templates, defaultId, setDefaultTemplate } = useReceiptTemplate();
    const { stores } = useStores();
    const [editing, setEditing] = useState<string | null | undefined>(undefined);

    if (editing !== undefined) {
        return <ReceiptTemplateEditor templateId={editing} onBack={() => setEditing(undefined)} />;
    }

    const assigned = new Set(templates.flatMap((t) => t.storeIds));
    const storeLabel = (id: string) => {
        const s = stores.find((x) => x.id === id);
        return s ? s.branchShortCode || s.name || "Untitled" : null;
    };

    return (
        <div className="h-full flex flex-col bg-background">
            <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
                <div className="flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={onBack}
                        className="h-9 w-9 flex items-center justify-center rounded-full bg-card border border-border active:scale-95 shrink-0"
                        aria-label="Back to settings"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">
                            Settings
                        </p>
                        <h1 className="text-lg font-bold text-foreground truncate leading-tight mt-0.5">
                            Receipt Templates
                        </h1>
                    </div>
                    <Button size="sm" className="h-9 rounded-full" onClick={() => setEditing(null)}>
                        <Plus className="h-4 w-4 mr-1" /> New
                    </Button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-3">
                {templates.map((t) => {
                    const isDef = t.id === defaultId;
                    const labels = t.storeIds.map(storeLabel).filter(Boolean) as string[];
                    const unassigned = stores.filter((s) => !assigned.has(s.id)).length;
                    return (
                        <div key={t.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <ReceiptIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                        <StoreIcon className="h-3 w-3" />
                                        {labels.length
                                            ? labels.join(", ") + (isDef && unassigned > 0 ? ` + ${unassigned} other` : "")
                                            : isDef
                                              ? "All other branches"
                                              : "No branch assigned"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Set as default"
                                    onClick={() => !isDef && setDefaultTemplate(t.id)}
                                    className="h-8 w-8 flex items-center justify-center rounded-full active:scale-95"
                                >
                                    <Star className={cn("h-4 w-4", isDef ? "fill-primary text-primary" : "text-muted-foreground")} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                {isDef && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                        <Check className="h-3 w-3" /> Default
                                    </span>
                                )}
                                <span className="text-[11px] text-muted-foreground">
                                    {t.paperWidth === "wide" ? "Wide" : "Narrow"} paper
                                </span>
                                <div className="flex-1" />
                                <button
                                    type="button"
                                    aria-label="Edit template"
                                    onClick={() => setEditing(t.id)}
                                    className="h-9 w-9 flex items-center justify-center rounded-full bg-muted active:scale-95"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
                <p className="text-[11px] text-muted-foreground px-1">
                    Star marks the default template, used by any branch not assigned to another template.
                </p>
            </main>
        </div>
    );
};

export default ReceiptTemplateView;

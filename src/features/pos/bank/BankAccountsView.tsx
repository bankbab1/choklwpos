import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, Check, AlertTriangle, Plus, Search, X, Landmark, GripVertical, Pencil, Star } from "lucide-react";
import { useConfirm } from "@/hooks/ConfirmProvider";
import {
  ACCOUNT_TYPE_BY_BANK,
  BANK_META,
  BankAccount,
  BankCode,
  AccountType,
  getRefConfig,
  getRefPlaceholder,
  isReferenceValid,
  sanitizeReferenceInput,
  useBankAccounts,
} from "./BankAccountsProvider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { useSheetAnimation } from "@/hooks/useSheetAnimation";
import { RequiredMark, FIELD_LABEL_CLASS } from "@/features/pos/shared/RequiredMark";
import { StatusPill } from "@/features/pos/shared/StatusPill";
import { useStores } from "@/features/pos/store/StoreProvider";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ANIMATION_DURATION = 300;

interface Props {
  onBack: () => void;
}

const BANK_CODES: BankCode[] = ["KBANK", "SCB", "KTB", "BBL"];

const maskRef = (ref: string) => {
  if (!ref) return "";
  if (ref.length <= 4) return ref;
  return `••• ${ref.slice(-4)}`;
};

function BankLogo({ code, size = "md" }: { code: BankCode; size?: "md" | "lg" }) {
  const meta = BANK_META[code];
  const dim = size === "lg" ? "h-12 w-12 text-lg" : "h-10 w-10 text-base";
  return (
    <div className={cn("rounded-xl flex items-center justify-center font-bold text-white shadow-sm", meta.color, dim)}>
      {meta.short}
    </div>
  );
}

const BankAccountsView = ({ onBack }: Props) => {
  const { accounts, defaultId, setDefaultAccount, addAccount, updateAccount, removeAccount, reorderAccounts } = useBankAccounts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const editorSheet = useSheetAnimation(ANIMATION_DURATION);
  const confirm = useConfirm();

  const editing = useMemo(
    () => (editingId ? accounts.find((a) => a.id === editingId) ?? null : null),
    [accounts, editingId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => {
      const bankName = a.bank ? BANK_META[a.bank].name.toLowerCase() : "";
      return (
        a.name.toLowerCase().includes(q) ||
        bankName.includes(q) ||
        a.ref.toLowerCase().includes(q)
      );
    });
  }, [accounts, search]);

  const openEditor = (id: string) => {
    setEditingId(id);
    editorSheet.openSheet();
  };

  const closeEditor = (opts?: { discardIfEmpty?: boolean }) => {
    if (opts?.discardIfEmpty && editing) {
      const isEmpty =
        !editing.name.trim() && !editing.bank && !editing.type && !editing.ref;
      if (isEmpty) removeAccount(editing.id);
    }
    editorSheet.closeSheet();
    setTimeout(() => setEditingId(null), ANIMATION_DURATION);
  };

  const handleAdd = () => {
    const acc = addAccount();
    openEditor(acc.id);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header (matches Master/Category pattern) */}
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
              Bank Accounts
            </h1>
          </div>
        </div>

        {/* Search + Add */}
        <div className="px-3 pb-3 flex items-center gap-2">
          <div className="relative flex-1 flex items-center bg-secondary rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts..."
              className="flex-1 bg-transparent text-[16px] outline-none pr-7 min-w-0"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 h-6 w-6 flex items-center justify-center rounded-full bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Add bank account"
            className="shrink-0 h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(80px+env(safe-area-inset-bottom))] space-y-2">
        {filtered.length === 0 && accounts.length > 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            No accounts match "{search}"
          </div>
        )}

        {accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Landmark className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">No bank accounts yet</p>
              <p className="text-xs text-muted-foreground">
                Add an account to start receiving payments.
              </p>
            </div>
          </div>
        )}

        <SortableAccountList
          items={filtered}
          dragEnabled={!search}
          defaultId={defaultId}
          onPick={openEditor}
          onReorder={reorderAccounts}
          onSetDefault={(acc) => {
            if (defaultId === acc.id) {
              toast.info(`${acc.name.trim() || "Account"} is already the default`);
              return;
            }
            if (!acc.enabled) {
              toast.error("Enable this account before setting as default");
              return;
            }
            setDefaultAccount(acc.id);
            toast.success(`${acc.name.trim() || "Account"} set as default`);
          }}
          onToggle={(acc) => {
            updateAccount({ ...acc, enabled: !acc.enabled });
            toast.success(`${acc.name.trim() || "Account"} ${acc.enabled ? "hidden" : "active"}`);
          }}
          onDelete={(acc) => {
            confirm({
              title: `Delete ${acc.name.trim() || "this account"}?`,
              description: "This action cannot be undone.",
              confirmText: "Delete",
              variant: "destructive",
              onConfirm: () => {
                removeAccount(acc.id);
                toast.success("Bank account deleted");
              },
            });
          }}
        />

        {!search && accounts.length > 0 && (
          <button
            onClick={handleAdd}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-transparent p-4 min-h-[64px] text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 active:scale-[0.99] transition"
          >
            <Plus className="h-4 w-4" />
            Add Bank Account
          </button>
        )}
      </main>

      {/* Editor sheet */}
      {(editorSheet.open || editorSheet.isClosing) && editing && (
        <AccountEditorSheet
          account={editing}
          open={editorSheet.open}
          isOpening={editorSheet.isOpening}
          isClosing={editorSheet.isClosing}
          onCancel={() => closeEditor({ discardIfEmpty: true })}
          onSave={(acc) => {
            updateAccount(acc);
            toast.success("Bank account saved");
            closeEditor();
          }}
          onDelete={() => {
            removeAccount(editing.id);
            toast.success("Bank account deleted");
            closeEditor();
          }}
        />
      )}
    </div>
  );
};

// ─── Sortable list ─────────────────────────────────────────────
function SortableAccountList({
  items,
  dragEnabled,
  defaultId,
  onPick,
  onReorder,
  onSetDefault,
  onToggle,
  onDelete,
}: {
  items: BankAccount[];
  dragEnabled: boolean;
  defaultId: string | null;
  onPick: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onSetDefault: (acc: BankAccount) => void;
  onToggle: (acc: BankAccount) => void;
  onDelete: (acc: BankAccount) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div>
          {items.map((acc) => (
            <SortableAccountRow
              key={acc.id}
              id={acc.id}
              disabled={!dragEnabled}
            >
              {({ handleProps, isDragging }) => (
                <AccountCard
                  account={acc}
                  dragEnabled={dragEnabled}
                  isDragging={isDragging}
                  isDefault={defaultId === acc.id}
                  handleProps={handleProps}
                  onPick={() => onPick(acc.id)}
                  onSetDefault={() => onSetDefault(acc)}
                  onToggle={() => onToggle(acc)}
                  onDelete={() => onDelete(acc)}
                />
              )}
            </SortableAccountRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableAccountRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (args: { handleProps: any; isDragging: boolean }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-shadow mb-2",
        isDragging &&
          "z-20 relative ring-2 ring-primary shadow-2xl scale-[1.02] rounded-xl",
      )}
    >
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

function AccountCard({
  account: acc,
  dragEnabled,
  isDragging,
  isDefault,
  handleProps,
  onPick,
  onSetDefault,
  onToggle,
  onDelete,
}: {
  account: BankAccount;
  dragEnabled: boolean;
  isDragging: boolean;
  isDefault: boolean;
  handleProps: any;
  onPick: () => void;
  onSetDefault: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { stores } = useStores();
  const isConfigured = !!acc.bank && !!acc.type && acc.ref.length > 0;
  const canBeDefault = isConfigured && acc.enabled;
  const typeLabel =
    acc.bank && acc.type
      ? ACCOUNT_TYPE_BY_BANK[acc.bank].find((o) => o.value === acc.type)?.label ?? ""
      : "";
  const scoped = (acc.storeIds ?? []).filter((id) => stores.some((s) => s.id === id));
  const branchLabel =
    scoped.length === 0
      ? "All branches"
      : scoped
          .map((id) => {
            const s = stores.find((x) => x.id === id)!;
            return s.branch.trim() || s.name.trim() || "Store";
          })
          .join(", ");



  return (
    <div
      onClick={onPick}
      className={cn(
        "w-full rounded-xl border bg-card p-2 pr-2 flex flex-col gap-2 transition text-left cursor-pointer",
        isDefault ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
        isDragging
          ? "ring-2 ring-primary border-transparent"
          : "active:scale-[0.99] active:ring-2 active:ring-primary active:border-transparent",
        !acc.enabled && "opacity-70",
      )}
    >
      {/* Top row: drag + logo + info + default star */}
      <div className="flex items-center gap-2">
        <div
          {...(dragEnabled ? handleProps : {})}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "h-9 w-5 flex items-center justify-center text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing touch-none",
            !dragEnabled && "opacity-30 cursor-default",
          )}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {isConfigured && acc.bank ? (
          <BankLogo code={acc.bank} />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
            <Landmark className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground truncate">
              {isConfigured && acc.bank ? (
                <>
                  {BANK_META[acc.bank].name}
                  {typeLabel && (
                    <span className="text-foreground/70 font-medium">
                      {" · "}
                      {typeLabel}
                    </span>
                  )}
                </>
              ) : (
                "Unconfigured"
              )}
            </p>
          </div>

          {isConfigured && acc.name && (
            <p className="text-[11px] text-foreground/80 truncate mt-0.5">
              {acc.name.includes(" · ") ? acc.name.split(" · ")[1] : acc.name}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {isConfigured ? (
              <span className="font-mono">{maskRef(acc.ref)}</span>
            ) : (
              <span>Tap to finish setup</span>
            )}
          </p>

          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{branchLabel}</p>
        </div>



        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!canBeDefault) {
              toast.error("Set up and enable this account first");
              return;
            }
            onSetDefault();
          }}
          className={cn(
            "h-9 w-9 flex items-center justify-center rounded-lg shrink-0 active:scale-95 transition",
            isDefault
              ? "bg-primary/15 text-primary"
              : "bg-muted/60 text-muted-foreground hover:text-foreground",
            !canBeDefault && "opacity-40",
          )}
          aria-label={isDefault ? "Unset as default" : "Set as default"}
          title={isDefault ? "Default for bills" : "Set as default for bills"}
        >
          <Star className={cn("h-4 w-4", isDefault && "fill-current")} />
        </button>
      </div>

      {/* Bottom row: active + default badges left, actions right */}
      <div className="flex items-center justify-between gap-2 pl-7">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusPill
            label={acc.enabled ? "Active" : "Off"}
            tone={acc.enabled ? "success" : "neutral"}
            className="shrink-0"
          />
          {isDefault && (
            <StatusPill
              label="Default"
              tone="primary"
              showDot={false}
              icon={<Star className="h-2.5 w-2.5 fill-current" />}
              className="shrink-0"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Switch
              checked={acc.enabled}
              onCheckedChange={onToggle}
              aria-label={acc.enabled ? "Set inactive" : "Set active"}
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPick();
            }}
            className="h-8 w-8 flex items-center justify-center rounded-md bg-muted/60 active:scale-95"
            aria-label="Edit account"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-8 w-8 flex items-center justify-center rounded-md bg-destructive/10 text-destructive active:scale-95"
            aria-label="Delete account"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
}

interface EditorProps {
  account: BankAccount;
  open: boolean;
  isOpening: boolean;
  isClosing: boolean;
  onCancel: () => void;
  onSave: (acc: BankAccount) => void;
  onDelete: () => void;
}

const AccountEditorSheet = ({
  account,
  open,
  isOpening,
  isClosing,
  onCancel,
  onSave,
  onDelete,
}: EditorProps) => {
  const hasExisting =
    account.name.trim() !== "" || account.ref.trim() !== "" || !!account.bank;

  const { stores } = useStores();

  const [label, setLabel] = useState(account.name);
  const [bank, setBank] = useState<BankCode | null>(account.bank);
  const [accountType, setAccountType] = useState<AccountType | null>(account.type);
  const [referenceNo, setReferenceNo] = useState(account.ref);
  const [enabled, setEnabled] = useState(account.enabled);
  const [storeIds, setStoreIds] = useState<string[]>(account.storeIds ?? []);
  const [selectedUI, setSelectedUI] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (account.bank && account.type) {
      const match = ACCOUNT_TYPE_BY_BANK[account.bank].find((t) => t.value === account.type);
      if (match) setSelectedUI(match.uiValue);
    }
  }, [account]);

  const allBranches = storeIds.length === 0;
  const toggleStore = (id: string) =>
    setStoreIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const refConfig = getRefConfig(accountType);
  const refValid = referenceNo.length === 0 ? null : isReferenceValid(accountType, referenceNo);
  const canSave =
    label.trim().length >= 1 &&
    !!bank &&
    !!accountType &&
    isReferenceValid(accountType, referenceNo);

  const allowedTypes = bank ? ACCOUNT_TYPE_BY_BANK[bank] : [];

  const handleSave = () => {
    if (!canSave || !bank || !accountType) return;
    onSave({
      id: account.id,
      name: label.trim(),
      bank,
      type: accountType,
      ref: referenceNo.trim(),
      storeIds: storeIds.filter((id) => stores.some((s) => s.id === id)),
      enabled,
    });
  };


  return (
    <>
      <BaseSheet
        open={open}
        isOpening={isOpening}
        isClosing={isClosing}
        onClose={onCancel}
        variant="full"
      >
        {({ onDragStart, onDragMove, onDragEnd }) => (
          <>
            <SheetHeader
              title={hasExisting ? "Edit Account" : "New Account"}
              onClose={onCancel}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Basic info */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>
                  Basic info
                </h3>
                <div className="space-y-1.5">
                  <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                    Account name
                    <RequiredMark />
                  </label>
                  <Input
                    value={label}
                    maxLength={35}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Mr. Elon"
                    className="h-11"
                  />
                </div>
              </section>

              {/* Bank */}
              <section className="space-y-3">
                <h3 className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                  Bank
                  <RequiredMark />
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {BANK_CODES.map((code) => {
                    const active = bank === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setBank(code);
                          setAccountType(null);
                          setSelectedUI(null);
                          setReferenceNo("");
                        }}
                        className={cn(
                          "relative flex items-center gap-3 rounded-xl border bg-card p-3 transition-all active:scale-[0.97]",
                          active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                        )}
                      >
                        <BankLogo code={code} />
                        <span className="text-sm font-semibold">{BANK_META[code].name}</span>
                        {active && (
                          <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Account type + reference */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>
                  Account details
                </h3>
                <div className="space-y-1.5">
                  <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                    Account type
                    <RequiredMark />
                  </label>
                  <Select
                    value={selectedUI ?? undefined}
                    onValueChange={(uiValue) => {
                      setSelectedUI(uiValue);
                      const opt = allowedTypes.find((t) => t.uiValue === uiValue);
                      if (opt) {
                        setAccountType(opt.value);
                        setReferenceNo(opt.value === "phone" ? "0" : "");
                      }
                    }}
                    disabled={!bank}
                  >
                    <SelectTrigger className={cn("h-11", !bank && "opacity-40")}>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedTypes.map((t) => (
                        <SelectItem key={t.uiValue} value={t.uiValue}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>


                <div className="space-y-1.5">
                  <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                    Reference number
                    <RequiredMark />
                  </label>
                  <Input
                    value={referenceNo}
                    disabled={!accountType}
                    placeholder={getRefPlaceholder(accountType)}
                    inputMode={refConfig.inputMode}
                    maxLength={refConfig.maxLength}
                    onChange={(e) => {
                      let v = sanitizeReferenceInput(accountType, e.target.value);
                      if (accountType === "phone") {
                        if (!v.startsWith("0")) v = "0" + v.replace(/^0+/, "");
                        v = v.slice(0, 10);
                      }
                      setReferenceNo(v);
                    }}
                    className={cn(
                      "h-11 font-mono tracking-wide",
                      refValid === true && "border-emerald-500 focus-visible:ring-emerald-500/30",
                      refValid === false && "border-destructive focus-visible:ring-destructive/30",
                    )}
                  />
                  {refValid === false && (
                    <p className="text-xs text-destructive">
                      Reference does not match expected format.
                    </p>
                  )}
                </div>
              </section>

              {/* Visibility */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Visibility
                </h3>
                <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4">
                  <div>
                    <p className="text-sm font-semibold">Enable Account</p>
                    <p className="text-xs text-muted-foreground">Show in QR payment options</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </section>

              {/* Branches */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>Branches</h3>
                <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setStoreIds([])}
                    className="w-full flex items-center justify-between gap-3 p-3.5 text-left active:bg-muted/50 transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">All branches</p>
                      <p className="text-xs text-muted-foreground">
                        Available at every store, including new ones
                      </p>
                    </div>
                    {allBranches && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>

                  {stores.map((s) => {
                    const checked = storeIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStore(s.id)}
                        className="w-full flex items-center justify-between gap-3 p-3.5 text-left active:bg-muted/50 transition"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {s.name.trim() || "Untitled store"}
                          </p>
                          {s.branch.trim() && (
                            <p className="text-xs text-muted-foreground truncate">{s.branch}</p>
                          )}
                        </div>
                        <div
                          className={cn(
                            "h-5 w-5 rounded-md border flex items-center justify-center shrink-0",
                            checked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border bg-background",
                          )}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {allBranches
                    ? "No branch selected — this account is used at all branches."
                    : `Used at ${storeIds.length} selected branch${storeIds.length > 1 ? "es" : ""} only.`}
                </p>
              </section>



              {hasExisting && (
                <section className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 gap-2 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => setShowDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </section>
              )}
            </div>

            <SheetFooter className="py-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 font-semibold"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-12 font-semibold"
                  disabled={!canSave}
                  onClick={handleSave}
                >
                  {hasExisting ? "Update" : "Save"}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </BaseSheet>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-2xl">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Delete Account?</DialogTitle>
            <DialogDescription className="text-center">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              No
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDelete(false);
                onDelete();
              }}
            >
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BankAccountsView;

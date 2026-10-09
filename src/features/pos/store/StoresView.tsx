import { orderPreferences } from "./orderPreferences";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  Plus,
  Search,
  X,
  Store as StoreIcon,
  GripVertical,
  Pencil,
  Upload,
} from "lucide-react";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { Store, useStores, deriveBranchLabel } from "./StoreProvider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
const MAX_LOGO_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

interface Props {
  onBack: () => void;
}

const StoresView = ({ onBack }: Props) => {
  const { stores, addStore, updateStore, removeStore, reorderStores } = useStores();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const editorSheet = useSheetAnimation(ANIMATION_DURATION);
  const confirm = useConfirm();

  const editing = useMemo(
    () => (editingId ? stores.find((s) => s.id === editingId) ?? null : null),
    [stores, editingId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      [s.name, s.branch, s.address_line1, s.address_line2]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q)),
    );
  }, [stores, search]);

  const openEditor = (id: string) => {
    setEditingId(id);
    editorSheet.openSheet();
  };

  const closeEditor = (opts?: { discardIfEmpty?: boolean }) => {
    if (opts?.discardIfEmpty && editing) {
      const isEmpty = !editing.name.trim() && !editing.branch.trim();
      if (isEmpty) removeStore(editing.id);
    }
    editorSheet.closeSheet();
    setTimeout(() => setEditingId(null), ANIMATION_DURATION);
  };

  const handleAdd = () => {
    const s = addStore();
    openEditor(s.id);
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
              Stores
            </h1>
          </div>
        </div>

        {/* Search + Add */}
        <div className="px-3 pb-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1 flex items-center bg-secondary rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stores..."
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
            aria-label="Add store"
            className="shrink-0 h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(80px+env(safe-area-inset-bottom))] space-y-2">
        {filtered.length === 0 && stores.length > 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            No stores match "{search}"
          </div>
        )}

        {stores.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <StoreIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">No stores yet</p>
              <p className="text-xs text-muted-foreground">
                Add a store to manage branches & receipt info.
              </p>
            </div>
          </div>
        )}

        <SortableStoreList
          items={filtered}
          dragEnabled={!search}
          onPick={openEditor}
          onReorder={reorderStores}
          onToggle={(s) => {
            updateStore({ ...s, enabled: !s.enabled });
            toast.success(`${s.name.trim() || "Store"} ${s.enabled ? "hidden" : "active"}`);
          }}
          onDelete={(s) => {
            confirm({
              title: `Delete ${s.name.trim() || "this store"}?`,
              description: "This action cannot be undone.",
              confirmText: "Delete",
              variant: "destructive",
              onConfirm: () => {
                removeStore(s.id);
                toast.success("Store deleted");
              },
            });
          }}
        />

        {!search && stores.length > 0 && (
          <button
            onClick={handleAdd}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-transparent p-4 min-h-[64px] text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 active:scale-[0.99] transition"
          >
            <Plus className="h-4 w-4" />
            Add Store
          </button>
        )}
      </main>

      {(editorSheet.open || editorSheet.isClosing) && editing && (
        <StoreEditorSheet
          store={editing}
          open={editorSheet.open}
          isOpening={editorSheet.isOpening}
          isClosing={editorSheet.isClosing}
          onCancel={() => closeEditor({ discardIfEmpty: true })}
          onSave={(s) => {
            updateStore(s);
            toast.success("Store saved");
            closeEditor();
          }}
          onDelete={() => {
            removeStore(editing.id);
            toast.success("Store deleted");
            closeEditor();
          }}
        />
      )}
    </div>
  );
};

// ─── Sortable list ─────────────────────────────────────────────
function SortableStoreList({
  items,
  dragEnabled,
  onPick,
  onReorder,
  onToggle,
  onDelete,
}: {
  items: Store[];
  dragEnabled: boolean;
  onPick: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onToggle: (s: Store) => void;
  onDelete: (s: Store) => void;
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
          {items.map((s) => (
            <SortableStoreRow key={s.id} id={s.id} disabled={!dragEnabled}>
              {({ handleProps, isDragging }) => (
                <StoreCard
                  store={s}
                  dragEnabled={dragEnabled}
                  isDragging={isDragging}
                  handleProps={handleProps}
                  onPick={() => onPick(s.id)}
                  onToggle={() => onToggle(s)}
                  onDelete={() => onDelete(s)}
                />
              )}
            </SortableStoreRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableStoreRow({
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
        isDragging && "z-20 relative ring-2 ring-primary shadow-2xl scale-[1.02] rounded-xl",
      )}
    >
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

function StoreLogo({ store, size = "md" }: { store: Store; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  if (store.logo) {
    return (
      <img
        src={store.logo}
        alt={store.name}
        className={cn("rounded-xl object-cover bg-muted", dim)}
      />
    );
  }
  return (
    <div className={cn("rounded-xl bg-primary/10 flex items-center justify-center", dim)}>
      <StoreIcon className={cn("text-primary", size === "lg" ? "h-6 w-6" : "h-5 w-5")} />
    </div>
  );
}

function StoreCard({
  store: s,
  dragEnabled,
  isDragging,
  handleProps,
  onPick,
  onToggle,
  onDelete,
}: {
  store: Store;
  dragEnabled: boolean;
  isDragging: boolean;
  handleProps: any;
  onPick: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const addr = [s.address_line1, s.address_line2, s.address_line3, s.address_line4]
    .filter((l) => l && l.trim())
    .join(", ");

  return (
    <div
      onClick={onPick}
      className={cn(
        "w-full rounded-xl border border-border bg-card p-2 pr-2 flex flex-col gap-2 transition text-left cursor-pointer",
        isDragging
          ? "ring-2 ring-primary border-transparent"
          : "active:scale-[0.99] active:ring-2 active:ring-primary active:border-transparent",
        !s.enabled && "opacity-70",
      )}
    >
      {/* Top row: drag + logo + info */}
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

        <StoreLogo store={s} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {s.name.trim() || "Untitled store"}
          </p>
          <p className="text-xs text-foreground/90 truncate mt-0.5">
            {s.branch.trim() || "No branch"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {addr || "No address set"}
          </p>
        </div>
      </div>

      {/* Bottom row: active badge left, actions right */}
      <div className="flex items-center justify-between gap-2 pl-7">
        <StatusPill
          label={s.enabled ? "Active" : "Off"}
          tone={s.enabled ? "success" : "neutral"}
          className="shrink-0"
        />

        <div className="flex items-center gap-2">
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Switch
              checked={s.enabled}
              onCheckedChange={onToggle}
              aria-label={s.enabled ? "Set inactive" : "Set active"}
            />
          </div>
          <div className="h-8 w-8 flex items-center justify-center rounded-md bg-muted/60">
            <Pencil className="h-3.5 w-3.5" />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-8 w-8 flex items-center justify-center rounded-md bg-destructive/10 text-destructive active:scale-95"
            aria-label="Delete store"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Editor sheet ────────────────────────────────────────────────
interface EditorProps {
  store: Store;
  open: boolean;
  isOpening: boolean;
  isClosing: boolean;
  onCancel: () => void;
  onSave: (s: Store) => void;
  onDelete: () => void;
}

const StoreEditorSheet = ({
  store,
  open,
  isOpening,
  isClosing,
  onCancel,
  onSave,
  onDelete,
}: EditorProps) => {
  const hasExisting = store.name.trim() !== "" || store.branch.trim() !== "";

  const [form, setForm] = useState<Store>(store);
  const [showDelete, setShowDelete] = useState(false);

  // Resync local form when a different store is opened in the editor
  useEffect(() => {
    setForm(store);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);

  const set = <K extends keyof Store>(key: K, value: Store[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSave = form.name.trim().length >= 2;

  const handleSave = () => {
    if (!canSave) {
      toast.error("Store name must be at least 2 characters");
      return;
    }
    try {
      const branchShortCode = form.branchShortCode.trim().slice(0, 6).toUpperCase();
      const branchName = form.branchName.trim().slice(0, 25);
      onSave({
        ...form,
        name: form.name.trim(),
        branchShortCode,
        branchName,
        branch: deriveBranchLabel(branchShortCode, branchName),
      });
    } catch (e) {
      console.error("Save store failed", e);
      toast.error("Could not save store");
    }
  };

  const handleLogo = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error("Image too large (max 1.5 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result || ""));
    reader.readAsDataURL(file);
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
              title={hasExisting ? "Edit Store" : "New Store"}
              onClose={onCancel}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Logo */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>Store logo</h3>
                <div className="flex items-center gap-3">
                  {form.logo ? (
                    <div className="relative">
                      <img
                        src={form.logo}
                        alt="Logo"
                        className="h-20 w-20 rounded-xl object-cover border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => set("logo", "")}
                        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                        aria-label="Remove logo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center border border-dashed border-border">
                      <StoreIcon className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card text-sm font-medium active:scale-[0.99]">
                      <Upload className="h-4 w-4" />
                      {form.logo ? "Replace logo" : "Upload logo"}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </section>

              {/* Basic info */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>Basic info</h3>
                <div className="space-y-1.5">
                  <label className={cn(FIELD_LABEL_CLASS, "flex items-center")}>
                    Store name
                    <RequiredMark />
                  </label>
                  <Input
                    value={form.name}
                    maxLength={60}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. Mint Cafe"
                    className="h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={FIELD_LABEL_CLASS}>Branch code</label>
                    <Input
                      value={form.branchShortCode}
                      maxLength={6}
                      onChange={(e) => set("branchShortCode", e.target.value.toUpperCase())}
                      placeholder="BR0001"
                      className="h-11 uppercase"
                    />
                    <p className="text-[11px] text-muted-foreground">Max 6 chars. Used in order IDs.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className={FIELD_LABEL_CLASS}>Branch name</label>
                    <Input
                      value={form.branchName}
                      maxLength={25}
                      onChange={(e) => set("branchName", e.target.value)}
                      placeholder="Sukhumvit 31"
                      className="h-11"
                    />
                    <p className="text-[11px] text-muted-foreground">Max 25 chars.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Headline / tagline</label>
                  <Input
                    value={form.headline}
                    maxLength={80}
                    onChange={(e) => set("headline", e.target.value)}
                    placeholder="e.g. Specialty coffee since 2018"
                    className="h-11"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shown as a small italic line under the shop name.
                  </p>
                </div>
              </section>

              {/* Address */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>Address</h3>
                {[1, 2, 3, 4].map((i) => {
                  const key = `address_line${i}` as keyof Store;
                  return (
                    <div key={key} className="space-y-1.5">
                      <label className={FIELD_LABEL_CLASS}>Line {i}</label>
                      <Input
                        value={form[key] as string}
                        maxLength={80}
                        onChange={(e) => set(key, e.target.value as Store[typeof key])}
                        placeholder={`Address line ${i}`}
                        className="h-11"
                      />
                    </div>
                  );
                })}
              </section>

              {/* Contact */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>Contact</h3>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Printed as small text under the address on every bill & receipt.
                </p>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Phone</label>
                  <Input
                    value={form.phone}
                    maxLength={40}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="e.g. 02-123-4567"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Website</label>
                  <Input
                    value={form.website}
                    maxLength={80}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="e.g. mintcafe.co"
                    className="h-11"
                  />
                </div>
              </section>

              {/* Tax & compliance */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>Tax & compliance</h3>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Turn this off for non-VAT shops (e.g. small drink stalls).
                  When on, receipts print as an Abbreviated Tax Invoice (ABB)
                  with your Tax ID and branch code.
                </p>

                <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold">VAT registered</p>
                    <p className="text-xs text-muted-foreground">
                      {form.vatRegistered
                        ? 'Receipts will be marked "ABB" with Tax ID & branch.'
                        : "Non-VAT shop — receipts will not show Tax ID or ABB label."}
                    </p>
                  </div>
                  <Switch
                    checked={form.vatRegistered}
                    onCheckedChange={(v) => set("vatRegistered", v)}
                  />
                </div>

                {form.vatRegistered && (
                  <>
                    <div className="space-y-1.5">
                      <label className={FIELD_LABEL_CLASS}>Tax ID</label>
                      <Input
                        value={form.taxId}
                        inputMode="numeric"
                        maxLength={13}
                        onChange={(e) =>
                          set("taxId", e.target.value.replace(/\D/g, "").slice(0, 13))
                        }
                        placeholder="13 digits — e.g. 0105561234567"
                        className="h-11 tabular-nums"
                      />
                      {form.taxId && form.taxId.length !== 13 && (
                        <p className="text-[11px] text-destructive">
                          Tax ID must be exactly 13 digits.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className={FIELD_LABEL_CLASS}>Branch code</label>
                      <Input
                        value={form.branchCode}
                        inputMode="numeric"
                        maxLength={5}
                        onChange={(e) =>
                          set(
                            "branchCode",
                            e.target.value.replace(/\D/g, "").slice(0, 5),
                          )
                        }
                        placeholder="00000 = head office, 00001+ for branches"
                        className="h-11 tabular-nums"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Use <span className="font-mono">00000</span> for head office,
                        or your registered branch number (e.g. 00001, 00002).
                      </p>
                    </div>
                  </>
                )}
              </section>


              {/* QR caption now lives in Receipt Template settings */}


              {/* Receipt footer */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>Receipt footer (after payment)</h3>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Title</label>
                  <Input
                    value={form.receiptFooterTitle}
                    maxLength={60}
                    onChange={(e) => set("receiptFooterTitle", e.target.value)}
                    placeholder="e.g. Thank you!"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Subtitle</label>
                  <Input
                    value={form.receiptFooterSub}
                    maxLength={80}
                    onChange={(e) => set("receiptFooterSub", e.target.value)}
                    placeholder="e.g. Have a wonderful day"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Footer note 1</label>
                  <Input
                    value={form.receiptFooterNote1}
                    maxLength={80}
                    onChange={(e) => set("receiptFooterNote1", e.target.value)}
                    placeholder="Optional extra line"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Footer note 2</label>
                  <Input
                    value={form.receiptFooterNote2}
                    maxLength={80}
                    onChange={(e) => set("receiptFooterNote2", e.target.value)}
                    placeholder="Optional extra line"
                    className="h-11"
                  />
                </div>
              </section>

              {/* Bill footer */}
              <section className="space-y-3">
                <h3 className={FIELD_LABEL_CLASS}>Bill footer (unpaid)</h3>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Title</label>
                  <Input
                    value={form.billFooterTitle}
                    maxLength={60}
                    onChange={(e) => set("billFooterTitle", e.target.value)}
                    placeholder="e.g. Please present at counter to pay"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Subtitle</label>
                  <Input
                    value={form.billFooterSub}
                    maxLength={80}
                    onChange={(e) => set("billFooterSub", e.target.value)}
                    placeholder="e.g. This is a bill — not a tax receipt"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Footer note 1</label>
                  <Input
                    value={form.billFooterNote1}
                    maxLength={80}
                    onChange={(e) => set("billFooterNote1", e.target.value)}
                    placeholder="Optional extra line"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Footer note 2</label>
                  <Input
                    value={form.billFooterNote2}
                    maxLength={80}
                    onChange={(e) => set("billFooterNote2", e.target.value)}
                    placeholder="Optional extra line"
                    className="h-11"
                  />
                </div>
              </section>


              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Order preferences</h3>
                <p className="text-xs text-muted-foreground">Applies to new orders in this branch. Existing orders keep their service type.</p>
                {(["takeawayEnabled", "dineInEnabled"] as const).map((key) => {
                  const prefs = orderPreferences(form.orderPreferences);
                  const other = key === "takeawayEnabled" ? "dineInEnabled" : "takeawayEnabled";
                  return <div key={key} className="flex items-center justify-between rounded-xl border p-4">
                    <span className="text-sm font-semibold">{key === "takeawayEnabled" ? "Takeaway" : "Dine-in"}</span>
                    <Switch aria-label={key === "takeawayEnabled" ? "Enable takeaway" : "Enable dine-in"} checked={prefs[key]} disabled={prefs[key] && !prefs[other]}
                      onCheckedChange={(enabled) => set("orderPreferences", orderPreferences({ ...prefs, [key]: enabled }))} />
                  </div>;
                })}
                <label className="block text-sm font-semibold">Default order type
                  <select className="mt-2 block w-full rounded-xl border bg-background p-3" value={orderPreferences(form.orderPreferences).defaultOrderMode}
                    onChange={(e) => set("orderPreferences", orderPreferences({ ...orderPreferences(form.orderPreferences), defaultOrderMode: e.target.value as "takeaway" | "dine_in" }))}>
                    {orderPreferences(form.orderPreferences).takeawayEnabled && <option value="takeaway">Takeaway</option>}
                    {orderPreferences(form.orderPreferences).dineInEnabled && <option value="dine_in">Dine-in</option>}
                  </select>
                </label>
                {orderPreferences(form.orderPreferences).dineInEnabled && <div className="flex items-center justify-between rounded-xl border p-4">
                  <span className="text-sm font-semibold">Require table for dine-in</span>
                  <Switch aria-label="Require table for dine-in" checked={orderPreferences(form.orderPreferences).requireTable}
                    onCheckedChange={(requireTable) => set("orderPreferences", { ...orderPreferences(form.orderPreferences), requireTable })} />
                </div>}
                <p className="text-xs text-muted-foreground">At least one order type must remain enabled. Every order still receives an order number.</p>
              </section>

              {/* Visibility */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Visibility
                </h3>
                <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4">
                  <div>
                    <p className="text-sm font-semibold">Enable store</p>
                    <p className="text-xs text-muted-foreground">
                      Allow this store to be selected.
                    </p>
                  </div>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(v) => set("enabled", v)}
                  />
                </div>
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
                    Delete Store
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
            <DialogTitle className="text-center">Delete Store?</DialogTitle>
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

export default StoresView;

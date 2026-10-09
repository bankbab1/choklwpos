import { useMemo, useState } from "react";
import {
  ArrowLeft,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { useSheetAnimation } from "@/hooks/useSheetAnimation";
import { useMaster } from "@/features/pos/master/MasterProvider";
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
import {
  Promotion,
  usePromotions,
} from "./PromotionsProvider";
import {
  PROMO_TYPE_META,
  summarizeCondition,
  summarizeReward,
} from "./promotionMeta";
import PromotionEditorSheet from "./PromotionEditorSheet";
import { PromoStatusPill, QuotaProgress } from "./PromoStatusPill";
import type { PromoStatus } from "./PromotionsProvider";

const ANIMATION_DURATION = 300;

interface Props {
  onBack: () => void;
}

const PromotionsView = ({ onBack }: Props) => {
  const {
    promotions,
    usage,
    addPromotion,
    updatePromotion,
    removePromotion,
    togglePromotionActive,
    reorderPromotions,
    getStatus,
  } = usePromotions();
  const { products } = useMaster();
  const confirm = useConfirm();
  const editorSheet = useSheetAnimation(ANIMATION_DURATION);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState("");

  const editing = useMemo(
    () => promotions.find((p) => p.id === editingId) ?? null,
    [promotions, editingId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promotions;
    return promotions.filter((p) => {
      const typeLabel = PROMO_TYPE_META[p.promoType].label.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        typeLabel.includes(q)
      );
    });
  }, [promotions, search]);

  const openEditor = (id: string, fresh = false) => {
    setEditingId(id);
    setIsNew(fresh);
    editorSheet.openSheet();
  };

  const closeEditor = (opts?: { discardIfNewEmpty?: boolean }) => {
    if (opts?.discardIfNewEmpty && editing && isNew && !editing.name.trim()) {
      removePromotion(editing.id);
    }
    editorSheet.closeSheet();
    setTimeout(() => {
      setEditingId(null);
      setIsNew(false);
    }, ANIMATION_DURATION);
  };

  const handleAdd = () => {
    const p = addPromotion();
    openEditor(p.id, true);
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
              Promotions
            </h1>
          </div>
        </div>

        <div className="px-3 pb-3 flex items-center gap-2">
          <div className="relative flex-1 flex items-center bg-secondary rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search promotions..."
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
            aria-label="Add promotion"
            className="shrink-0 h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(80px+env(safe-area-inset-bottom))] space-y-2">
        {promotions.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Tag className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">No promotions yet</p>
              <p className="text-xs text-muted-foreground">
                Create your first promotion to reward customers.
              </p>
            </div>
          </div>
        )}

        {filtered.length === 0 && promotions.length > 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            No promotions match "{search}"
          </div>
        )}

        <SortablePromotionList
          items={filtered}
          dragEnabled={!search}
          onPick={(id) => openEditor(id, false)}
          onReorder={reorderPromotions}
          onToggle={(p) => {
            togglePromotionActive(p.id);
            toast.success(
              `${p.name.trim() || "Promotion"} ${p.isActive ? "disabled" : "enabled"}`,
            );
          }}
          onDelete={(p) => {
            confirm({
              title: `Delete "${p.name.trim() || "this promotion"}"?`,
              description: "This action cannot be undone.",
              confirmText: "Delete",
              variant: "destructive",
              onConfirm: () => {
                removePromotion(p.id);
                toast.success("Promotion deleted");
              },
            });
          }}
          renderSummary={(p) =>
            `${summarizeCondition(p, products)} · ${summarizeReward(p, products)}`
          }
          getStatus={getStatus}
          getLifetimeUsed={(p) => usage[p.id]?.lifetime ?? 0}
        />

        {!search && promotions.length > 0 && (
          <button
            onClick={handleAdd}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-transparent p-4 min-h-[64px] text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 active:scale-[0.99] transition"
          >
            <Plus className="h-4 w-4" />
            Add Promotion
          </button>
        )}
      </main>

      {(editorSheet.open || editorSheet.isClosing) && editing && (
        <PromotionEditorSheet
          promotion={editing}
          open={editorSheet.open}
          isOpening={editorSheet.isOpening}
          isClosing={editorSheet.isClosing}
          isNew={isNew}
          onCancel={() => closeEditor({ discardIfNewEmpty: true })}
          onSave={(p) => {
            updatePromotion(p);
            toast.success("Promotion saved");
            closeEditor();
          }}
          onDelete={() => {
            removePromotion(editing.id);
            toast.success("Promotion deleted");
            closeEditor();
          }}
        />
      )}
    </div>
  );
};

// ─── Sortable list ─────────────────────────────────────────────
function SortablePromotionList({
  items,
  dragEnabled,
  onPick,
  onReorder,
  onToggle,
  onDelete,
  renderSummary,
  getStatus,
  getLifetimeUsed,
}: {
  items: Promotion[];
  dragEnabled: boolean;
  onPick: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onToggle: (p: Promotion) => void;
  onDelete: (p: Promotion) => void;
  renderSummary: (p: Promotion) => string;
  getStatus: (p: Promotion) => PromoStatus;
  getLifetimeUsed: (p: Promotion) => number;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {items.map((p) => (
            <SortableRow key={p.id} id={p.id} disabled={!dragEnabled}>
              {({ handleProps, isDragging }) => (
                <PromotionCard
                  promotion={p}
                  status={getStatus(p)}
                  lifetimeUsed={getLifetimeUsed(p)}
                  dragEnabled={dragEnabled}
                  isDragging={isDragging}
                  handleProps={handleProps}
                  summary={renderSummary(p)}
                  onPick={() => onPick(p.id)}
                  onToggle={() => onToggle(p)}
                  onDelete={() => onDelete(p)}
                />
              )}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
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

function PromotionCard({
  promotion: p,
  status,
  lifetimeUsed,
  dragEnabled,
  isDragging,
  handleProps,
  summary,
  onPick,
  onToggle,
  onDelete,
}: {
  promotion: Promotion;
  status: PromoStatus;
  lifetimeUsed: number;
  dragEnabled: boolean;
  isDragging: boolean;
  handleProps: any;
  summary: string;
  onPick: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const meta = PROMO_TYPE_META[p.promoType];
  const Icon = meta.icon;
  const hasQuotaBar = status.quota != null && status.period != null;

  return (
    <div
      onClick={onPick}
      className={cn(
        "w-full rounded-xl border border-border bg-card p-2 pr-2 flex flex-col gap-2 transition text-left cursor-pointer",
        isDragging
          ? "ring-2 ring-primary border-transparent"
          : "active:scale-[0.99] active:ring-2 active:ring-primary active:border-transparent",
        !p.isActive && "opacity-70",
      )}
    >
      {/* Top row: drag + icon + info */}
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

        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className={cn("h-5 w-5", meta.tint)} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {p.name.trim() || "Untitled promotion"}
          </p>
          <p className="text-[11px] font-medium text-foreground/80 truncate mt-0.5">
            {meta.label}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {summary}
          </p>
          {hasQuotaBar ? (
            <QuotaProgress status={status} />
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
              Applied to{" "}
              <span className="font-semibold text-foreground">{lifetimeUsed}</span>{" "}
              order{lifetimeUsed === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      {/* Bottom row: status pill left, actions right */}
      <div className="flex items-center justify-between gap-2 pl-7">
        <PromoStatusPill status={status} className="shrink-0" />

        <div className="flex items-center gap-2">
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Switch
              checked={p.isActive}
              onCheckedChange={onToggle}
              aria-label={p.isActive ? "Disable" : "Enable"}
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
            aria-label="Delete promotion"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromotionsView;

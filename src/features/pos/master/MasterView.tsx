import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, Pencil, Trash2, X, Check, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { useMaster } from "./MasterProvider";
import { useSheetAnimation } from "@/hooks/useSheetAnimation";
import ProductEditor from "./ProductEditor";
import OptionGroupEditor from "./OptionGroupEditor";
import { cn } from "@/lib/utils";
import { formatTHB } from "@/lib/pricing/currency";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { Product } from "@/data/products";
import { OptionGroup } from "@/data/options";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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

// ─── Sortable wrappers ─────────────────────────────────────────────
function SortableRow({
  id,
  disabled,
  children,
  className,
}: {
  id: string;
  disabled?: boolean;
  children: (args: { handleProps: any; isDragging: boolean }) => React.ReactNode;
  className?: string;
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
        "transition-shadow",
        isDragging &&
          "z-20 relative ring-2 ring-primary shadow-2xl scale-[1.02] rounded-xl",
        className,
      )}
    >
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

type Tab = "products" | "options" | "categories";

interface Props {
  onBack: () => void;
  mode?: "product" | "category";
}

const GhostAddCard = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full rounded-xl border-2 border-dashed border-border bg-transparent p-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary active:scale-[0.99] transition"
  >
    <Plus className="h-4 w-4" />
    {label}
  </button>
);

export const MasterView = ({ onBack, mode = "product" }: Props) => {
  const {
    // Use originalProducts so the Product Master always shows the untouched
    // base price — Discount Master must not mutate what's listed here.
    originalProducts: products,
    optionGroups,
    categories,
    upsertGroup,
    deleteGroup,
    deleteProduct,
    groupUsageCount,
    addCategory,
    renameCategory,
    deleteCategory,
    moveCategory,
    moveProductInCategory,
    categoryUsageCount,
    toggleProductActive,
    toggleCategoryActive,
    isCategoryActive,
    toggleGroupActive,
    moveGroup,
  } = useMaster();
  const confirm = useConfirm();

  const [tab, setTab] = useState<Tab>(mode === "category" ? "categories" : "products");
  const screenTitle = mode === "category" ? "Category Master" : "Product Master";
  const visibleTabs: Tab[] = mode === "category" ? ["categories"] : ["products", "options"];
  const [search, setSearch] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // dnd-kit sensors (touch + mouse)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const productEditor = useSheetAnimation(300);
  const groupEditor = useSheetAnimation(300);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null);
  const [newProductCategory, setNewProductCategory] = useState<string | undefined>();

  const toggleExpanded = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const productsByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of products) {
      (map[p.category] ||= []).push(p);
    }
    return map;
  }, [products]);


  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.code || "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return optionGroups;
    return optionGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [optionGroups, search]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, search]);

  const openNewProduct = (category?: string) => {
    setEditingProduct(null);
    setNewProductCategory(category);
    productEditor.openSheet();
  };
  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setNewProductCategory(undefined);
    productEditor.openSheet();
  };
  const closeProductEditor = () => {
    productEditor.closeSheet();
    setTimeout(() => {
      setEditingProduct(null);
      setNewProductCategory(undefined);
    }, 300);
  };

  const openNewGroup = () => {
    setEditingGroup(null);
    groupEditor.openSheet();
  };
  const openEditGroup = (g: OptionGroup) => {
    setEditingGroup(g);
    groupEditor.openSheet();
  };
  const closeGroupEditor = () => {
    groupEditor.closeSheet();
    setTimeout(() => setEditingGroup(null), 300);
  };

  const handleDeleteProduct = (p: Product) => {
    confirm({
      title: `Delete ${p.name}?`,
      description: "This product will be removed from the menu.",
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: () => {
        deleteProduct(p.id);
        toast.success(`${p.name} deleted`);
      },
    });
  };

  const handleDeleteGroup = (g: OptionGroup) => {
    const usage = groupUsageCount(g.id);
    confirm({
      title: `Delete ${g.name}?`,
      description:
        usage > 0
          ? `Used by ${usage} product${usage === 1 ? "" : "s"}. It will be removed from all of them.`
          : "This option group will be removed from the library.",
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: () => {
        deleteGroup(g.id);
        toast.success(`${g.name} deleted`);
      },
    });
  };

  const submitNewCategory = () => {
    const ok = addCategory(newCategoryName);
    if (ok) {
      toast.success(`${newCategoryName.trim()} added`);
      setNewCategoryName("");
      setAddingCategory(false);
    } else if (newCategoryName.trim()) {
      toast.error("Name is reserved or already exists");
    }
  };

  // Categories reorder via dnd-kit
  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.indexOf(String(active.id));
    const newIdx = categories.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const dir: 1 | -1 = oldIdx < newIdx ? 1 : -1;
    const steps = Math.abs(newIdx - oldIdx);
    for (let i = 0; i < steps; i++) moveCategory(String(active.id), dir);
  };

  // Products-within-category reorder via dnd-kit
  const makeProductDragEndHandler = (cat: string, list: Product[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = list.findIndex((p) => p.id === active.id);
    const newIdx = list.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const dir: 1 | -1 = oldIdx < newIdx ? 1 : -1;
    const steps = Math.abs(newIdx - oldIdx);
    for (let i = 0; i < steps; i++) moveProductInCategory(String(active.id), dir);
  };

  // Option groups reorder via dnd-kit
  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = optionGroups.map((g) => g.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const dir: 1 | -1 = oldIdx < newIdx ? 1 : -1;
    const steps = Math.abs(newIdx - oldIdx);
    for (let i = 0; i < steps; i++) moveGroup(String(active.id), dir);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        {/* Compact subpage header: back + eyebrow/title in one row */}
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
              {screenTitle}
            </h1>
          </div>
        </div>






        {/* Tabs (only when multiple are visible) */}
        {visibleTabs.length > 1 && (
          <div className="px-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {(
              [
                { id: "products", label: `Products · ${products.length}` },
                { id: "options", label: `Options · ${optionGroups.length}` },
                { id: "categories", label: `Categories · ${categories.length}` },
              ] as { id: Tab; label: string }[]
            )
              .filter((t) => visibleTabs.includes(t.id))
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "px-3 py-2 rounded-full text-xs font-semibold transition active:scale-95",
                    tab === t.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
          </div>
        )}

        {/* Search + Add */}
        <div className="px-3 pb-3 flex items-center gap-2">
          <div className="relative flex-1 flex items-center bg-secondary rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "products"
                  ? "Search products..."
                  : tab === "options"
                    ? "Search option groups..."
                    : "Search categories..."
              }
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
            onClick={() => {
              if (tab === "products") openNewProduct();
              else if (tab === "options") openNewGroup();
              else {
                setAddingCategory(true);
                setNewCategoryName("");
              }
            }}
            aria-label={
              tab === "products"
                ? "Add product"
                : tab === "options"
                  ? "Add option group"
                  : "Add category"
            }
            className="shrink-0 h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(80px+env(safe-area-inset-bottom))] space-y-2">
        {tab === "products" && (
          <>
            {filteredProducts.map((p) => {
              const pActive = p.active !== false;
              return (
              <button
                key={p.id}
                onClick={() => openEditProduct(p)}
                className={cn(
                  "w-full rounded-xl border border-border bg-card p-3 flex items-center gap-3 active:scale-[0.99] transition text-left",
                  !pActive && "opacity-60",
                )}
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-12 w-12 rounded-lg object-cover bg-muted"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.category} · {formatTHB(p.price)}
                  </p>
                  {!pActive && (
                    <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Hidden
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={pActive}
                      onCheckedChange={() => {
                        toggleProductActive(p.id);
                        toast.success(`${p.name} ${pActive ? "hidden" : "active"}`);
                      }}
                      aria-label={pActive ? "Set inactive" : "Set active"}
                    />
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-md bg-muted/60">
                    <Pencil className="h-3.5 w-3.5" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProduct(p);
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded-md bg-destructive/10 text-destructive active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </button>
              );
            })}
            <GhostAddCard label="Add Product" onClick={() => openNewProduct()} />
          </>
        )}

        {tab === "options" && (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleGroupDragEnd}
            >
              <SortableContext
                items={filteredGroups.map((g) => g.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredGroups.map((g) => {
                  const usage = groupUsageCount(g.id);
                  const gActive = g.active !== false;
                  const sortDisabled = search.trim().length > 0;
                  return (
                    <SortableRow key={g.id} id={g.id} disabled={sortDisabled} className="mb-2">
                      {({ handleProps, isDragging }) => (
                        <div
                          onClick={() => !isDragging && openEditGroup(g)}
                          className={cn(
                            "w-full rounded-xl border bg-card p-3 flex items-center gap-2 transition text-left cursor-pointer",
                            isDragging ? "border-primary" : "border-border active:scale-[0.99]",
                            !gActive && "opacity-60",
                          )}
                        >
                          <div
                            {...(sortDisabled ? {} : handleProps)}
                            className={cn(
                              "h-8 w-6 flex items-center justify-center text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing touch-none",
                              sortDisabled && "opacity-30",
                            )}
                            aria-label="Drag to reorder"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {g.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {g.options.length} choice
                              {g.options.length === 1 ? "" : "s"} · used by {usage}{" "}
                              product{usage === 1 ? "" : "s"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span
                                className={cn(
                                  "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                                  g.type === "single"
                                    ? "bg-secondary text-muted-foreground"
                                    : "bg-accent text-accent-foreground",
                                )}
                              >
                                {g.type === "single" ? "Single" : "Multi"}
                              </span>
                              {g.required && (
                                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                  Required
                                </span>
                              )}
                              {!gActive && (
                                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  Hidden
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <Switch
                                checked={gActive}
                                onCheckedChange={() => {
                                  toggleGroupActive(g.id);
                                  toast.success(`${g.name} ${gActive ? "hidden" : "active"}`);
                                }}
                                aria-label={gActive ? "Set inactive" : "Set active"}
                              />
                            </div>
                            <div className="h-8 w-8 flex items-center justify-center rounded-md bg-muted/60">
                              <Pencil className="h-3.5 w-3.5" />
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGroup(g);
                              }}
                              className="h-8 w-8 flex items-center justify-center rounded-md bg-destructive/10 text-destructive active:scale-95"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </SortableRow>
                  );
                })}
              </SortableContext>
            </DndContext>
            <GhostAddCard label="Add Option Group" onClick={openNewGroup} />
          </>
        )}

        {tab === "categories" && (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCategoryDragEnd}
            >
              <SortableContext items={filteredCategories} strategy={verticalListSortingStrategy}>
                {filteredCategories.map((cat) => {
              const usage = categoryUsageCount(cat);
              const isEditing = editingCategory === cat;
              const isExpanded = expandedCategories.has(cat);
              const catProducts = productsByCategory[cat] || [];
              const canDelete = usage === 0;
              const catActive = isCategoryActive(cat);
              return (
                <SortableRow key={cat} id={cat} disabled={isEditing}>
                  {({ handleProps }) => (
                <div
                  className={cn(
                    "rounded-xl border bg-card transition overflow-hidden mb-2",
                    !catActive && "opacity-70",
                    "border-border",
                  )}
                >
                  <div className="p-3 flex items-center gap-2">
                    <div
                      {...handleProps}
                      className="h-8 w-6 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(cat)}
                      disabled={isEditing}
                      className="h-8 w-8 flex items-center justify-center rounded-md bg-muted/40 text-muted-foreground active:scale-95 shrink-0"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingCategoryValue}
                        onChange={(e) => setEditingCategoryValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const ok = renameCategory(cat, editingCategoryValue);
                            if (ok) {
                              toast.success("Category renamed");
                              setEditingCategory(null);
                            } else {
                              toast.error("Invalid or duplicate name");
                            }
                          } else if (e.key === "Escape") {
                            setEditingCategory(null);
                          }
                        }}
                        className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(cat)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm font-semibold truncate flex items-center gap-2">
                          {cat}
                          {!catActive && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Hidden
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {usage} product{usage === 1 ? "" : "s"}
                        </p>
                      </button>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              const ok = renameCategory(cat, editingCategoryValue);
                              if (ok) {
                                toast.success("Category renamed");
                                setEditingCategory(null);
                              } else {
                                toast.error("Invalid or duplicate name");
                              }
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground active:scale-95"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="h-8 w-8 flex items-center justify-center rounded-md bg-muted/60 active:scale-95"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="mr-1"
                          >
                            <Switch
                              checked={catActive}
                              onCheckedChange={() => {
                                toggleCategoryActive(cat);
                                toast.success(
                                  `${cat} ${catActive ? "hidden" : "active"}`,
                                );
                              }}
                              aria-label={catActive ? "Set inactive" : "Set active"}
                            />
                          </div>
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setEditingCategoryValue(cat);
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded-md bg-muted/60 active:scale-95"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (!canDelete) {
                                toast.error(
                                  `Cannot delete "${cat}": ${usage} product${usage === 1 ? " is" : "s are"} still mapped. Move or delete them first.`,
                                );
                                return;
                              }
                              confirm({
                                title: `Delete ${cat}?`,
                                description: "This category will be removed.",
                                confirmText: "Delete",
                                variant: "destructive",
                                onConfirm: () => {
                                  const ok = deleteCategory(cat);
                                  if (ok) toast.success(`${cat} deleted`);
                                  else toast.error("Cannot delete category");
                                },
                              });
                            }}
                            disabled={!canDelete}
                            title={
                              canDelete
                                ? "Delete category"
                                : "Move products out first"
                            }
                            className={cn(
                              "h-8 w-8 flex items-center justify-center rounded-md transition",
                              canDelete
                                ? "bg-destructive/10 text-destructive active:scale-95"
                                : "bg-muted/40 text-muted-foreground/50 cursor-not-allowed",
                            )}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded products */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 py-2 pr-2 pl-8 space-y-1.5">
                      {catProducts.length === 0 && (
                        <p className="text-center text-[11px] text-muted-foreground py-3">
                          No products in this category yet
                        </p>
                      )}
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={makeProductDragEndHandler(cat, catProducts)}
                      >
                        <SortableContext
                          items={catProducts.map((p) => p.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {catProducts.map((p) => (
                            <SortableRow key={p.id} id={p.id}>
                              {({ handleProps }) => (
                                <div className="rounded-lg border border-border bg-card p-2 flex items-center gap-2 mb-1.5">
                                  <div
                                    {...handleProps}
                                    className="h-7 w-5 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
                                    aria-label="Drag to reorder"
                                  >
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </div>
                                  {p.image ? (
                                    <img
                                      src={p.image}
                                      alt={p.name}
                                      className="h-9 w-9 rounded-md object-cover bg-muted shrink-0"
                                    />
                                  ) : (
                                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                                      {p.name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => openEditProduct(p)}
                                    className="flex-1 min-w-0 text-left"
                                  >
                                    <p className="text-xs font-semibold truncate">
                                      {p.name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {formatTHB(p.price)}
                                    </p>
                                  </button>
                                  <button
                                    onClick={() => openEditProduct(p)}
                                    className="h-7 w-7 flex items-center justify-center rounded-md bg-muted/60 active:scale-95 shrink-0"
                                    aria-label="Edit"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </SortableRow>
                          ))}
                        </SortableContext>
                      </DndContext>
                      <button
                        onClick={() => openNewProduct(cat)}
                        className="w-full rounded-lg border-2 border-dashed border-border bg-transparent p-2 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary active:scale-[0.99] transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Product to {cat}
                      </button>
                    </div>
                  )}
                </div>
                  )}
                </SortableRow>
              );
                })}
              </SortableContext>
            </DndContext>



            {/* Ghost add card / inline add input */}
            {addingCategory ? (
              <div className="rounded-xl border-2 border-dashed border-primary/50 bg-card p-3 flex gap-2">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewCategory();
                    else if (e.key === "Escape") {
                      setAddingCategory(false);
                      setNewCategoryName("");
                    }
                  }}
                  placeholder="Category name"
                  className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={submitNewCategory}
                  disabled={!newCategoryName.trim()}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold active:scale-95 disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-md bg-muted/60 active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <GhostAddCard label="Add Category" onClick={() => setAddingCategory(true)} />
            )}

            <p className="text-[11px] text-muted-foreground px-1 pt-2">
              Drag the handle to reorder. "All" and "Onetime Item" are managed automatically.
            </p>
          </>
        )}
      </main>

      {(productEditor.open || productEditor.isClosing) && (
        <ProductEditor
          open={productEditor.open}
          isOpening={productEditor.isOpening}
          isClosing={productEditor.isClosing}
          onClose={closeProductEditor}
          initial={editingProduct}
          initialCategory={newProductCategory}
        />
      )}

      {(groupEditor.open || groupEditor.isClosing) && (
        <OptionGroupEditor
          open={groupEditor.open}
          isOpening={groupEditor.isOpening}
          isClosing={groupEditor.isClosing}
          onClose={closeGroupEditor}
          initial={editingGroup}
          onSave={(g) => {
            upsertGroup(g);
            closeGroupEditor();
          }}
        />
      )}
    </div>
  );
};

export default MasterView;

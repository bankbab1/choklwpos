import { useEffect, useMemo, useRef, RefObject } from "react";
import { Product } from "@/data/products";
import { useMaster } from "@/features/pos/master/MasterProvider";
import ProductGrid, { ProductViewMode } from "./ProductGrid";

const CUSTOM_PRODUCT: Product = {
  id: "__custom__",
  name: "Custom Item",
  price: 0,
  category: "Onetime Item",
};

export const sectionIdFor = (cat: string) =>
  `category-section-${cat.replace(/\s+/g, "-")}`;

interface SectionedProductListProps {
  products: Product[];
  viewMode: ProductViewMode;
  onSelect: (p: Product) => void;
  search: string;
  scrollContainerRef: RefObject<HTMLDivElement>;
  onActiveCategoryChange: (cat: string) => void;
  /** Set to true briefly while we programmatically scroll, to suppress observer updates. */
  suppressObserverRef: RefObject<boolean>;
}

const SectionedProductList = ({
  products,
  viewMode,
  onSelect,
  search,
  scrollContainerRef,
  onActiveCategoryChange,
  suppressObserverRef,
}: SectionedProductListProps) => {
  const { activeCategories } = useMaster();
  // Sections in display order (skip "All", append "Onetime Item")
  const SECTIONS = useMemo(() => [...activeCategories, "Onetime Item"], [activeCategories]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Build grouped product map (applies search; filters inactive products)
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nextGrouped: Record<string, Product[]> = {};

    for (const cat of SECTIONS) {
      let list: Product[];
      if (cat === "Onetime Item") {
        list = [CUSTOM_PRODUCT];
      } else {
        list = products.filter((p) => p.category === cat && p.active !== false);
      }
      if (q) {
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.code || "").toLowerCase().includes(q),
        );
      }
      nextGrouped[cat] = list;
    }

    return nextGrouped;
  }, [products, search, SECTIONS]);

  // Scroll listener: choose the section whose header has most recently crossed
  // the reading line, instead of relying on large section intersection.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const visibleCats = SECTIONS.filter((cat) => grouped[cat]?.length > 0);

    const onScroll = () => {
      if (suppressObserverRef.current) return;

      if (visibleCats.length === 0) return;

      const distanceToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      if (distanceToBottom < 4) {
        onActiveCategoryChange(visibleCats[visibleCats.length - 1]);
        return;
      }

      const containerTop = container.getBoundingClientRect().top;
      const readingLine = containerTop + 24;
      let current = visibleCats[0];

      for (const cat of visibleCats) {
        const el = sectionRefs.current[cat];
        if (!el) continue;

        if (el.getBoundingClientRect().top <= readingLine) {
          current = cat;
        } else {
          break;
        }
      }

      onActiveCategoryChange(current);
    };

    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [scrollContainerRef, onActiveCategoryChange, suppressObserverRef, grouped, SECTIONS]);

  return (
    <div className="flex flex-col">
      {SECTIONS.map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;

        return (
          <section
            key={cat}
            id={sectionIdFor(cat)}
            data-category={cat}
            ref={(el) => (sectionRefs.current[cat] = el)}
            className="scroll-mt-2"
          >
            <div className="px-4 pt-4 pb-1 flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                {cat}
              </h2>
              <span className="text-xs text-muted-foreground">
                {items.length}
              </span>
            </div>
            <ProductGrid
              products={items}
              viewMode={viewMode}
              onSelect={onSelect}
            />
          </section>
        );
      })}
    </div>
  );
};

export default SectionedProductList;

import { cn } from "@/lib/utils";
import { useMaster } from "@/features/pos/master/MasterProvider";
import { useRef, useEffect } from "react";

interface CategoryTabsProps {
  active: string;
  onSelect: (category: string) => void;
  activeTab: string;
}

const CategoryTabs = ({ active, onSelect, activeTab }: CategoryTabsProps) => {
  const { activeDisplayCategories } = useMaster();
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Scroll active pill into horizontal view whenever it changes (strip only — no vertical scroll)
  useEffect(() => {
    if (activeTab !== "menu") return;

    const el = itemRefs.current[active];
    const strip = el?.parentElement;
    if (!el || !strip) return;

    const target =
      el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
    strip.scrollTo({
      left: Math.max(0, target),
      behavior: "smooth",
    });
  }, [active, activeTab]);

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3">
      {activeDisplayCategories.map((cat) => (
        <button
          key={cat}
          ref={(el) => (itemRefs.current[cat] = el)} // 👈 attach ref
          onClick={() => onSelect(cat)}
          className={cn(
            "shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-all active:scale-95",
            active === cat
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

export default CategoryTabs;

import { useMemo } from "react";
import { Product } from "@/data/products";
import { Plus } from "lucide-react";
import { useMaster } from "@/features/pos/master/MasterProvider";

export type ProductViewMode = "grid" | "list";

interface ProductGridProps {
  products: Product[];
  onSelect: (product: Product) => void;
  viewMode?: ProductViewMode;
}

const getInitials = (name: string) => {
  const words = name.trim().split(" ");

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
};

const ProductGrid = ({ products, onSelect, viewMode = "grid" }: ProductGridProps) => {
  const { originalProducts, discounts } = useMaster();
  const baseMap = useMemo(
    () => new Map(originalProducts.map((p) => [p.id, p.price])),
    [originalProducts],
  );
  const priceInfo = (p: Product) => {
    const base = baseMap.get(p.id) ?? p.price;
    const discounted = !!discounts[p.id]?.active && base !== p.price;
    return { base, discounted };
  };
  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-1.5 px-2 pt-2 pb-4">
        {products.map((product) => {
          const isCustom = product.id === "__custom__";

          return (
            <button
              key={product.id}
              onClick={() => onSelect(product)}
              className="
                flex items-start gap-3 rounded-2xl p-2 pr-3
                bg-card active:scale-[0.99] transition-all
                text-left
              "
            >
              {/* THUMBNAIL */}
              <div
                className={`
                  w-16 h-16 shrink-0 rounded-xl overflow-hidden
                  flex items-center justify-center
                  ${isCustom ? "bg-primary/10" : "bg-muted"}
                `}
              >
                {isCustom ? (
                  <span className="text-[10px] font-semibold text-muted-foreground/70 text-center leading-tight px-1">
                    Add Custom
                  </span>
                ) : product.image && product.image.trim() !== "" ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base font-semibold text-muted-foreground/70 tracking-wide">
                    {getInitials(product.name)}
                  </span>
                )}
              </div>

              {/* TEXT + PRICE ROW */}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5 py-0.5">
                {/* Row 1: name */}
                <p className="text-sm text-card-foreground line-clamp-1">
                  {isCustom ? "Custom Item" : product.name}
                </p>

                {/* Row 2: description / category */}
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {isCustom
                    ? "Tap to enter price"
                    : product.description || product.category}
                </p>

                {/* Row 3: price + add, right-aligned */}
                <div className="flex items-center justify-end gap-2 mt-1">
                  {!isCustom && (() => {
                    const { base, discounted } = priceInfo(product);
                    return (
                      <div className="flex items-baseline gap-1.5">
                        {discounted && (
                          <span className="text-[11px] text-muted-foreground line-through">
                            {base.toFixed(2)}
                          </span>
                        )}
                        <span
                          className={`font-semibold text-sm ${discounted ? "text-primary" : ""}`}
                        >
                          {product.price.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(product);
                    }}
                    className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center active:scale-90 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </button>

          );
        })}
      </div>
    );
  }

  return (
    <div
      className="
    grid gap-2 px-2 pt-2 pb-4

    grid-cols-2        /* ✅ mobile */
    md:grid-cols-4     /* ✅ iPad portrait */

    lg:[grid-template-columns:repeat(auto-fill,minmax(140px,1fr))] /* ✅ landscape */
  "
    >
      {products.map((product) => {
        const isCustom = product.id === "__custom__";

        return (
          <button
            key={product.id}
            onClick={() => onSelect(product)}
            className="
  flex flex-col rounded-2xl p-2
  active:scale-[0.97] transition-all group
"
          >
            {/* IMAGE */}
            <div
              className={`
                w-full aspect-square rounded-xl overflow-hidden
                flex items-center justify-center
                ${isCustom ? "bg-primary/10" : "bg-muted"}
              `}
            >
              {isCustom ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-center px-2">
                  <span className="text-sm font-semibold text-muted-foreground/70 leading-tight">
                    Add
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground/70 leading-tight">
                    Custom Item
                  </span>
                </div>
              ) : product.image && product.image.trim() !== "" ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
                  <span className="text-xl font-semibold text-muted-foreground/70 tracking-wide">
                    {getInitials(product.name)}
                  </span>
                </div>
              )}
            </div>

            {/* TEXT */}
            <div className="pt-2 px-1 flex flex-col gap-0.5">
              <p className="text-xs text-card-foreground text-left line-clamp-2 leading-[1.2] h-[2.4em]">
                {!isCustom && product.name}
              </p>

              <div className="flex items-center justify-between mt-1">
                {isCustom ? (
                  <p className="font-semibold text-sm">
                    <span className="text-muted-foreground text-xs">
                      Tap to enter price
                    </span>
                  </p>
                ) : (() => {
                  const { base, discounted } = priceInfo(product);
                  return (
                    <div className="flex items-baseline gap-1 min-w-0">
                      {discounted && (
                        <span className="text-[10px] text-muted-foreground line-through truncate">
                          {base.toFixed(2)}
                        </span>
                      )}
                      <span
                        className={`font-semibold text-sm ${discounted ? "text-primary" : ""}`}
                      >
                        {product.price.toFixed(2)}
                      </span>
                    </div>
                  );
                })()}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(product);
                  }}
                  className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center active:scale-90 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ProductGrid;

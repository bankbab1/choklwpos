import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useMaster } from "./MasterProvider";
import { formatTHB } from "@/lib/pricing/currency";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (p: { id: string; name: string; price: number }) => void;
}

export const ProductPickerDialog = ({ open, onClose, onPick }: Props) => {
  const { products } = useMaster();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = products.filter((p) => p.active !== false);
    if (!term) return list;
    return list.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, q]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Choose product</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
              className="h-11 pl-9"
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No products found
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onPick({ id: p.id, name: p.name, price: p.price });
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-muted active:scale-[0.99] transition text-left"
                >
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {formatTHB(p.price)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductPickerDialog;

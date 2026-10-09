import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useBusinessPreset } from "@/lib/businessType";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (label: string) => void;
  initialValue?: string;
}

export const SaveOpenOrderDialog = ({
  open,
  onClose,
  onSubmit,
  initialValue = "",
}: Props) => {
  const { preset } = useBusinessPreset();
  const [value, setValue] = useState(initialValue);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    setVisible(false);
  }, [open, initialValue]);

  if (!open) return null;

  const submit = () => {
    onSubmit(value.trim());
  };

  return (
    <div className="fixed inset-0 z-[999] flex flex-col justify-end">
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          visible ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="bg-card rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-lg font-bold text-foreground">
              Save as Open Order
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {preset.referenceLabel} — used to find this order later. Leave
              blank to skip.
            </p>
          </div>
          <div className="px-5 pb-3">
            <input
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={preset.referencePlaceholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="w-full h-12 px-4 rounded-xl bg-secondary border border-border text-[16px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition"
            />
          </div>
          <div className="px-4 pb-3">
            <button
              onClick={submit}
              className="w-full h-12 rounded-xl text-[15px] font-semibold text-primary-foreground bg-primary active:bg-primary/80 transition-colors"
            >
              Save
            </button>
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={onClose}
              className="w-full h-12 rounded-xl text-[15px] font-semibold text-foreground border border-border bg-muted/50 active:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

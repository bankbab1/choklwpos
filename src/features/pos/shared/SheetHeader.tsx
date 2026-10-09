import { X } from "lucide-react";
import { ReactNode } from "react";

export const SheetHeader = ({
  title,
  subtitle,
  meta, // 👈 ADD THIS
  onClose,
  right,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode; // 👈 ADD
  onClose?: () => void;
  right?: ReactNode;
  onDragStart?: any;
  onDragMove?: any;
  onDragEnd?: any;
}) => {
  return (
    <div
      onTouchStart={onDragStart}
      onTouchMove={onDragMove}
      onTouchEnd={onDragEnd}
      className="relative px-5 pt-3 pb-3 border-b border-border cursor-grab active:cursor-grabbing"
    >
      {/* DRAG HANDLE */}
      <div className="flex justify-center pt-2 pb-2">
        <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
      </div>

      {/* TITLE */}
      <div className="pr-20 space-y-1">
        <h2 className="text-lg font-bold leading-tight">{title}</h2>

        {subtitle && (
          <p className="text-xs text-muted-foreground leading-snug">
            {subtitle}
          </p>
        )}

        {meta && (
          <div className="text-xs text-primary font-semibold tabular-nums">
            {meta}
          </div>
        )}
      </div>

      {/* RIGHT SIDE */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        {right}

        {onClose && (
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-muted/70 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

interface SheetFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const SheetFooter = ({
  children,
  className,
}: SheetFooterProps) => {
  return (
    <div
      className={`
        border-t border-border
        px-5 py-4
        bg-background
        ${className || ""}
      `}
    >
      {children}
    </div>
  );
};
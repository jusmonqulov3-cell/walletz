import { forwardRef } from "react";
import { cn } from "./cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-foreground",
        "outline-none transition-colors",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});

export default Select;

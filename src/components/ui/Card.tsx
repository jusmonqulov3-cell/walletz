import { cn } from "./cn";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

// Surface panel: subtle 1px border, ~12px radius, no heavy shadow.
export default function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5",
        className,
      )}
      {...props}
    />
  );
}

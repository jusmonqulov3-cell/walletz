import { cn } from "./cn";

type Variant = "default" | "positive" | "negative" | "accent";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

const VARIANTS: Record<Variant, string> = {
  default: "border-border bg-surface text-muted",
  positive: "border-transparent bg-positive/10 text-positive",
  negative: "border-transparent bg-negative/10 text-negative",
  accent: "border-transparent bg-accent/10 text-accent",
};

export default function Badge({
  variant = "default",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

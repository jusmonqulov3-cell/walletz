// A shimmering placeholder block. Pass sizing/rounding via className, e.g.
// <Skeleton className="h-[78px] rounded-[14px]" />. Used by route loading.tsx
// files to paint an instant layout while the server renders the real page.
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-[var(--track)] ${className}`}
    />
  );
}

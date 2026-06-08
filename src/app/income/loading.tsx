import AppShell from "@/components/AppShell";
import Skeleton from "@/components/ui/Skeleton";

export default function IncomeLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div className="flex-1">
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="mt-2 h-3 w-44 rounded-md" />
          </div>
        </div>

        {/* hero */}
        <Skeleton className="h-[96px] rounded-[14px]" />

        {/* input */}
        <div className="section">
          <Skeleton className="mb-3 h-4 w-28 rounded-md" />
          <Skeleton className="h-[150px] rounded-[14px]" />
        </div>

        {/* recent list */}
        <div className="section">
          <Skeleton className="mb-3 h-4 w-40 rounded-md" />
          <Skeleton className="h-[200px] rounded-[14px]" />
        </div>
      </div>
    </AppShell>
  );
}

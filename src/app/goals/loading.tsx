import AppShell from "@/components/AppShell";
import Skeleton from "@/components/ui/Skeleton";

export default function GoalsLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div className="flex-1">
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="mt-2 h-3 w-40 rounded-md" />
          </div>
        </div>

        {/* overall hero */}
        <Skeleton className="h-[150px] rounded-[14px]" />

        {/* create form */}
        <div className="section">
          <Skeleton className="h-[120px] rounded-[14px]" />
        </div>

        {/* goal cards */}
        <div className="section grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-[170px] rounded-[14px]" />
          <Skeleton className="h-[170px] rounded-[14px]" />
        </div>
      </div>
    </AppShell>
  );
}

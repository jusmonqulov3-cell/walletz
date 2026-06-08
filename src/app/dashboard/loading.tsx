import AppShell from "@/components/AppShell";
import Skeleton from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        {/* header */}
        <div className="appbar">
          <div className="flex-1">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="mt-2 h-5 w-44 rounded-md" />
          </div>
          <div className="actions">
            <Skeleton className="h-[38px] w-[38px] rounded-[11px]" />
            <Skeleton className="h-[38px] w-[38px] rounded-full" />
          </div>
        </div>

        {/* stats */}
        <div className="stat-grid">
          <Skeleton className="h-[78px] rounded-[14px]" />
          <Skeleton className="h-[78px] rounded-[14px]" />
          <Skeleton className="h-[78px] rounded-[14px]" />
        </div>

        {/* budget */}
        <Skeleton className="mt-3 h-[118px] rounded-[14px]" />

        {/* breakdown / input / coach / recent */}
        <div className="section">
          <Skeleton className="h-[260px] rounded-[14px]" />
        </div>
        <div className="section">
          <Skeleton className="mb-3 h-4 w-32 rounded-md" />
          <Skeleton className="h-[150px] rounded-[14px]" />
        </div>
        <div className="section">
          <Skeleton className="mb-3 h-4 w-40 rounded-md" />
          <Skeleton className="h-[180px] rounded-[14px]" />
        </div>
      </div>
    </AppShell>
  );
}

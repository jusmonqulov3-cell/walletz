import AppShell from "@/components/AppShell";
import Skeleton from "@/components/ui/Skeleton";

export default function InvestmentsLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div className="flex-1">
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="mt-2 h-3 w-48 rounded-md" />
          </div>
        </div>

        {/* portfolio value card */}
        <Skeleton className="h-[150px] rounded-[14px]" />

        {/* add form */}
        <div className="section">
          <Skeleton className="mb-3 h-4 w-28 rounded-md" />
          <Skeleton className="h-[180px] rounded-[14px]" />
        </div>

        {/* holdings */}
        <div className="section">
          <Skeleton className="h-[200px] rounded-[14px]" />
        </div>
      </div>
    </AppShell>
  );
}

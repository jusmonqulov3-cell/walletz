import AppShell from "@/components/AppShell";
import Skeleton from "@/components/ui/Skeleton";

export default function DebtsLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div className="flex-1">
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="mt-2 h-3 w-40 rounded-md" />
          </div>
        </div>

        {/* net balance hero */}
        <Skeleton className="h-[120px] rounded-[14px]" />

        {/* balance cards */}
        <div className="balcards">
          <Skeleton className="h-[84px] rounded-[14px]" />
          <Skeleton className="h-[84px] rounded-[14px]" />
        </div>

        {/* quick + manual + list */}
        <div className="section">
          <Skeleton className="h-[150px] rounded-[14px]" />
        </div>
        <div className="section">
          <Skeleton className="h-[170px] rounded-[14px]" />
        </div>
        <div className="section">
          <Skeleton className="h-[160px] rounded-[14px]" />
        </div>
      </div>
    </AppShell>
  );
}

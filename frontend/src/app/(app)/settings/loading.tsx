import { Skeleton } from "@/components/ui/skeleton";

// Heading + one panel of skeleton rows (CR-001 design loading state).
export default function SettingsLoading() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลด">
      <Skeleton className="mb-7 h-12 w-72" />
      <div className="space-y-4 rounded-xl border bg-card p-5 shadow-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

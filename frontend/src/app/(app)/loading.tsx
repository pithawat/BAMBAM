import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลด">
      <Skeleton className="h-36 w-full rounded-none rounded-b-[34px] lg:h-11 lg:w-60 lg:rounded-full" />
      <div className="space-y-3 px-4 pt-4 lg:px-0">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}

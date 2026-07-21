import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonListCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-36 rounded-md" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-12 min-w-[200px] flex-1 rounded-sm" />
        <Skeleton className="h-12 w-28 rounded-sm" />
        <Skeleton className="h-12 w-24 rounded-md" />
      </div>

      <SkeletonListCard rows={6} />
    </div>
  );
}

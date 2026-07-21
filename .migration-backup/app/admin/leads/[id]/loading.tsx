import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFormCard, SkeletonListCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-8">
      <Skeleton className="h-4 w-28" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <SkeletonFormCard fields={5} />
      <SkeletonListCard rows={3} />
    </div>
  );
}

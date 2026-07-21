import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFormCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
      <SkeletonFormCard fields={4} />
    </div>
  );
}

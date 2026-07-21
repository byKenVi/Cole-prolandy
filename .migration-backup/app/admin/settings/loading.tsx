import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFormCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <SkeletonFormCard fields={2} />
    </div>
  );
}

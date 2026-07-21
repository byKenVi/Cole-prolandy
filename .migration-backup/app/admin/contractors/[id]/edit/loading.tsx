import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFormCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-52" />
      <SkeletonFormCard fields={6} />
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFormCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </header>
      <SkeletonFormCard fields={5} />
    </div>
  );
}

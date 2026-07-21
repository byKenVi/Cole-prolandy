import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFormCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonFormCard fields={4} />
    </main>
  );
}

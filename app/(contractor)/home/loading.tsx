import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { SkeletonLeadCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
      </header>

      <Card className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-11 w-28 rounded-md" />
      </Card>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-28" />
        <SkeletonLeadCard />
        <SkeletonLeadCard />
      </section>
    </div>
  );
}

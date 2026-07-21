import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { SkeletonListCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-40" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-28" />
        </Card>
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full rounded-sm" />
          <Skeleton className="h-12 w-full rounded-sm" />
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-24" />
        <SkeletonListCard rows={3} />
      </section>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <SkeletonListCard rows={3} />
      </section>
    </div>
  );
}

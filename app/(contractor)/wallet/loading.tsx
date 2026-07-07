import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { SkeletonListCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-24" />

      <Card className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-32" />
      </Card>

      <Card className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-12 w-full rounded-sm" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 rounded-md" />
          <Skeleton className="h-14 rounded-md" />
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <SkeletonListCard rows={4} />
      </section>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-28" />

      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        <Skeleton className="h-6 w-20 rounded-full" />

        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28" />
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </Card>

      <Skeleton className="h-[56px] w-full rounded-md" />
      <Skeleton className="h-[56px] w-full rounded-md" />
    </div>
  );
}

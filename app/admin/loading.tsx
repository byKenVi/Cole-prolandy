import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-28 rounded-md" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-8 w-24" />
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-11 w-28 rounded-md" />
        <Skeleton className="h-11 w-40 rounded-md" />
        <Skeleton className="h-11 w-28 rounded-md" />
      </div>
    </div>
  );
}

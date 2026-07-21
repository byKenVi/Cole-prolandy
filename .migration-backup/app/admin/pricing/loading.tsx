import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-10 w-full" />
          ))}
        </Card>
      ))}
    </div>
  );
}

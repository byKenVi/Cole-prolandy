import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 py-8">
      <div className="flex justify-center">
        <Skeleton className="h-7 w-32" />
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
        <div className="flex flex-col items-center gap-2 py-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-24" />
        </div>
      </Card>

      <Skeleton className="h-[56px] w-full rounded-md" />
      <Skeleton className="h-[56px] w-full rounded-md" />
    </main>
  );
}

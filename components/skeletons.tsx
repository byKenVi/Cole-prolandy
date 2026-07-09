import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Reusable skeleton blocks that MIRROR real content layouts (DESIGN.md §4 —
 * loading states use primary-soft, never a bare spinner, and must not jump when
 * real data arrives). Shared by the route-level loading.tsx files.
 */

/** Mirrors LeadFeedCard: icon tile, title/location, time badge, tier+price, CTA. */
export function SkeletonLeadCard() {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </Card>
  );
}

/** Mirrors the divided list Cards (transactions, contractor rows, etc.). */
export function SkeletonListCard({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="divide-y divide-border p-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </Card>
  );
}

/** Mirrors a form Card: labelled fields + a full-width submit. */
export function SkeletonFormCard({ fields = 4 }: { fields?: number }) {
  return (
    <Card className="flex flex-col gap-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full rounded-sm" />
        </div>
      ))}
      <Skeleton className="h-[56px] w-full rounded-md" />
    </Card>
  );
}

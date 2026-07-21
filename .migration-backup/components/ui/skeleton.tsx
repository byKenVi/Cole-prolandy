import { cn } from "@/lib/utils";

/** Loading skeleton in primary-soft (DESIGN.md §4 — never a blank screen). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary-soft", className)}
      {...props}
    />
  );
}

export { Skeleton };

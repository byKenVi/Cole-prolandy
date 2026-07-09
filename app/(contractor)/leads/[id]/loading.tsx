import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="px-5 py-6 md:px-[34px] md:py-8">
      <Skeleton className="mb-5 h-4 w-28" />
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-[22px] border border-[#EBE3D4] bg-white">
          <Skeleton className="h-[200px] w-full rounded-none" />
          <div className="space-y-5 p-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-[15px]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-52" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex gap-2.5">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <Skeleton className="h-20 w-full rounded-[16px]" />
          </div>
        </div>
        <div className="space-y-4 rounded-[20px] border border-[#EBE3D4] bg-white p-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-28" />
          <div className="flex justify-between border-y border-[#EBE3D4] py-3.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-14 w-full rounded-[14px]" />
          <Skeleton className="h-12 w-full rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}

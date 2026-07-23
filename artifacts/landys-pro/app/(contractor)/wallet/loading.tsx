import { Skeleton } from "@/components/ui/skeleton";

const card = "rounded-[18px] border border-[#EBE3D4] bg-white p-6";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-[#EDE4D3] px-5 pb-5 pt-6 md:px-[34px] md:pt-[26px]">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="px-5 py-6 md:px-[34px]">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-32 w-full rounded-[18px]" />
            <div className={card}>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-4 h-12 w-full rounded-md" />
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Skeleton className="h-14 rounded-md" />
                <Skeleton className="h-14 rounded-md" />
                <Skeleton className="h-14 rounded-md" />
              </div>
            </div>
          </div>
          <div className={card}>
            <Skeleton className="h-6 w-40" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b border-[#F2EBDD] pb-3.5">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

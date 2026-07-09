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
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className={`flex flex-col items-center gap-3 ${card}`}>
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <div className={card}>
            <div className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

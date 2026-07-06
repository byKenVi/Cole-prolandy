import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PriceRow } from "@/components/admin/price-row";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const types = await prisma.contractorType.findMany({
    orderBy: { name: "asc" },
    include: {
      projectTypes: {
        orderBy: { name: "asc" },
        include: { priceTiers: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Pricing matrix</h1>
        <p className="text-sm text-text-muted">
          Lead price per (trade × project × tier). Edits apply to new leads only — existing leads
          keep their snapshotted price.
        </p>
      </div>

      {types.length === 0 ? (
        <EmptyState title="No pricing configured" description="Seed the database to populate the matrix." />
      ) : (
        types.map((ct) => (
          <Card key={ct.id}>
            <h2 className="mb-3 text-lg font-semibold text-text">{ct.name}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-text-muted">
                    <th className="pb-2 pr-3 font-medium">Project</th>
                    <th className="px-2 pb-2 font-medium">Tier 1</th>
                    <th className="px-2 pb-2 font-medium">Tier 2</th>
                    <th className="px-2 pb-2 font-medium">Tier 3</th>
                    <th className="pb-2 pl-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {ct.projectTypes.map((pt) => (
                    <PriceRow
                      key={pt.id}
                      projectTypeName={pt.name}
                      tiers={pt.priceTiers.map((t) => ({
                        id: t.id,
                        tier: t.tier,
                        priceCents: t.priceCents,
                      }))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

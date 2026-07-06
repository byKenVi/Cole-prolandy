import { prisma } from "@/lib/prisma";
import { EstimateForm } from "@/components/estimate-form";

export const dynamic = "force-dynamic";

/**
 * Public estimate form — the landowner intake. Built as a route in this app so
 * it can later be embedded into Wix or fed by a Wix automation/webhook.
 */
export default async function EstimatePage() {
  const [projectTypes, landTypes] = await Promise.all([
    prisma.projectType.findMany({
      orderBy: { name: "asc" },
      include: { contractorType: { select: { name: true } } },
    }),
    prisma.landType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <div className="mb-8 text-center">
        <p className="font-display text-3xl font-semibold text-primary">Get land work done right</p>
        <p className="mt-3 text-base text-text-muted">
          Tell us about your project and we&apos;ll connect you with trusted local land-service pros.
          Free, no obligation.
        </p>
      </div>

      <EstimateForm
        projectTypes={projectTypes.map((p) => ({
          id: p.id,
          name: p.name,
          contractorTypeName: p.contractorType.name,
        }))}
        landTypes={landTypes}
      />
    </main>
  );
}

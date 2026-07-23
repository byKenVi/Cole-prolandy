import { prisma } from "@/lib/prisma";
import { EstimateForm } from "@/components/estimate-form";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Public estimate form — the landowner intake. Built as a route in this app so
 * it can be embedded into Wix (landy.co). Pass `?embed=1` to strip the outer
 * page chrome (logo/heading/margins) for a clean iframe embed.
 */
export default async function EstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const { embed } = await searchParams;
  const isEmbed = embed === "1" || embed === "true";

  const [projectTypes, landTypes] = await Promise.all([
    prisma.projectType.findMany({
      orderBy: { name: "asc" },
      include: { contractorType: { select: { name: true, icon: true } } },
    }),
    prisma.landType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <main
      className={cn(
        "mx-auto w-full max-w-lg",
        isEmbed ? "px-3 py-4" : "px-4 py-10",
      )}
    >
      {!isEmbed && (
        <>
          <div className="mb-6 flex justify-center">
            <BrandLogo className="h-9" priority />
          </div>
          <div className="mb-8 text-center">
            <p className="font-fraunces text-3xl font-semibold text-primary">
              Get land work done right
            </p>
            <p className="mt-3 font-inter text-base text-text-muted">
              Tell us about your project and we&apos;ll connect you with trusted local land-service
              pros. Free, no obligation.
            </p>
          </div>
        </>
      )}

      <EstimateForm
        projectTypes={projectTypes.map((p) => ({
          id: p.id,
          name: p.name,
          contractorTypeName: p.contractorType.name,
          icon: p.contractorType.icon,
        }))}
        landTypes={landTypes}
      />
    </main>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ManualLeadForm } from "@/components/admin/manual-lead-form";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const [projectTypes, landTypes] = await Promise.all([
    prisma.projectType.findMany({
      orderBy: { name: "asc" },
      include: { contractorType: { select: { name: true } } },
    }),
    prisma.landType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/leads" className="flex items-center gap-1 text-sm text-text-muted">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-text">New lead</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manually create a lead (for testing/ops before Wix integration is live). Price is
          snapshotted from the pricing matrix and the lead is distributed immediately.
        </p>
      </div>
      <ManualLeadForm
        projectTypes={projectTypes.map((p) => ({
          id: p.id,
          name: p.name,
          contractorTypeName: p.contractorType.name,
        }))}
        landTypes={landTypes}
      />
    </div>
  );
}

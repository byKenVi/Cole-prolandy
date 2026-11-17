import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Panel, PageHeader } from "@/components/admin/ui";
import { ManualLeadForm } from "@/components/admin/manual-lead-form";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const [contractorCategories, workTypes, landTypes] = await Promise.all([
    prisma.contractorCategory.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    prisma.workType.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    prisma.landType.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  return (
    <div className="admin-fade-up flex flex-col gap-6">
      <Link
        href="/admin/leads"
        className="flex items-center gap-1 text-sm"
        style={{ color: "var(--ink2)", width: "fit-content" }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <PageHeader
        title="New request"
        subtitle="Enter a request taken by phone or email. It goes through the same matching as the ones from landys.co."
      />

      <Panel style={{ padding: "28px 28px 32px" }}>
        <ManualLeadForm
          contractorCategories={contractorCategories}
          workTypes={workTypes}
          landTypes={landTypes}
        />
      </Panel>
    </div>
  );
}

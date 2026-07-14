import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ContractorForm } from "@/components/admin/contractor-form";

export const dynamic = "force-dynamic";

export default async function EditContractorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [contractor, contractorTypes] = await Promise.all([
    prisma.contractor.findUnique({
      where: { id },
      include: { projects: { select: { contractorTypeId: true } } },
    }),
    prisma.contractorType.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!contractor) notFound();

  const projectIds =
    contractor.projects.length > 0
      ? [
          contractor.contractorTypeId,
          ...contractor.projects
            .map((p) => p.contractorTypeId)
            .filter((pid) => pid !== contractor.contractorTypeId),
        ]
      : [contractor.contractorTypeId];

  return (
    <div className="admin-fade-up flex max-w-2xl flex-col gap-6">
      <Link
        href={`/admin/contractors/${id}`}
        className="flex items-center gap-1 text-sm"
        style={{ color: "var(--ink2)" }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to contractor
      </Link>

      <header>
        <h1 className="font-fraunces text-3xl font-semibold" style={{ color: "var(--ink)" }}>
          Edit {contractor.name}
        </h1>
        <p className="text-sm" style={{ color: "var(--ink2)" }}>
          {contractor.clerkUserId
            ? "This contractor has signed in and claimed their profile."
            : "This contractor has not signed in yet. Their profile links automatically when they sign in with the email below."}
        </p>
      </header>

      <Card className="p-6">
        <ContractorForm
          mode="edit"
          contractorId={contractor.id}
          contractorTypes={contractorTypes}
          initial={{
            name: contractor.name,
            email: contractor.email,
            phone: contractor.phone,
            projectIds,
            aboutSection: contractor.aboutSection ?? "",
            businessHours: contractor.businessHours ?? "",
            isPro: contractor.isPro,
          }}
        />
      </Card>
    </div>
  );
}

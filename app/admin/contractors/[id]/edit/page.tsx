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

  const [contractor, contractorTypes, services] = await Promise.all([
    prisma.contractor.findUnique({ where: { id }, include: { services: true } }),
    prisma.contractorType.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!contractor) notFound();

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
          services={services}
          initial={{
            name: contractor.name,
            email: contractor.email,
            phone: contractor.phone,
            contractorTypeId: contractor.contractorTypeId,
            aboutSection: contractor.aboutSection ?? "",
            businessHours: contractor.businessHours ?? "",
            serviceIds: contractor.services.map((s) => s.serviceId),
            isPro: contractor.isPro,
          }}
        />
      </Card>
    </div>
  );
}

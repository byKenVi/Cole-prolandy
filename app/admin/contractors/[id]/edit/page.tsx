import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
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
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href={`/admin/contractors/${id}`}
        className="flex items-center gap-1 text-sm text-text-muted"
      >
        <ArrowLeft className="h-4 w-4" /> Back to contractor
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-text">Edit {contractor.name}</h1>
        <p className="text-sm text-text-muted">
          {contractor.clerkUserId
            ? "This contractor has signed in and claimed their profile."
            : "This contractor has not signed in yet. Their profile links automatically when they sign in with the email below."}
        </p>
      </header>

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
    </div>
  );
}

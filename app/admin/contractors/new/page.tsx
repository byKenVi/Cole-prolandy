import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ContractorForm } from "@/components/admin/contractor-form";

export const dynamic = "force-dynamic";

export default async function NewContractorPage() {
  const [contractorTypes, services] = await Promise.all([
    prisma.contractorType.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/admin/contractors" className="flex items-center gap-1 text-sm text-text-muted">
        <ArrowLeft className="h-4 w-4" /> Back to contractors
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-text">New contractor</h1>
        <p className="mt-1 text-sm text-text-muted">
          Enter the contractor&apos;s details. They can receive leads and hold a wallet balance
          right away — no login required. When they sign in with this email, their profile links
          automatically.
        </p>
      </header>

      <ContractorForm
        mode="create"
        contractorTypes={contractorTypes}
        services={services}
        initial={{
          name: "",
          email: "",
          phone: "",
          contractorTypeId: contractorTypes[0]?.id ?? "",
          aboutSection: "",
          businessHours: "",
          serviceIds: [],
          isPro: false,
        }}
      />
    </div>
  );
}

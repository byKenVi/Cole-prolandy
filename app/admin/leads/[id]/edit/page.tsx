import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { LeadEditForm } from "@/components/admin/lead-edit-form";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      landownerName: true,
      landownerEmail: true,
      landownerPhone: true,
      propertyLocation: true,
      projectType: { select: { name: true } },
    },
  });
  if (!lead) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href={`/admin/leads/${id}`} className="flex items-center gap-1 text-sm text-text-muted">
        <ArrowLeft className="h-4 w-4" /> Back to lead
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold text-text">Edit lead</h1>
        <p className="mt-1 text-sm text-text-muted">{lead.projectType.name}</p>
      </header>

      <Card className="p-6">
        <LeadEditForm
          leadId={lead.id}
          initial={{
            landownerName: lead.landownerName,
            landownerEmail: lead.landownerEmail,
            landownerPhone: lead.landownerPhone,
            propertyLocation: lead.propertyLocation,
          }}
        />
      </Card>
    </div>
  );
}

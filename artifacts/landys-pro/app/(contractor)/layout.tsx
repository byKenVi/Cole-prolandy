import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ProShell } from "@/components/pro/shell";

export const dynamic = "force-dynamic";

export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (session.role === "admin" && !session.viewingAs) {
    redirect("/admin");
  }
  if (session.deactivated) {
    redirect("/deactivated");
  }

  const contractor = session.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: session.contractorId },
        select: { name: true, deactivatedAt: true },
      })
    : null;

  if (contractor?.deactivatedAt) {
    redirect("/deactivated");
  }

  return (
    <ProShell
      contractorId={session.contractorId}
      contractorName={contractor?.name}
      viewingAs={session.viewingAs}
    >
      {children}
    </ProShell>
  );
}

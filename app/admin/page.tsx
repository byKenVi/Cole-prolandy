import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await expireLeads(prisma).catch(() => undefined);

  const [contractors, leads, pendingMatches, acceptedMatches, walletAgg] = await Promise.all([
    prisma.contractor.count(),
    prisma.lead.count(),
    prisma.leadMatch.count({ where: { status: "PENDING" } }),
    prisma.leadMatch.count({ where: { status: "ACCEPTED" } }),
    prisma.contractor.aggregate({ _sum: { walletBalanceCents: true } }),
  ]);

  const revenueAgg = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type: "LEAD_CHARGE" },
  });
  const revenueCents = Math.abs(revenueAgg._sum.amountCents ?? 0);

  const stats = [
    { label: "Contractors", value: String(contractors) },
    { label: "Leads", value: String(leads) },
    { label: "Pending matches", value: String(pendingMatches) },
    { label: "Accepted matches", value: String(acceptedMatches) },
    { label: "Lead revenue", value: formatMoney(revenueCents) },
    { label: "Wallet float", value: formatMoney(walletAgg._sum.walletBalanceCents ?? 0) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Dashboard</h1>
        <Button asChild variant="accent">
          <Link href="/admin/leads/new">New lead</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/admin/leads">View leads</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/contractors">Manage contractors</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/pricing">Edit pricing</Link>
        </Button>
      </div>
    </div>
  );
}

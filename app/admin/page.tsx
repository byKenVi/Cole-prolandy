import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import { Button } from "@/components/ui/button";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REVENUE_WINDOW_DAYS = 30;

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

  // Revenue = accepted-lead charges (LEAD_CHARGE, stored negative) bucketed by
  // local day over the last 30 days, zero-filled so the line is continuous.
  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - (REVENUE_WINDOW_DAYS - 1));

  const charges = await prisma.walletTransaction.findMany({
    where: { type: "LEAD_CHARGE", createdAt: { gte: windowStart } },
    select: { amountCents: true, createdAt: true },
  });

  const byDay = new Map<string, number>();
  for (const c of charges) {
    const key = c.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Math.abs(c.amountCents));
  }

  const revenueSeries = Array.from({ length: REVENUE_WINDOW_DAYS }, (_, i) => {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    return {
      date: key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      revenueCents: byDay.get(key) ?? 0,
    };
  });

  const stats: { label: string; value: string; highlight?: boolean }[] = [
    { label: "Lead revenue", value: formatMoney(revenueCents), highlight: true },
    { label: "Wallet float", value: formatMoney(walletAgg._sum.walletBalanceCents ?? 0), highlight: true },
    { label: "Contractors", value: String(contractors) },
    { label: "Leads", value: String(leads) },
    { label: "Pending matches", value: String(pendingMatches) },
    { label: "Accepted matches", value: String(acceptedMatches) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-text-muted">Your marketplace at a glance.</p>
        </div>
        <Button asChild variant="accent">
          <Link href="/admin/leads/new">New lead</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} highlight={s.highlight} />
        ))}
      </div>

      <section className="rounded-lg bg-surface p-6 shadow-md">
        <div className="mb-4">
          <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
            Lead revenue
          </p>
          <p className="text-xs text-text-muted">Accepted-lead charges over the last 30 days.</p>
        </div>
        <RevenueChart data={revenueSeries} />
      </section>
    </div>
  );
}

/**
 * Admin metric card — real presence (large radius, soft shadow, generous
 * padding, clear hierarchy). Money metrics get a calm primary tint so revenue
 * and wallet float read as the key numbers (DESIGN.md §3–4).
 */
function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-6 shadow-md",
        highlight ? "bg-primary-soft" : "bg-surface",
      )}
    >
      <p className="text-sm font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold leading-tight tabular-nums",
          highlight ? "text-primary" : "text-text",
        )}
      >
        {value}
      </p>
    </div>
  );
}

import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ViewAsButton } from "@/components/admin/view-as-button";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminContractors({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;

  const where: Prisma.ContractorWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter === "pro") where.isPro = true;
  if (filter === "free") where.isPro = false;
  if (filter === "toppro") where.isTopPro = true;

  const contractors = await prisma.contractor.findMany({
    where,
    orderBy: { name: "asc" },
    include: { contractorType: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text">Contractors</h1>
        <Button asChild variant="brand">
          <Link href="/admin/contractors/new">New contractor</Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[200px] flex-1">
          <Input name="q" placeholder="Search name or email" defaultValue={q ?? ""} />
        </div>
        <select
          name="filter"
          defaultValue={filter ?? ""}
          className="h-12 rounded-sm border border-border bg-surface px-3 text-base"
        >
          <option value="">All</option>
          <option value="pro">Pro</option>
          <option value="toppro">Top Pro</option>
          <option value="free">Free</option>
        </select>
        <Button type="submit" variant="brand">
          Search
        </Button>
      </form>

      {contractors.length === 0 ? (
        <EmptyState title="No contractors found" />
      ) : (
        <Card className="divide-y divide-border p-0">
          {contractors.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text">{c.name}</p>
                  {c.isTopPro ? (
                    <Badge variant="success">Top Pro</Badge>
                  ) : c.isPro ? (
                    <Badge>Pro</Badge>
                  ) : (
                    <Badge variant="neutral">Free</Badge>
                  )}
                  {!c.clerkUserId && <Badge variant="neutral">Not signed in</Badge>}
                </div>
                <p className="text-sm text-text-muted">
                  {c.contractorType.name} · {c.email}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-semibold text-text">
                  {formatMoney(c.walletBalanceCents)}
                </span>
                <ViewAsButton contractorId={c.id} />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/contractors/${c.id}`}>Manage</Link>
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

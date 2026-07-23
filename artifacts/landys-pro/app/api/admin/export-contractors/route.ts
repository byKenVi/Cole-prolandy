import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function escapeCsv(value: string): string {
  if (/[,"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(cells: string[]): string {
  return cells.map(escapeCsv).join(",") + "\r\n";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const filter = searchParams.get("filter") ?? undefined;

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { contractorType: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(filter === "deactivated"
      ? { deactivatedAt: { not: null } }
      : { deactivatedAt: null }),
  };

  const contractors = await prisma.contractor.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      name: true,
      email: true,
      phone: true,
      walletBalanceCents: true,
      isPro: true,
      deactivatedAt: true,
      createdAt: true,
      contractorType: { select: { name: true } },
    },
  });

  const lines: string[] = [
    csvRow(["Name", "Email", "Phone", "Company / Type", "Wallet Balance", "Status", "Registration Date"]),
    ...contractors.map((c) =>
      csvRow([
        c.name,
        c.email,
        c.phone ?? "",
        c.contractorType.name,
        formatMoney(c.walletBalanceCents),
        c.deactivatedAt ? "Archived" : c.isPro ? "Pro" : "Free",
        formatDate(c.createdAt),
      ]),
    ),
  ];

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join(""), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contractors-${date}.csv"`,
    },
  });
}

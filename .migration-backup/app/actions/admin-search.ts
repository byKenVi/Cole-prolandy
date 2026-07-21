"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

export type SearchHit =
  | {
      kind: "lead";
      id: string;
      href: string;
      title: string;
      subtitle: string;
    }
  | {
      kind: "contractor";
      id: string;
      href: string;
      title: string;
      subtitle: string;
    };

/** Live autosuggest for the admin topbar search (leads + contractors). */
export async function adminSearchSuggest(query: string): Promise<SearchHit[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 1) return [];

  const [leads, contractors] = await Promise.all([
    prisma.lead.findMany({
      where: {
        OR: [
          { landownerName: { contains: q, mode: "insensitive" } },
          { propertyLocation: { contains: q, mode: "insensitive" } },
          { landownerEmail: { contains: q, mode: "insensitive" } },
          { projectType: { name: { contains: q, mode: "insensitive" } } },
          {
            projectType: {
              contractorType: { name: { contains: q, mode: "insensitive" } },
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        propertyLocation: true,
        priceCents: true,
        projectType: { select: { name: true, contractorType: { select: { name: true } } } },
      },
    }),
    prisma.contractor.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { contractorType: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      orderBy: { name: "asc" },
      take: 6,
      select: {
        id: true,
        name: true,
        email: true,
        contractorType: { select: { name: true } },
      },
    }),
  ]);

  const leadHits: SearchHit[] = leads.map((l) => ({
    kind: "lead",
    id: l.id,
    href: `/admin/leads/${l.id}`,
    title: l.projectType.name,
    subtitle: `${l.projectType.contractorType.name} · ${l.propertyLocation} · ${formatMoney(l.priceCents)}`,
  }));

  const contractorHits: SearchHit[] = contractors.map((c) => ({
    kind: "contractor",
    id: c.id,
    href: `/admin/contractors/${c.id}`,
    title: c.name,
    subtitle: `${c.contractorType.name} · ${c.email}`,
  }));

  return [...leadHits, ...contractorHits].slice(0, 10);
}

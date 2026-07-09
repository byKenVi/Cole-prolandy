import Image from "next/image";
import { MapPin, Phone, Hammer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { iconSrcFor } from "@/lib/project-icons";
import { formatMoney } from "@/lib/money";
import { LeadFeedCard } from "@/components/lead-feed-card";

export const dynamic = "force-dynamic";

type Row = {
  matchId: string;
  projectTypeName: string;
  categoryName: string;
  categoryIcon: string | null;
  location: string;
  tier: number;
  priceCents: number;
  contactName: string;
  contactPhone: string;
};

const GRID =
  "grid-cols-[minmax(180px,2.2fr)_minmax(120px,1.3fr)_minmax(150px,1.6fr)_78px_100px]";

export default async function MyLeadsPage() {
  const session = await getSession();
  if (!session.contractorId) return <Shell rows={[]} />;

  const matches = await prisma.leadMatch.findMany({
    where: { contractorId: session.contractorId, status: "ACCEPTED" },
    orderBy: { acceptedAt: "desc" },
    include: { lead: { include: { projectType: { include: { contractorType: true } } } } },
  });

  const rows: Row[] = matches.map((m) => ({
    matchId: m.id,
    projectTypeName: m.lead.projectType.name,
    categoryName: m.lead.projectType.contractorType.name,
    categoryIcon: m.lead.projectType.contractorType.icon,
    location: m.lead.propertyLocation,
    tier: m.lead.tier,
    priceCents: m.lead.priceCents,
    contactName: m.lead.landownerName,
    contactPhone: m.lead.landownerPhone,
  }));

  return <Shell rows={rows} />;
}

function Shell({ rows }: { rows: Row[] }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[#EDE4D3] px-5 pb-5 pt-6 md:px-[34px] md:pt-[26px]">
        <div>
          <h1 className="font-fraunces text-[30px] font-semibold tracking-[-0.01em] text-[#3A352D]">
            My leads
          </h1>
          <p className="mt-[5px] text-[14px] text-[#8A7E68]">
            {rows.length} accepted {rows.length === 1 ? "job" : "jobs"} — contacts unlocked
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-5 py-6 md:px-[34px]">
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {rows.map((r) => (
                <LeadFeedCard
                  key={r.matchId}
                  lead={{
                    matchId: r.matchId,
                    status: "ACCEPTED",
                    projectTypeName: r.projectTypeName,
                    categoryName: r.categoryName,
                    categoryIcon: r.categoryIcon,
                    location: r.location,
                    tier: r.tier,
                    priceCents: r.priceCents,
                    contact: { name: r.contactName, phone: r.contactPhone },
                  }}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-[18px] border border-[#EBE3D4] bg-white shadow-[0_2px_8px_rgba(58,53,45,0.05)] md:block">
              <div className="overflow-x-auto">
                <div
                  className={`grid ${GRID} min-w-[720px] items-center gap-[14px] border-b border-[#EEE6D6] bg-[#FAF4E9] px-6 py-[14px]`}
                >
                  <Head>Job</Head>
                  <Head>Location</Head>
                  <Head>Contact</Head>
                  <Head>Tier</Head>
                  <Head className="text-right">Paid</Head>
                </div>
                {rows.map((r) => (
                  <LeadRow key={r.matchId} row={r} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Head({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8A7E68] ${className}`}>
      {children}
    </span>
  );
}

function LeadRow({ row }: { row: Row }) {
  const src = iconSrcFor({ icon: row.categoryIcon, category: row.categoryName, project: row.projectTypeName });
  const t2 = row.tier >= 2;
  return (
    <div
      className={`grid ${GRID} min-w-[720px] items-center gap-[14px] border-b border-[#F2EBDD] px-6 py-[15px] last:border-b-0`}
    >
      <div className="flex min-w-0 items-center gap-[14px]">
        <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px] bg-[#F5EEDF]">
          {src ? (
            <Image src={src} alt="" aria-hidden width={60} height={60} className="h-[30px] w-[30px] object-contain" />
          ) : (
            <Hammer className="h-[26px] w-[26px] text-[#9A6E2E]" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold leading-[1.25] text-[#3A352D]">
            {row.projectTypeName}
          </p>
          <p className="mt-0.5 truncate text-[13px] leading-[1.2] text-[#8A7E68]">{row.categoryName}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-[5px] text-[14px] font-medium leading-[1.3] text-[#5A4E3E]">
          <MapPin className="h-[14px] w-[14px] flex-none text-[#B0A691]" strokeWidth={1.7} aria-hidden />
          <span className="truncate">{row.location}</span>
        </p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-[#3A352D]">{row.contactName}</p>
        <a
          href={`tel:${row.contactPhone}`}
          className="mt-0.5 flex items-center gap-[5px] text-[13px] text-[#8A6B2E] hover:underline"
        >
          <Phone className="h-[13px] w-[13px] flex-none" strokeWidth={1.7} aria-hidden />
          <span className="truncate">{row.contactPhone}</span>
        </a>
      </div>
      <div>
        <span
          className="whitespace-nowrap rounded-full px-[10px] py-1.5 text-[11px] font-semibold"
          style={t2 ? { color: "#8A5A1E", background: "#F4E6CE" } : { color: "#7A6E58", background: "#EFE7D8" }}
        >
          Tier {t2 ? 2 : 1}
        </span>
      </div>
      <div className="text-right text-[17px] font-semibold tabular-nums text-[#3A352D]">
        {formatMoney(row.priceCents)}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[18px] border border-[#EBE3D4] bg-white px-10 py-16 text-center shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
      <span className="mb-6 flex h-24 w-24 items-center justify-center rounded-[24px] bg-[#F5EEDF]">
        <Image
          src="/empty-leads-3d.png"
          alt=""
          aria-hidden
          width={112}
          height={112}
          className="h-14 w-14 select-none object-contain opacity-60"
        />
      </span>
      <p className="mb-2.5 font-fraunces text-[24px] font-medium text-[#3A352D]">No accepted leads yet</p>
      <p className="max-w-[44ch] text-[16px] leading-[1.6] text-[#6B6459]">
        When you accept a lead, it lands here with the landowner&apos;s contact details.
      </p>
    </div>
  );
}

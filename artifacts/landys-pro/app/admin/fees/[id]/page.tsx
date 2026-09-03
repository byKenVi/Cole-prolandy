import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Chip, Panel } from "@/components/admin/ui";
import { MarkFeePaidButton } from "@/components/admin/mark-fee-paid-button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { leadScopeLabel } from "@/lib/resolved-lead";

export const dynamic = "force-dynamic";

export default async function AdminFeeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fee = await prisma.successFee.findUnique({
    where: { leadMatchId: id },
    include: {
      leadMatch: {
        include: {
          contractor: { select: { id: true, name: true, email: true } },
          lead: {
            select: {
              id: true,
              propertyLocation: true,
              landownerName: true,
              landownerEmail: true,
              workType: { select: { name: true } },
              projectType: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!fee) notFound();

  const ratePercent = fee.rateBasisPoints / 100;
  const rateLabel = ratePercent % 1 === 0 ? `${ratePercent.toFixed(0)}%` : `${ratePercent.toFixed(1)}%`;
  const status =
    fee.status === "DUE"
      ? { label: "Due", bg: "var(--dangerBg)", fg: "var(--danger)" }
      : fee.status === "PAID"
        ? { label: "Paid", bg: "var(--posBg)", fg: "var(--pos)" }
        : { label: "Contractor awaiting payment", bg: "var(--goldSoft)", fg: "var(--goldSoftFg)" };

  return (
    <div>
      <PageHeader
        kicker="Success fees"
        title={leadScopeLabel(fee.leadMatch.lead)}
        subtitle={`${fee.leadMatch.contractor.name} · ${fee.leadMatch.lead.propertyLocation}`}
        action={
          fee.status === "DUE" ? <MarkFeePaidButton leadMatchId={fee.leadMatchId} prominent /> : undefined
        }
      />

      <Panel style={{ padding: 24, maxWidth: 840 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
          <Chip bg={status.bg} fg={status.fg} dot>
            {status.label}
          </Chip>
          <span style={{ font: "600 28px/1 var(--display)", color: "var(--ink)" }}>
            {formatMoney(fee.feeAmountCents)}
          </span>
        </div>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            font: "400 14px/1.4 'Inter'",
          }}
        >
          <div>
            <dt style={{ color: "var(--ink3)", fontSize: 11, marginBottom: 4 }}>Contractor</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              <Link href={`/admin/contractors/${fee.leadMatch.contractor.id}`}>{fee.leadMatch.contractor.name}</Link>
            </dd>
            <dd style={{ margin: "2px 0 0", color: "var(--ink3)" }}>{fee.leadMatch.contractor.email}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--ink3)", fontSize: 11, marginBottom: 4 }}>Landowner</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{fee.leadMatch.lead.landownerName ?? "—"}</dd>
            <dd style={{ margin: "2px 0 0", color: "var(--ink3)" }}>{fee.leadMatch.lead.landownerEmail}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--ink3)", fontSize: 11, marginBottom: 4 }}>Final contract value</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{formatMoney(fee.finalValueCents)}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--ink3)", fontSize: 11, marginBottom: 4 }}>Success fee %</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{rateLabel}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--ink3)", fontSize: 11, marginBottom: 4 }}>Opened</dt>
            <dd style={{ margin: 0 }}>{formatDate(fee.createdAt)}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--ink3)", fontSize: 11, marginBottom: 4 }}>Due / paid</dt>
            <dd style={{ margin: 0 }}>
              {fee.paidAt ? `Paid ${formatDate(fee.paidAt)}` : fee.dueAt ? `Due ${formatDate(fee.dueAt)}` : "—"}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--ink3)", fontSize: 11, marginBottom: 4 }}>Payment</dt>
            <dd style={{ margin: 0 }}>
              {fee.paymentMethod === "stripe"
                ? "Stripe"
                : fee.paymentMethod === "check"
                  ? "Check"
                  : fee.paymentMethod === "offline"
                    ? "Other offline"
                    : fee.paymentMethod ?? "—"}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--ink3)", fontSize: 11, marginBottom: 4 }}>Reference</dt>
            <dd style={{ margin: 0 }}>{fee.manualPaymentNote ?? fee.paidByAdminId ?? "—"}</dd>
          </div>
        </dl>
        <div style={{ marginTop: 22, display: "flex", gap: 14 }}>
          <Link href={`/admin/leads/${fee.leadMatch.lead.id}`} style={{ color: "var(--gold)", fontWeight: 600 }}>
            View opportunity
          </Link>
          <Link href="/admin/fees" style={{ color: "var(--ink2)" }}>
            All fees
          </Link>
        </div>
      </Panel>
    </div>
  );
}

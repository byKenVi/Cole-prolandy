import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import {
  getAcceptanceUnlimited,
  getFollowUpOutcomeDelayHours,
  getFollowUpPaymentDelayHours,
  getFollowUpPaymentRetryHours,
  getLeadExpiryHours,
  getMaxLeadPurchases,
} from "@/lib/domain/settings";
import { loadSuccessFeeTierRecords } from "@/lib/domain/success-fee";
import { getSession } from "@/lib/auth";
import { SettingsTabs } from "@/components/admin/settings-tabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [
    session,
    maxLeadPurchases,
    leadExpiryHours,
    acceptanceUnlimited,
    followUpOutcomeDelayHours,
    followUpPaymentDelayHours,
    followUpPaymentRetryHours,
    projects,
    landTypes,
    contractorCategories,
    successFeeTiers,
  ] = await Promise.all([
    getSession(),
    getMaxLeadPurchases(prisma),
    getLeadExpiryHours(prisma),
    getAcceptanceUnlimited(prisma),
    getFollowUpOutcomeDelayHours(prisma),
    getFollowUpPaymentDelayHours(prisma),
    getFollowUpPaymentRetryHours(prisma),
    prisma.contractorType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        icon: true,
        _count: { select: { contractors: true } },
        projectType: {
          select: {
            code: true,
            archivedAt: true,
            _count: { select: { leads: true } },
          },
        },
      },
    }),
    prisma.landType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        archivedAt: true,
        _count: { select: { leads: true } },
      },
    }),
    prisma.contractorCategory.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        archivedAt: true,
        _count: { select: { contractors: true, leads: true } },
      },
    }),
    loadSuccessFeeTierRecords(prisma),
  ]);

  return (
    <Suspense fallback={<div className="admin-fade-up" style={{ color: "var(--ink2)" }}>Loading settings…</div>}>
      <SettingsTabs
        isOwner={session.adminRole === "owner"}
        maxLeadPurchases={maxLeadPurchases}
        leadExpiryHours={leadExpiryHours}
        acceptanceUnlimited={acceptanceUnlimited}
        followUpOutcomeDelayHours={followUpOutcomeDelayHours}
        followUpPaymentDelayHours={followUpPaymentDelayHours}
        followUpPaymentRetryHours={followUpPaymentRetryHours}
        successFeeTiers={successFeeTiers.map((tier) => ({
          id: tier.id,
          sortOrder: tier.sortOrder,
          label:
            tier.sortOrder === 1 ? "SMALL" : tier.sortOrder === 2 ? "MEDIUM" : "LARGE",
          maxValueDollars: tier.maxValueCents != null ? tier.maxValueCents / 100 : null,
          ratePercent: tier.rateBasisPoints / 100,
        }))}
        projects={projects.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          code: c.projectType?.code ?? "",
          archived: Boolean(c.projectType?.archivedAt),
          contractors: c._count.contractors,
          leads: c.projectType?._count.leads ?? 0,
        }))}
        landTypes={landTypes.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          archived: Boolean(t.archivedAt),
          leads: t._count.leads,
        }))}
        contractorCategories={contractorCategories.map((category) => ({
          id: category.id,
          name: category.name,
          code: category.code,
          archived: Boolean(category.archivedAt),
          contractors: category._count.contractors,
          leads: category._count.leads,
        }))}
      />
    </Suspense>
  );
}

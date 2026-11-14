"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContractorId } from "@/lib/auth";

export type PreferenceResult = { ok: true; message: string } | { ok: false; message: string };

/** Pause new job requests for N days (vacation, full schedule); `null` resumes. */
export async function setLeadsPause(days: number | null): Promise<PreferenceResult> {
  let contractorId: string;
  try {
    contractorId = await requireContractorId();
  } catch {
    return { ok: false, message: "Please sign in again." };
  }
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 180)) {
    return { ok: false, message: "Choose a pause between 1 and 180 days." };
  }
  const until = days === null ? null : new Date(Date.now() + days * 24 * 3600 * 1000);
  await prisma.contractor.update({ where: { id: contractorId }, data: { leadsPausedUntil: until } });
  await prisma.auditLog.create({
    data: {
      actorType: "contractor",
      actorId: contractorId,
      action: until ? "contractor.leads.paused" : "contractor.leads.resumed",
      targetType: "Contractor",
      targetId: contractorId,
      metadata: { until: until?.toISOString() ?? null },
    },
  });
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: until
      ? `Paused. You will not receive new job requests until ${until.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
      : "You will receive new job requests again.",
  };
}

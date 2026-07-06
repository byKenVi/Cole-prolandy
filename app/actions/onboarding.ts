"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getSession, authMode } from "@/lib/auth";

const ProfileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(7, "A valid phone number is required"),
  contractorTypeId: z.string().min(1, "Choose your trade"),
  aboutSection: z.string().max(1000).optional().or(z.literal("")),
  businessHours: z.string().max(200).optional().or(z.literal("")),
  serviceIds: z.array(z.string()).default([]),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

export type SaveProfileResult = { ok: true; created: boolean } | { ok: false; message: string };

export async function saveProfile(input: ProfileInput): Promise<SaveProfileResult> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const session = await getSession();
  let contractorId = session.contractorId;
  let created = false;

  // Onboarding: create the Contractor on first Clerk sign-in.
  if (!contractorId) {
    if (authMode() !== "clerk") {
      return { ok: false, message: "No contractor context to save." };
    }
    const { userId } = await auth();
    if (!userId) return { ok: false, message: "You are not signed in." };
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return { ok: false, message: "Your account has no email address." };

    const verifiedEmails = (user?.emailAddresses ?? [])
      .filter((e) => e.verification?.status === "verified")
      .map((e) => e.emailAddress.toLowerCase().trim())
      .filter(Boolean);

    // Prefer adopting an existing admin-created (unclaimed) row with a matching
    // VERIFIED email before creating a duplicate. Guard keeps one row → one user.
    const adoptedId =
      verifiedEmails.length === 0
        ? null
        : await prisma.$transaction(async (tx) => {
            for (const em of verifiedEmails) {
              const existing = await tx.contractor.findFirst({
                where: { email: { equals: em, mode: "insensitive" }, clerkUserId: null },
                select: { id: true },
              });
              if (existing) {
                const res = await tx.contractor.updateMany({
                  where: { id: existing.id, clerkUserId: null },
                  data: { clerkUserId: userId },
                });
                if (res.count === 1) {
                  await tx.auditLog.create({
                    data: {
                      actorType: "contractor",
                      actorId: userId,
                      action: "contractor.clerk.linked",
                      targetType: "Contractor",
                      targetId: existing.id,
                      metadata: { via: "email", source: "onboarding" },
                    },
                  });
                  return existing.id;
                }
              }
            }
            return null;
          });

    // Adopted an existing profile → keep its data, route straight to the app.
    if (adoptedId) {
      revalidatePath("/profile");
      revalidatePath("/home");
      return { ok: true, created: true };
    }

    try {
      const contractor = await prisma.contractor.create({
        data: {
          clerkUserId: userId,
          email,
          name: data.name,
          phone: data.phone,
          contractorTypeId: data.contractorTypeId,
          aboutSection: data.aboutSection || null,
          businessHours: data.businessHours || null,
          isPro: false,
        },
      });
      contractorId = contractor.id;
      created = true;
    } catch {
      return {
        ok: false,
        message:
          "An account with this email already exists and is linked to another login. Contact support.",
      };
    }
  }

  // Keep only service selections that belong to the chosen trade.
  const validServices = await prisma.service.findMany({
    where: { id: { in: data.serviceIds }, contractorTypeId: data.contractorTypeId },
    select: { id: true },
  });
  const validIds = validServices.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    if (!created) {
      await tx.contractor.update({
        where: { id: contractorId! },
        data: {
          name: data.name,
          phone: data.phone,
          contractorTypeId: data.contractorTypeId,
          aboutSection: data.aboutSection || null,
          businessHours: data.businessHours || null,
        },
      });
    }
    await tx.contractorService.deleteMany({ where: { contractorId: contractorId! } });
    for (const serviceId of validIds) {
      await tx.contractorService.create({ data: { contractorId: contractorId!, serviceId } });
    }
  });

  revalidatePath("/profile");
  revalidatePath("/home");
  return { ok: true, created };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getSession, authMode } from "@/lib/auth";
import { normalizePhoneForStorage } from "@/lib/phone";

/**
 * Contractor self-service profile fields only.
 * Project assignment is admin-controlled (PENDING CLIENT confirmation on whether
 * contractors ever get self-service over which projects they receive).
 */
const ProfileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(7, "A valid phone number is required"),
  aboutSection: z.string().max(1000).optional().or(z.literal("")),
  businessHours: z.string().max(280).optional().or(z.literal("")),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

export type SaveProfileResult = { ok: true; created: boolean } | { ok: false; message: string };

export async function saveProfile(input: ProfileInput): Promise<SaveProfileResult> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const phone = normalizePhoneForStorage(data.phone);

  const session = await getSession();
  let contractorId = session.contractorId;

  // Onboarding: only adopt an admin-created (unclaimed) row. New contractors are
  // created by Landy's — self-signup cannot invent project assignments.
  if (!contractorId) {
    if (authMode() !== "clerk") {
      return { ok: false, message: "No contractor context to save." };
    }
    const { userId } = await auth();
    if (!userId) return { ok: false, message: "You are not signed in." };
    const user = await currentUser();

    const verifiedEmails = (user?.emailAddresses ?? [])
      .filter((e) => e.verification?.status === "verified")
      .map((e) => e.emailAddress.toLowerCase().trim())
      .filter(Boolean);

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
                  data: {
                    clerkUserId: userId,
                    name: data.name,
                    phone,
                    aboutSection: data.aboutSection || null,
                    businessHours: data.businessHours || null,
                  },
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

    if (adoptedId) {
      revalidatePath("/profile");
      revalidatePath("/home");
      return { ok: true, created: true };
    }

    return {
      ok: false,
      message:
        "Your login isn’t linked to a contractor profile yet. Contact Landy’s so they can set you up and assign the jobs you receive.",
    };
  }

  await prisma.contractor.update({
    where: { id: contractorId },
    data: {
      name: data.name,
      phone,
      aboutSection: data.aboutSection || null,
      businessHours: data.businessHours || null,
      // Intentionally do NOT update contractorTypeId / projects / services —
      // lead routing is admin-owned.
    },
  });

  revalidatePath("/profile");
  revalidatePath("/home");
  return { ok: true, created: false };
}

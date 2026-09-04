"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  contractorLogoKey,
  contractorLogoUrl,
  deleteAppObject,
  putAppObject,
} from "@/lib/replit-object-storage";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type LogoUploadResult =
  | { ok: true; logoUrl: string }
  | { ok: false; message: string };

/**
 * Contractor profile / logo upload backed by Replit App Storage.
 */
export async function uploadContractorLogo(formData: FormData): Promise<LogoUploadResult> {
  const session = await getSession();
  if (!session.contractorId) {
    return { ok: false, message: "You must be signed in as a contractor." };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image file." };
  }
  if (!ALLOWED.has(file.type)) {
    return { ok: false, message: "Use a JPG, PNG, WebP, or GIF image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Image must be under 2 MB." };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";

  const buffer = Buffer.from(await file.arrayBuffer());
  const objectKey = `contractor-logos/${session.contractorId}/${Date.now()}.${ext}`;
  const storedLogoUrl = contractorLogoUrl(objectKey);
  try {
    await putAppObject({ key: objectKey, bytes: buffer, contentType: file.type });
  } catch (error) {
    console.error("[profile-logo] App Storage upload failed", error);
    return { ok: false, message: "Logo upload failed. Please try again." };
  }

  const previous = await prisma.contractor.findUnique({
    where: { id: session.contractorId },
    select: { logoUrl: true },
  });
  await prisma.contractor.update({
    where: { id: session.contractorId },
    data: { logoUrl: storedLogoUrl },
  });

  const previousObject = contractorLogoKey(previous?.logoUrl);
  if (previousObject) {
    await deleteAppObject(previousObject).catch((error) => {
      console.error("[profile-logo] Old logo cleanup failed", error);
    });
  }

  revalidatePath("/profile");
  revalidatePath("/home");
  return { ok: true, logoUrl: storedLogoUrl };
}

export async function clearContractorLogo(): Promise<LogoUploadResult> {
  const session = await getSession();
  if (!session.contractorId) {
    return { ok: false, message: "You must be signed in as a contractor." };
  }
  const previous = await prisma.contractor.findUnique({
    where: { id: session.contractorId },
    select: { logoUrl: true },
  });
  await prisma.contractor.update({
    where: { id: session.contractorId },
    data: { logoUrl: null },
  });
  const previousObject = contractorLogoKey(previous?.logoUrl);
  if (previousObject) {
    await deleteAppObject(previousObject).catch((error) => {
      console.error("[profile-logo] Logo removal failed", error);
    });
  }
  revalidatePath("/profile");
  return { ok: true, logoUrl: "" };
}

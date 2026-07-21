"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  CONTRACTOR_LOGOS_BUCKET,
  ensureContractorLogosBucket,
  getStorageAdmin,
  storageObjectPath,
} from "@/lib/supabase-storage";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type LogoUploadResult =
  | { ok: true; logoUrl: string }
  | { ok: false; message: string };

/**
 * Contractor profile / logo upload. Production stores in Supabase Storage so
 * files survive serverless/Replit restarts. Local dev can fall back to public/.
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
  const storage = getStorageAdmin();
  let storedLogoUrl: string;

  if (storage) {
    try {
      await ensureContractorLogosBucket(storage);
      const objectPath = `${session.contractorId}/${Date.now()}.${ext}`;
      const { error } = await storage.storage
        .from(CONTRACTOR_LOGOS_BUCKET)
        .upload(objectPath, buffer, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
      if (error) throw error;
      storedLogoUrl = storage.storage.from(CONTRACTOR_LOGOS_BUCKET).getPublicUrl(objectPath)
        .data.publicUrl;
    } catch (error) {
      console.error("[profile-logo] Supabase upload failed", error);
      return { ok: false, message: "Logo upload failed. Please try again." };
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      console.error("[profile-logo] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
      return { ok: false, message: "Logo storage is not configured." };
    }
    const dir = path.join(process.cwd(), "public", "uploads", "contractors");
    await mkdir(dir, { recursive: true });
    const filename = `${session.contractorId}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    storedLogoUrl = `/uploads/contractors/${filename}`;
  }

  const previous = await prisma.contractor.findUnique({
    where: { id: session.contractorId },
    select: { logoUrl: true },
  });
  await prisma.contractor.update({
    where: { id: session.contractorId },
    data: { logoUrl: storedLogoUrl },
  });

  const previousObject = storageObjectPath(previous?.logoUrl);
  if (storage && previousObject) {
    const { error } = await storage.storage
      .from(CONTRACTOR_LOGOS_BUCKET)
      .remove([previousObject]);
    if (error) console.error("[profile-logo] Old logo cleanup failed", error);
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
  const storage = getStorageAdmin();
  const previousObject = storageObjectPath(previous?.logoUrl);
  if (storage && previousObject) {
    const { error } = await storage.storage
      .from(CONTRACTOR_LOGOS_BUCKET)
      .remove([previousObject]);
    if (error) console.error("[profile-logo] Logo removal failed", error);
  }
  revalidatePath("/profile");
  return { ok: true, logoUrl: "" };
}

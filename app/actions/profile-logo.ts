"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type LogoUploadResult =
  | { ok: true; logoUrl: string }
  | { ok: false; message: string };

/**
 * Contractor profile / logo upload. Stores under public/uploads/contractors
 * and saves the public path on the Contractor row.
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

  const dir = path.join(process.cwd(), "public", "uploads", "contractors");
  await mkdir(dir, { recursive: true });
  const filename = `${session.contractorId}.${ext}`;
  const abs = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buffer);

  const logoUrl = `/uploads/contractors/${filename}?v=${Date.now()}`;
  await prisma.contractor.update({
    where: { id: session.contractorId },
    data: { logoUrl: `/uploads/contractors/${filename}` },
  });

  revalidatePath("/profile");
  revalidatePath("/home");
  return { ok: true, logoUrl };
}

export async function clearContractorLogo(): Promise<LogoUploadResult> {
  const session = await getSession();
  if (!session.contractorId) {
    return { ok: false, message: "You must be signed in as a contractor." };
  }
  await prisma.contractor.update({
    where: { id: session.contractorId },
    data: { logoUrl: null },
  });
  revalidatePath("/profile");
  return { ok: true, logoUrl: "" };
}

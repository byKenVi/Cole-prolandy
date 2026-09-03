import { createHash } from "node:crypto";
import { getStorageAdmin } from "@/lib/supabase-storage";
import type { WixEstimateAttachment } from "@/lib/integrations/wix/estimate-contract";
import { assertSafeDownloadUrl } from "@/lib/integrations/attachments/url-safety";
import {
  LEAD_ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/storage-buckets";

export { assertSafeDownloadUrl } from "@/lib/integrations/attachments/url-safety";

export { LEAD_ATTACHMENTS_BUCKET, MAX_ATTACHMENT_BYTES } from "@/lib/storage-buckets";
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return base || "attachment.bin";
}

async function fetchWithRedirects(url: URL, redirects = 0): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= MAX_REDIRECTS) throw new Error("Too many redirects.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect missing location header.");
      const next = await assertSafeDownloadUrl(new URL(location, url).toString());
      return fetchWithRedirects(next, redirects + 1);
    }
    if (!response.ok) throw new Error(`Download failed with status ${response.status}.`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadAndStoreAttachment(attachment: WixEstimateAttachment): Promise<{
  storageKey: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
}> {
  if (attachment.sizeBytes != null && attachment.sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment exceeds maximum size.");
  }

  const url = await assertSafeDownloadUrl(attachment.downloadUrl);
  const response = await fetchWithRedirects(url);
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment exceeds maximum size.");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty attachment response.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ATTACHMENT_BYTES) throw new Error("Attachment exceeds maximum size.");
    chunks.push(value);
  }

  const bytes = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const filename = sanitizeFilename(attachment.fileName);
  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    attachment.mimeType ||
    "application/octet-stream";

  const storage = getStorageAdmin();
  if (!storage) throw new Error("Private storage is not configured.");

  const storageKey = `leads/${createHash("sha256").update(url.toString()).digest("hex")}/${filename}`;
  const { error } = await storage.storage.from(LEAD_ATTACHMENTS_BUCKET).upload(storageKey, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);

  return { storageKey, filename, contentType, bytes };
}

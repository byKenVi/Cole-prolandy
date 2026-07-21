import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const CONTRACTOR_LOGOS_BUCKET = "contractor-logos";

let client: SupabaseClient | null | undefined;
let bucketReady: Promise<void> | null = null;

export function getStorageAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    client = null;
    return client;
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Ensure the public image bucket exists. Safe under concurrent first uploads. */
export async function ensureContractorLogosBucket(storage: SupabaseClient): Promise<void> {
  if (bucketReady) return bucketReady;

  bucketReady = (async () => {
    const { data } = await storage.storage.getBucket(CONTRACTOR_LOGOS_BUCKET);
    if (data) return;

    const { error } = await storage.storage.createBucket(CONTRACTOR_LOGOS_BUCKET, {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      fileSizeLimit: 2 * 1024 * 1024,
    });

    if (error) {
      // Another request may have created it after getBucket().
      const retry = await storage.storage.getBucket(CONTRACTOR_LOGOS_BUCKET);
      if (!retry.data) throw error;
    }
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });

  return bucketReady;
}

export function storageObjectPath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${CONTRACTOR_LOGOS_BUCKET}/`;
  try {
    const parsed = new URL(publicUrl);
    const index = parsed.pathname.indexOf(marker);
    return index === -1 ? null : decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

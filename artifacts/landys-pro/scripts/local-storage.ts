/** Initialize and smoke-test the isolated Supabase DEV Storage buckets. */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseIsolation } from "../lib/ops/database-safety";
import {
  CONTRACTOR_LOGOS_BUCKET,
  LEAD_ATTACHMENTS_BUCKET,
} from "../lib/storage-buckets";

async function main() {
  if (process.env.LANDYS_ENV !== "local") {
    throw new Error('Refusing: LANDYS_ENV must be exactly "local".');
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();
  const expectedProjectRef = process.env.LOCAL_SUPABASE_PROJECT_REF?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!databaseUrl || !directUrl || !expectedProjectRef || !supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "DATABASE_URL, DIRECT_URL, LOCAL_SUPABASE_PROJECT_REF, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  assertLocalSupabaseIsolation({
    databaseUrl,
    directUrl,
    expectedProjectRef,
    supabaseUrl,
  });

  const storage = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const desired = [
    {
      id: CONTRACTOR_LOGOS_BUCKET,
      options: {
        public: true,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        fileSizeLimit: 2 * 1024 * 1024,
      },
    },
    {
      id: LEAD_ATTACHMENTS_BUCKET,
      options: {
        public: false,
        fileSizeLimit: 20 * 1024 * 1024,
      },
    },
  ];

  for (const bucket of desired) {
    const existing = await storage.storage.getBucket(bucket.id);
    const result = existing.data
      ? await storage.storage.updateBucket(bucket.id, bucket.options)
      : await storage.storage.createBucket(bucket.id, bucket.options);
    if (result.error) throw result.error;
  }

  const marker = `local-storage-smoke/${randomUUID()}.txt`;
  const first = Buffer.from("landys-local-storage-v1");
  const replacement = Buffer.from("landys-local-storage-v2");

  const logoBucket = storage.storage.from(CONTRACTOR_LOGOS_BUCKET);
  const initialLogo = await logoBucket.upload(marker, first, {
    contentType: "image/png",
    upsert: false,
  });
  if (initialLogo.error) throw initialLogo.error;
  const replacedLogo = await logoBucket.upload(marker, replacement, {
    contentType: "image/png",
    upsert: true,
  });
  if (replacedLogo.error) throw replacedLogo.error;
  const publicUrl = logoBucket.getPublicUrl(marker).data.publicUrl;
  const publicResponse = await fetch(publicUrl);
  if (!publicResponse.ok || (await publicResponse.text()) !== replacement.toString()) {
    throw new Error("Public contractor-logo replacement verification failed.");
  }
  const removedLogo = await logoBucket.remove([marker]);
  if (removedLogo.error) throw removedLogo.error;

  const attachmentBucket = storage.storage.from(LEAD_ATTACHMENTS_BUCKET);
  const uploadedAttachment = await attachmentBucket.upload(marker, first, {
    contentType: "text/plain",
    upsert: true,
  });
  if (uploadedAttachment.error) throw uploadedAttachment.error;
  const signed = await attachmentBucket.createSignedUrl(marker, 60);
  if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error("No signed URL.");
  const signedResponse = await fetch(signed.data.signedUrl);
  if (!signedResponse.ok || (await signedResponse.text()) !== first.toString()) {
    throw new Error("Private signed attachment download verification failed.");
  }
  const removedAttachment = await attachmentBucket.remove([marker]);
  if (removedAttachment.error) throw removedAttachment.error;

  const buckets = await storage.storage.listBuckets();
  if (buckets.error) throw buckets.error;
  const byId = new Map(buckets.data.map((bucket) => [bucket.id, bucket]));
  if (!byId.get(CONTRACTOR_LOGOS_BUCKET)?.public) {
    throw new Error("contractor-logos must be public.");
  }
  if (byId.get(LEAD_ATTACHMENTS_BUCKET)?.public !== false) {
    throw new Error("lead-attachments-private must be private.");
  }

  console.log("✓ DEV Storage initialized and verified (public logos, private attachments).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

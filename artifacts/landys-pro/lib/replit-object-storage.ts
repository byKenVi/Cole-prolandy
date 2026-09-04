import { landysEnvironment } from "@/lib/runtime-environment";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

type ObjectMethod = "GET" | "PUT" | "DELETE";

function privateObjectDir(): string {
  const value = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!value) throw new Error("Replit App Storage is not configured.");
  return value.replace(/\/+$/, "");
}

function normalizedKey(key: string): string {
  const value = key.replace(/^\/+/, "");
  if (!value || value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid App Storage object key.");
  }
  return value;
}

function splitObjectPath(path: string): { bucketName: string; objectName: string } {
  const parts = path.replace(/^\/+/, "").split("/");
  if (parts.length < 2) throw new Error("Invalid App Storage path.");
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

function fullObjectPath(key: string): string {
  return `${privateObjectDir()}/${landysEnvironment()}/${normalizedKey(key)}`;
}

async function signedObjectUrl(
  key: string,
  method: ObjectMethod,
  ttlSeconds = 300,
): Promise<string> {
  const { bucketName, objectName } = splitObjectPath(fullObjectPath(key));
  const response = await fetch(`${SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`App Storage signing failed (${response.status}).`);
  const payload = (await response.json()) as { signed_url?: string };
  if (!payload.signed_url) throw new Error("App Storage did not return a signed URL.");
  return payload.signed_url;
}

export async function putAppObject(params: {
  key: string;
  bytes: Buffer;
  contentType: string;
}): Promise<void> {
  const url = await signedObjectUrl(params.key, "PUT", 900);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": params.contentType },
    body: new Uint8Array(params.bytes),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`App Storage upload failed (${response.status}).`);
}

export async function deleteAppObject(key: string): Promise<void> {
  const url = await signedObjectUrl(key, "DELETE", 300);
  const response = await fetch(url, {
    method: "DELETE",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`App Storage delete failed (${response.status}).`);
  }
}

export function getAppObjectDownloadUrl(key: string, ttlSeconds = 300): Promise<string> {
  return signedObjectUrl(key, "GET", ttlSeconds);
}

const LOGO_ROUTE_PREFIX = "/storage/contractor-logos/";

export function contractorLogoUrl(key: string): string {
  const normalized = normalizedKey(key);
  if (!normalized.startsWith("contractor-logos/")) {
    throw new Error("Contractor logo key is outside its storage namespace.");
  }
  return `/storage/${normalized}`;
}

export function contractorLogoKey(url: string | null | undefined): string | null {
  if (!url?.startsWith(LOGO_ROUTE_PREFIX)) return null;
  const key = url.slice("/storage/".length);
  try {
    return normalizedKey(key);
  } catch {
    return null;
  }
}
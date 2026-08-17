import dns from "node:dns/promises";
import net from "node:net";

export async function assertSafeDownloadUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid attachment URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Attachment URLs must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Attachment URLs must not include credentials.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Localhost attachment URLs are not allowed.");
  }
  const addresses = await dns.lookup(host, { all: true });
  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("Attachment URL resolves to a private network address.");
  }
  return url;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    return false;
  }
  if (ip === "::1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80")) return true;
  return false;
}

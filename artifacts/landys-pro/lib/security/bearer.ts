import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time check of "Authorization: Bearer <secret>". */
export function hasBearer(authorization: string | null, secret: string | undefined): boolean {
  if (!authorization || !secret) return false;
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supplied) return false;
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

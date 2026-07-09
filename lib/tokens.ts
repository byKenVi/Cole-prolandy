import { randomBytes } from "crypto";

/**
 * Cryptographically-random, URL-safe token for the unauthenticated tokenized
 * SMS accept link. 32 random bytes → 256 bits of entropy (~43 base64url chars).
 *
 * This token is the ONLY credential guarding the accept path, so it MUST be
 * unguessable. The Prisma schema still carries a cuid() default, but cuid is
 * NOT cryptographically random — always pass this value explicitly at every
 * LeadMatch creation site so the weak default is never used.
 */
export function generateAcceptToken(): string {
  return randomBytes(32).toString("base64url");
}

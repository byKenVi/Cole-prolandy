import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const WIX_ESTIMATE_SOURCE = "wix" as const;

export const WixEstimateRequestSchema = z
  .object({
    source: z.literal(WIX_ESTIMATE_SOURCE),
    externalRequestId: z.string().trim().min(1).max(160),
    firstName: z.string().trim().max(80).optional().nullable(),
    lastName: z.string().trim().max(80).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    email: z.string().trim().email().max(320),
    propertyZip: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/),
    contractorCategoryCode: z.string().trim().min(1).max(80).optional().nullable(),
    landTypeCode: z.string().trim().min(1).max(80),
    projectTypeCode: z.string().trim().min(1).max(80),
    budget: z.string().trim().min(1).max(280),
    timeline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()),
        "Invalid timeline date",
      ),
    urgency: z.string().trim().min(1).max(280),
    description: z.string().trim().min(10).max(4000),
    routingMode: z.enum(["general", "direct"]),
    directContractorExternalId: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.routingMode === "direct" && !value.directContractorExternalId) {
      context.addIssue({
        code: "custom",
        path: ["directContractorExternalId"],
        message: "Direct requests require directContractorExternalId.",
      });
    }
    if (value.routingMode === "general" && value.directContractorExternalId) {
      context.addIssue({
        code: "custom",
        path: ["directContractorExternalId"],
        message: "General requests cannot specify a direct contractor.",
      });
    }
  });

export type WixEstimateRequest = z.infer<typeof WixEstimateRequestSchema>;

export function wixEstimatePayloadHash(payload: WixEstimateRequest): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function hasValidBearerSecret(
  authorization: string | null,
  expectedSecret: string | undefined,
): boolean {
  if (!authorization?.startsWith("Bearer ") || !expectedSecret) return false;
  const supplied = authorization.slice("Bearer ".length);
  if (!supplied) return false;

  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expectedSecret).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { EstimateFieldsSchema } from "@/lib/integrations/estimate-fields";

export const WIX_ESTIMATE_SOURCE = "wix" as const;
export const WIX_ESTIMATE_REQUEST_SOURCE = {
  GENERAL: "general/get-three-estimates",
  DIRECT: "direct-contractor-profile-request",
} as const;

export const WixEstimateRequestSchema = EstimateFieldsSchema.extend({
  source: z.enum([
    WIX_ESTIMATE_REQUEST_SOURCE.GENERAL,
    WIX_ESTIMATE_REQUEST_SOURCE.DIRECT,
  ]),
  externalRequestId: z.string().trim().min(1).max(160),
  externalContractorId: z.string().trim().min(1).max(160).optional(),
})
  .strict()
  .superRefine((value, context) => {
    if (
      value.source === WIX_ESTIMATE_REQUEST_SOURCE.DIRECT &&
      !value.externalContractorId
    ) {
      context.addIssue({
        code: "custom",
        path: ["externalContractorId"],
        message: "Direct contractor requests require externalContractorId.",
      });
    }
    if (
      value.source === WIX_ESTIMATE_REQUEST_SOURCE.GENERAL &&
      value.externalContractorId
    ) {
      context.addIssue({
        code: "custom",
        path: ["externalContractorId"],
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

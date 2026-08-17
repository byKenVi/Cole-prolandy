import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { WixEstimateFieldsSchema } from "@/lib/integrations/wix/estimate-fields-ext";

export const WIX_ESTIMATE_SOURCE = "wix" as const;
export const WIX_CONTRACTOR_SOURCE = "wix" as const;
export const WIX_ESTIMATE_REQUEST_SOURCE = {
  GENERAL: "general/get-three-estimates",
  DIRECT: "direct-contractor-profile-request",
} as const;

export const WixEstimateRequestSchema = WixEstimateFieldsSchema.extend({
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
        message: "Direct contractor requests require externalContractorId (Wix _id).",
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
export type { WixEstimateAttachment } from "@/lib/integrations/wix/estimate-fields-ext";

/** Stable payload hash — attachment order normalized, URLs included for idempotency. */
export function wixEstimatePayloadHash(payload: WixEstimateRequest): string {
  const normalized = {
    ...payload,
    attachments: [...(payload.attachments ?? [])].sort((a, b) =>
      a.downloadUrl.localeCompare(b.downloadUrl),
    ),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function hasValidBearerSecret(
  authorization: string | null,
  expectedSecret: string | undefined,
): boolean {
  if (!authorization || !expectedSecret) return false;
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : authorization;
  if (!supplied) return false;

  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expectedSecret).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

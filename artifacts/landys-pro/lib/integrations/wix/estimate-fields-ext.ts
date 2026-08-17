import { z } from "zod";
import { EstimateFieldsSchema } from "@/lib/integrations/estimate-fields";

export const WixAttachmentSchema = z
  .object({
    downloadUrl: z.string().url().max(2048),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().max(120).optional(),
    sizeBytes: z.number().int().positive().max(20 * 1024 * 1024).optional(),
  })
  .strict();

export type WixEstimateAttachment = z.infer<typeof WixAttachmentSchema>;

export const WixEstimateFieldsSchema = EstimateFieldsSchema.extend({
  budgetCents: z.number().int().positive().optional(),
  attachments: z.array(WixAttachmentSchema).max(5).optional(),
}).strict();

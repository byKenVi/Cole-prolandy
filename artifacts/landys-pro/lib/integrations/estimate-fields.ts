import { z } from "zod";

/** Shared estimate field validation for public and Wix intake routes. */
export const EstimateFieldsSchema = z.object({
  firstName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(320),
  propertyZip: z
    .string()
    .trim()
    .regex(/^\d{5}(?:-\d{4})?$/, "Please enter a valid property ZIP"),
  contractorCategoryCode: z.string().trim().min(1).max(80).optional().nullable(),
  landTypeCode: z.string().trim().min(1, "Please choose a land type").max(80),
  projectTypeCode: z.string().trim().min(1, "Please choose a project type").max(80),
  budget: z.string().trim().min(1, "Please enter a budget").max(280),
  timeline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid timeline date")
    .refine(
      (value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()),
      "Please choose a valid timeline date",
    ),
  urgency: z.string().trim().min(1, "Please enter the urgency").max(280),
  description: z.string().trim().min(10, "Please describe the project").max(4000),
});

export const OfficialEstimateSchema = EstimateFieldsSchema.extend({
  schemaVersion: z.literal(2),
  company: z.string().optional(),
}).strict();

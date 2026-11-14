/**
 * The public /estimate form (and POST /api/estimate) predates the landys.co
 * integration. In production landys.co is the only lead source, so the form is
 * off unless PUBLIC_ESTIMATE_FORM_ENABLED="true" — an open form would let
 * anyone trigger SMS to contractors.
 */
export function publicEstimateFormEnabled(): boolean {
  if (process.env.PUBLIC_ESTIMATE_FORM_ENABLED === "true") return true;
  if (process.env.PUBLIC_ESTIMATE_FORM_ENABLED === "false") return false;
  return process.env.NODE_ENV !== "production";
}

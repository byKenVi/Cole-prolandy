/** Format a saved card for UI, e.g. "Visa •••• 4242". */
export function formatCardLabel(brand?: string | null, last4?: string | null): string | null {
  if (!last4 && !brand) return null;
  const niceBrand = brand
    ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
    : "Card";
  if (last4) return `${niceBrand} •••• ${last4}`;
  return niceBrand;
}

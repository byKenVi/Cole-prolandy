import { redirect } from "next/navigation";

/** Legacy pay-per-lead pricing matrix — removed from active admin UI. */
export default function AdminPricingRedirect() {
  redirect("/admin/settings");
}

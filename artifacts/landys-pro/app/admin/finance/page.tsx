import { redirect } from "next/navigation";

/** Legacy wallet/finance UI — success fees are managed under Success fees + Settings. */
export default function AdminFinanceRedirect() {
  redirect("/admin/fees");
}

import { revalidatePath } from "next/cache";

/** Invalidate contractor shell (sidebar wallet) + wallet/home pages. */
export function revalidateContractorShell() {
  revalidatePath("/wallet", "layout");
  revalidatePath("/home", "layout");
  revalidatePath("/leads", "layout");
  revalidatePath("/profile", "layout");
}

/** Invalidate admin shell (lead revenue) + key admin pages. */
export function revalidateAdminShell() {
  revalidatePath("/admin", "layout");
}

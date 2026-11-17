import { revalidatePath } from "next/cache";

/** Invalidate the contractor frame (navigation counts) and its main pages. */
export function revalidateContractorShell() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/opportunities");
  revalidatePath("/jobs");
  revalidatePath("/fees");
}

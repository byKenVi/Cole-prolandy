"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_COOKIES, type Role } from "@/lib/auth";

const YEAR = 60 * 60 * 24 * 365;

/** DEV auth only: switch between contractor and admin, or pick a contractor. */
export async function setDevRole(role: Role) {
  const jar = await cookies();
  jar.set(AUTH_COOKIES.role, role, { path: "/", maxAge: YEAR });
  if (role === "admin") jar.delete(AUTH_COOKIES.viewAs);
  revalidatePath("/", "layout");
}

export async function setDevContractor(contractorId: string) {
  const jar = await cookies();
  jar.set(AUTH_COOKIES.contractor, contractorId, { path: "/", maxAge: YEAR });
  revalidatePath("/", "layout");
}

/**
 * Admin "View as contractor". Sets only the view-as cookie so it works in both
 * dev and clerk modes (the admin role itself comes from the session).
 */
export async function viewAsContractor(contractorId: string) {
  const jar = await cookies();
  jar.set(AUTH_COOKIES.viewAs, contractorId, { path: "/", maxAge: YEAR });
  redirect("/home");
}

export async function exitViewAs() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIES.viewAs);
  redirect("/admin/contractors");
}

"use client";

import { UserButton } from "@clerk/nextjs";

/** Clerk account menu (sign out, manage). Rendered only in clerk mode. */
export function UserMenu() {
  return <UserButton afterSignOutUrl="/" />;
}

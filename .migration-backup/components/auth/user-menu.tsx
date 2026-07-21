"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";

/** Clerk account menu (sign out, manage). Rendered only in clerk mode. */
export function UserMenu() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // UserButton injects a host div only on the client — defer until mount
  // so SSR HTML matches the first client render.
  if (!mounted) {
    return (
      <span
        className="inline-block h-8 w-8 shrink-0 rounded-full bg-black/10"
        aria-hidden
      />
    );
  }

  return <UserButton afterSignOutUrl="/" />;
}

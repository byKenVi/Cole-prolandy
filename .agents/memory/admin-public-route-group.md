---
name: Admin public route group
description: How to serve a public page at an /admin/* URL without going through the admin auth layout
---

## Rule

Public pages that live at an `/admin/...` URL but must NOT require authentication must be placed in a route group (`app/(public)/admin/.../page.tsx`), NOT inside `app/admin/`.

**Why:** `app/admin/layout.tsx` redirects any non-admin session to `/home`. Pages inside `app/admin/` always inherit this layout. There is no way to "skip" a parent layout in Next.js App Router — a child `layout.tsx` wraps content within the parent, it doesn't replace it.

**How to apply:** When creating a page at `/admin/invite` (or any similar public-admin URL):
1. Create `app/(public)/admin/invite/page.tsx` — the `(public)` route group is NOT part of the URL.
2. Do NOT create `app/admin/invite/page.tsx` (would inherit admin layout and redirect unauthenticated users).
3. No layout override file is needed; the route group simply lives outside the `app/admin/` segment tree.

## Related: Clerk sign-in detection on public pages

For public client components that need to know if the user is signed in (e.g. to show "sign in to accept" vs "accept"), use Clerk's `useAuth()` hook — NOT a `fetch("/api/...")` call. The api-server proxy intercepts all `/api/*` routes and may not forward to the Next.js handler you created.

```tsx
import { useAuth } from "@clerk/nextjs";
const { isLoaded, isSignedIn } = useAuth();
const signedIn = isLoaded ? (isSignedIn ?? false) : null; // null = loading
```

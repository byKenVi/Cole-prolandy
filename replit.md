# Landy's Pro

A land-service lead-generation platform that sends local job leads straight to contractors' phones — no subscriptions, no chasing.

## Run & Operate

- **Dev (Replit):** workflow `artifacts/landys-pro: web` runs automatically — Next.js on port 21066 (proxied to `/`)
- **Dev (local):** `npm run dev` inside `artifacts/landys-pro/` — or use whatever script is in the project's `package.json`
- **Prisma generate:** `cd artifacts/landys-pro && ./node_modules/.bin/prisma generate`
- **Prisma migrate (dev):** `cd artifacts/landys-pro && ./node_modules/.bin/prisma migrate dev`
- **Full workspace typecheck:** `pnpm run typecheck`

## Stack

- **Framework:** Next.js 15 App Router, React 19, strict TypeScript
- **Auth:** Clerk (`@clerk/nextjs`) — keyless/dev mode when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is absent
- **DB:** Supabase PostgreSQL via Prisma ORM (schema at `artifacts/landys-pro/prisma/schema.prisma`)
- **Payments:** Stripe (mock mode when `STRIPE_MOCK=true`)
- **Notifications:** Twilio SMS + Resend email (mock when `TWILIO_MOCK=true` / `RESEND_MOCK=true`)
- **Storage:** Supabase Storage
- **Styling:** Tailwind CSS v3 + `tailwindcss-animate`
- **Package manager (workspace):** pnpm — the Next.js app itself is `artifacts/landys-pro/`

## Where things live

```
artifacts/landys-pro/
├── app/              Next.js App Router pages, layouts, server actions
├── app/actions/      Server actions (admin, leads, onboarding, wallet, etc.)
├── app/api/          API routes (estimate, Stripe webhook, cron)
├── components/       Shared UI components
├── lib/              Utilities, Prisma client, auth helpers, formatters
├── prisma/           Prisma schema + migrations
└── public/           Static assets (logo, 3D hero images, icons)
```

## Architecture decisions

- **Next.js only** — no Vite, no Express, no separate frontend/backend. Server Components, Server Actions, and API routes handle everything.
- **Prisma over Drizzle** — the app uses `@prisma/client`; the workspace `lib/db` (Drizzle) is unused by this artifact.
- **pnpm workspace wrapper** — the Next.js app lives at `artifacts/landys-pro/` inside the Replit pnpm workspace. The app source files are git-tracked alongside the workspace config.
- **Tailwind v3** — uses `tailwind.config.ts` (not the Tailwind v4 CSS-first approach used by other workspace artifacts). `tailwindcss-animate` is imported as ESM (`import tailwindAnimate from "tailwindcss-animate"`) to avoid `require()` issues under pnpm's ESM context.
- **Auth modes** — `AUTH_MODE=dev` bypasses Clerk; role is read from cookies (`lp_role`, `lp_contractor`). Clerk publishable key needed for production.

## GitHub sync

The Next.js source lives at `artifacts/landys-pro/`. When pushing/pulling via GitHub:
- Local edits to `app/`, `components/`, `lib/`, `prisma/`, config files all live under `artifacts/landys-pro/`
- Replit-specific files (`pnpm-workspace.yaml`, `artifacts/landys-pro/.replit-artifact/`, workspace `lib/`, `artifacts/api-server/`) are Replit-only and should be kept out of the app's own git history if you use a separate repo for the Next.js app

## User preferences

- **Do not** convert this app to Vite, CRA, Express, or any other framework.
- **Do not** replace Prisma with Drizzle or Supabase with Replit Database.
- **Do not** move or restructure `app/`, `prisma/`, `next.config.ts`, `middleware.ts`, `instrumentation.ts`.
- The framework, package manager choice (npm locally), and source layout must stay identical to the local/Vercel version.

## Database & testing safety

- **Dev, tests, and production share one database.** `DATABASE_URL`/`DIRECT_URL` are the same for the dev workflow, `vitest`, the Playwright testing subagent, and the deployed app — there is no separate throwaway DB. Anything a script or automated test does to real-looking rows is a real, permanent mutation.
- **Never write a test plan (manual script or testing subagent) that iterates/sweeps every row of an admin list** to exercise a destructive action (deactivate, delete, refund, bulk edit). Scope destructive test steps to one clearly pre-created/marked test record.
- `deactivateContractor`, `deleteContractor`, and `refundLead` (`app/actions/admin.ts`) are gated by a burst guard (`lib/domain/destructive-guard.ts`): it blocks a rapid repeat of the *same* destructive action by the *same* admin (5+ within 2 minutes), without ever blocking normal single-row admin use. This exists because an automated sweep mass-deactivated 66 real contractors on Aug 26-27 2026 before this guard was added — see `.agents/memory/shared-dev-prod-database-risk.md` for the incident writeup.
- **Staging is a separate Repl/deployment and separate Postgres database**, not this production Repl's dev preview. Follow `artifacts/landys-pro/docs/staging.md`. Staging reset/reseed commands require `LANDYS_ENV=staging`, a clearly named staging URL, dedicated staging DB secrets, and a DB marker.

## Gotchas

- Tailwind config uses `import tailwindAnimate from "tailwindcss-animate"` (not `require()`). Keep it this way — pnpm's module resolution treats `.ts` configs as ESM.
- `engines.node` in `artifacts/landys-pro/package.json` warns about Node version mismatch (Replit runs Node 24, spec says `>=22 <23`). This is cosmetic and safe to ignore.
- Prisma client generation is blocked by pnpm's build-script security. Run `./node_modules/.bin/prisma generate` manually after fresh installs, or use `pnpm approve-builds` interactively.
- Clerk "keyless mode" CORS errors in the browser console are harmless in dev — the landing page still renders correctly.
- **vitest is not installable via pnpm** in this Replit environment (package firewall blocks the tarball). Test files (`lib/**/*.test.ts`) are excluded from the main `tsconfig.json` so `tsc --noEmit` passes clean. Run `npm test` locally (where npm resolves vitest normally); vitest is not listed in `package.json` to keep `pnpm install` working.

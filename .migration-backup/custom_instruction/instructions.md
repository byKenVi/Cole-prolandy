# Authoritative project constraints

Work inside the existing Landy's Pro repository only.

- Preserve the Next.js 15 App Router architecture and React 19.
- Do not convert the project to Vite, Create React App, Express, or a generic
  Replit React template.
- Keep Prisma + external Supabase PostgreSQL, Clerk, Stripe, Twilio, Resend,
  Server Actions, API routes, middleware, and cron behavior intact.
- Use npm and the committed package lock. Do not change package managers.
- Do not expose secrets or place them in tracked files.
- Do not rewrite `.replit`, `replit.nix`, `next.config.ts`, or the deployment
  scripts unless the user explicitly requests an infrastructure change.
- Make focused changes, test them, and keep GitHub synchronization clean.

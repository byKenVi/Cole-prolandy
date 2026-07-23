import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// ── Invitation / magic-link ticket accept (BEFORE the FAPI proxy) ────────────
// GET /api/__clerk/v1/tickets/accept is hit when a user clicks a Clerk
// invitation or email link. Proxying that GET to frontend-api.clerk.dev trips
// Cloudflare's bot challenge → blank 403 on fresh browsers (.replit.app cannot
// load /cdn-cgi/* or store clerk.dev clearance cookies).
//
// Clerk's accept endpoint only issues a redirect with __clerk_ticket; the real
// validation happens later in <SignUp/> via signUp.create({ strategy: "ticket" }).
// Short-circuit locally with the same redirect invitations already declare
// (redirectUrl → /sign-up). POST and every other FAPI path still go to the proxy.
app.get(`${CLERK_PROXY_PATH}/v1/tickets/accept`, (req, res) => {
  const ticket = typeof req.query.ticket === "string" ? req.query.ticket : "";
  if (!ticket) {
    res.redirect(302, "/sign-up");
    return;
  }
  const params = new URLSearchParams({ __clerk_ticket: ticket });
  res.redirect(302, `/sign-up?${params.toString()}`);
});

// ── Clerk FAPI proxy ─────────────────────────────────────────────────────────
// Must be mounted BEFORE body parsers — the proxy streams raw bytes.
// In production Replit sets CLERK_PROXY_URL so Clerk JS routes auth calls
// through /api/__clerk; this middleware forwards those to Clerk's FAPI.
// In development NODE_ENV≠production so the middleware is a no-op pass-through.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors());

// Body parsing only for routes THIS server owns. Routes forwarded to Next.js
// must NOT have their body pre-parsed — Stripe's webhook signature verification
// reads the raw request body and will fail if Express has already consumed it.
app.use("/api/healthz", express.json(), express.urlencoded({ extended: true }));

// Owned routes.
app.use("/api", router);

// ── Transparent proxy for all other /api/* routes ────────────────────────────
// The Replit path-based router sends every /api/* request to this server, but
// this app only owns /api/healthz. Everything else (e.g. /api/stripe/webhook,
// /api/post-auth-redirect) belongs to the Next.js app and is forwarded here
// with the raw body preserved so signature-verified webhooks work correctly.
const NEXTJS_PORT = process.env.NEXTJS_PORT ?? "21066";
const nextjsProxy = createProxyMiddleware({
  target: `http://localhost:${NEXTJS_PORT}`,
  changeOrigin: false,
  logger: console,
});
app.use(nextjsProxy);

export default app;

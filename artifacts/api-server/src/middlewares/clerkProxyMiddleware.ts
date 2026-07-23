/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 * - Must rewrite FAPI Location redirects back through this proxy (handshake /
 *   magic-link flows). Without that, fresh browsers follow Clerk's absolute
 *   frontend-api.clerk.dev Location and get a blank 403 on .replit.app.
 * - Must preserve multi-value Set-Cookie headers (session cookies).
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "http";
import type { RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
const CLERK_FAPI_HOST = new URL(CLERK_FAPI).host;
export const CLERK_PROXY_PATH = "/api/__clerk";

/**
 * Returns the first effective public hostname for the given request,
 * preferring x-forwarded-host over the Host header so callers behind a
 * proxy see the original client-facing host.
 *
 * x-forwarded-host can take three shapes:
 *   - undefined (no proxy involved)
 *   - a single string (one proxy hop)
 *   - a comma-delimited string when an upstream appended rather than
 *     replaced the header (Node folds duplicate headers this way), or a
 *     string[] in some Express typings
 * In the multi-value case, the leftmost value is the original client-
 * facing host. Take that one in all forms. Exported so that app.ts
 * (clerkMiddleware callback) and this proxy middleware agree on which
 * hostname is canonical — otherwise multi-domain/custom-domain flows
 * break.
 */
export function getClerkProxyHost(req: {
  headers: IncomingHttpHeaders;
}): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = raw?.split(",")[0]?.trim();
  return firstHop || req.headers.host?.trim() || undefined;
}

function getClerkProxyOrigin(req: IncomingMessage): string {
  const protoHeader = req.headers["x-forwarded-proto"];
  const protoRaw = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const protocol = protoRaw?.split(",")[0]?.trim() || "https";
  const host = getClerkProxyHost(req) || "";
  return `${protocol}://${host}`;
}

/**
 * Mirror Clerk's official clerkFrontendApiProxy behavior:
 * rewrite Location redirects that point at the FAPI host so the browser
 * stays on our proxy path (required for handshake + magic-link cookies).
 */
function rewriteClerkLocationHeader(
  headers: IncomingHttpHeaders,
  req: IncomingMessage,
): void {
  const locationHeader = headers["location"];
  const location = Array.isArray(locationHeader)
    ? locationHeader[0]
    : locationHeader;
  if (!location) return;

  try {
    const locationUrl = new URL(location, CLERK_FAPI);
    if (locationUrl.host !== CLERK_FAPI_HOST) return;

    const proxyUrl = `${getClerkProxyOrigin(req)}${CLERK_PROXY_PATH}`;
    headers["location"] =
      `${proxyUrl}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;
  } catch {
    // Leave Location as-is if parsing fails (relative / unexpected values).
  }
}

/**
 * Preserve every Set-Cookie value. Spreading proxy headers is usually fine
 * in Node, but normalize to a string[] so multi-cookie handshake responses
 * never collapse into a single invalid cookie (drops __client / __client_uat).
 */
function preserveSetCookieHeaders(headers: IncomingHttpHeaders): void {
  const setCookie = headers["set-cookie"];
  if (!setCookie) return;
  headers["set-cookie"] = Array.isArray(setCookie) ? setCookie : [setCookie];
}

function prepareProxyResponseHeaders(
  proxyRes: IncomingMessage,
  req: IncomingMessage,
): IncomingHttpHeaders {
  const headers: IncomingHttpHeaders = { ...proxyRes.headers };
  // Transfer-Encoding/Connection are hop-by-hop (RFC 7230 §6.1).
  delete headers["transfer-encoding"];
  delete headers["connection"];
  delete headers["keep-alive"];

  rewriteClerkLocationHeader(headers, req);
  preserveSetCookieHeaders(headers);

  return headers;
}

function writeProxiedHead(
  res: ServerResponse,
  status: number,
  headers: IncomingHttpHeaders,
): void {
  // Content-Length is forbidden on 1xx/204; HEAD/304 may keep theirs.
  if (status < 200 || status === 204) {
    delete headers["content-length"];
  }
  res.writeHead(status, headers);
}

export function clerkProxyMiddleware(): RequestHandler {
  // Only run proxy in production — Clerk proxying doesn't work for dev instances
  if (process.env.NODE_ENV !== "production") {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    // Take over the response so it can be re-sent with a Content-Length (see
    // proxyRes); the deployment edge rejects chunked proxied responses.
    // Also required so we can rewrite Location + normalize Set-Cookie.
    selfHandleResponse: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        const proxyUrl = `${getClerkProxyOrigin(req)}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
      // Clerk's dynamic Frontend API responses (/v1/environment, /v1/client,
      // JWKS, ...) arrive without a Content-Length, so relaying them would use
      // Transfer-Encoding: chunked — which the deployment edge (Cloud Run)
      // rejects, turning the app's 200 into a 500. Buffer only those so they can
      // be re-sent with a Content-Length; the body is forwarded untouched so
      // Content-Encoding is preserved. Length-known responses (e.g. /npm/*
      // assets) and body-less responses stream through without buffering.
      proxyRes: (proxyRes, req, res) => {
        const headers = prepareProxyResponseHeaders(proxyRes, req);
        const status = proxyRes.statusCode ?? 502;

        const bodyless =
          req.method === "HEAD" ||
          status < 200 ||
          status === 204 ||
          status === 304;
        if (headers["content-length"] !== undefined || bodyless) {
          writeProxiedHead(res, status, headers);
          // Headers are already sent, so abort the response if the upstream
          // stream errors mid-pipe (e.g. ECONNRESET) rather than leaving an
          // unhandled 'error' or a hung client.
          proxyRes.on("error", () => res.destroy());
          proxyRes.pipe(res);
          return;
        }

        const chunks: Buffer[] = [];
        proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on("end", () => {
          const body = Buffer.concat(chunks);
          headers["content-length"] = String(body.length);
          writeProxiedHead(res, status, headers);
          res.end(body);
        });
        proxyRes.on("error", () => {
          if (!res.headersSent) {
            // Set a length so the empty 502 isn't sent chunked (which the
            // deployment edge would reject just like the original response).
            res.writeHead(502, { "content-length": "0" });
          }
          res.end();
        });
      },
    },
  }) as RequestHandler;
}

import { Barlow, Barlow_Semi_Condensed, Great_Vibes } from "next/font/google";

/**
 * Self-hosted fonts (next/font): no render-blocking request to Google Fonts and
 * no layout shift, which matters for Core Web Vitals on the indexed pages.
 *
 * Two families carry the whole product:
 *  - Barlow for interface and body text (road-sign heritage, very legible on
 *    phones in the sun, good tabular figures for money);
 *  - Barlow Semi Condensed for headings, places and amounts;
 *  - Great Vibes only for the "Landys" script wordmark (landys.co brand).
 *
 * next/font hashes family names, so CSS must reach them through the variables
 * (--nf-ui, --nf-head), never by a literal family name. globals.css exposes
 * them as --ui and --head and aliases the legacy --nf-* names.
 */
const ui = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--nf-ui",
});
const head = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--nf-head",
});
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", display: "swap", variable: "--nf-great-vibes" });

export const fontVariables = [ui, head, greatVibes].map((font) => font.variable).join(" ");

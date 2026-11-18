import { Caveat, Fraunces, Great_Vibes, Inter, JetBrains_Mono, Rubik } from "next/font/google";

/**
 * Self-hosted fonts (next/font): no render-blocking request to Google Fonts and
 * no layout shift, which matters for Core Web Vitals on the indexed pages.
 * Each font exposes a CSS variable (--nf-*) used by app/globals.css and
 * app/pro.css; `fontVariables` is applied once on <html>.
 */
const rubik = Rubik({ subsets: ["latin"], display: "swap", variable: "--nf-rubik" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", axes: ["opsz"], variable: "--nf-fraunces" });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", display: "swap", variable: "--nf-great-vibes" });
const caveat = Caveat({ subsets: ["latin"], display: "swap", variable: "--nf-caveat" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--nf-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--nf-jetbrains" });

export const fontVariables = [rubik, fraunces, greatVibes, caveat, inter, jetbrains]
  .map((font) => font.variable)
  .join(" ");

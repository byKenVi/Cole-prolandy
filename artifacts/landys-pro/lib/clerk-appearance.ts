import type { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

// Derive the appearance type from the SignIn component's props so we stay
// in sync with whatever version of @clerk/nextjs is installed without
// requiring a separate @clerk/types peer.
type ClerkAppearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;

/**
 * Shared Clerk component appearance — matches the Landy's Pro design tokens
 * (see app/globals.css and tailwind.config.ts).
 *
 * Uses `variables` (safe across Clerk versions) to theme the hosted UI, with
 * targeted `elements` overrides only where variables aren't granular enough.
 *
 * Card chrome is stripped so our page wrapper is the only card (avoids the
 * double-box look). Clerk's built-in footer is hidden; pages own the
 * sign-in / request-access links.
 */
export const clerkAppearance: ClerkAppearance = {
  variables: {
    // Brand palette
    colorPrimary: "#2F4A3C",
    colorDanger: "#B23B3B",
    colorSuccess: "#3F7D52",
    colorWarning: "#C99A2E",
    // Surfaces
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FEFBF6",
    colorInputText: "#3A332C",
    // Typography
    colorText: "#3A332C",
    colorTextSecondary: "#8A7F6D",
    colorTextOnPrimaryBackground: "#FFFFFF",
    // Spacing & shape
    borderRadius: "0.75rem",
    fontFamily: "var(--ui)",
    // Contractors are often older and on phones: 17px base, large controls.
    fontSize: "1.0625rem",
    fontWeight: {
      normal: 400,
      medium: 500,
      bold: 600,
    },
  },
  elements: {
    rootBox: "w-full",
    // Strip Clerk's nested card chrome — page supplies the single outer card.
    cardBox: "w-full shadow-none border-0 bg-transparent rounded-none",
    card: "shadow-none border-0 bg-transparent p-0 gap-4 w-full",
    main: "gap-4",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    // Form inputs — match the app's field style
    formFieldInput:
      "min-h-[56px] border-2 border-border bg-white text-text placeholder:text-text-muted focus:ring-primary focus:border-primary rounded-xl text-[18px]",
    formFieldLabel: "text-text text-[17px] font-semibold",
    // Primary action button
    formButtonPrimary:
      "min-h-[58px] text-[18px] bg-primary hover:bg-primary-hover active:bg-[#1e3026] text-white font-semibold rounded-xl shadow-sm transition-colors",
    // Social / secondary buttons — overflow visible so "Last used" badge isn't clipped
    socialButtonsBlockButton:
      "relative overflow-visible min-h-[56px] border-2 border-border bg-surface text-text hover:bg-[#F5F0E8] rounded-xl font-medium transition-colors",
    socialButtonsBlockButtonText: "text-[17px] font-medium",
    // Divider
    dividerLine: "bg-border",
    dividerText: "text-text-muted text-xs",
    // Hide Clerk footer — pages render a single CTA (Request access / Sign in)
    footer: "hidden",
    footerAction: "hidden",
    footerActionLink: "text-accent hover:text-accent-hover font-medium",
    footerActionText: "text-text-muted text-sm",
    // Identifier / alternate links inside the form
    identityPreviewText: "text-text text-[17px]",
    identityPreviewEditButton: "text-accent hover:text-accent-hover",
    // OTP / code input
    otpCodeFieldInput:
      "min-h-[56px] text-[22px] border-2 border-border bg-white text-text rounded-xl focus:ring-primary focus:border-primary",
    // Error messages
    formFieldErrorText: "text-danger text-[15px]",
    alertText: "text-[16px]",
    // Back link
    backLink: "text-accent hover:text-accent-hover text-[16px] font-medium",
    // Spinner
    spinner: "text-primary",
  },
};

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
    fontFamily: '"Rubik", ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontSize: "0.9375rem",
    fontWeight: {
      normal: 400,
      medium: 500,
      bold: 600,
    },
  },
  elements: {
    // Remove Clerk's card chrome; we wrap in our own card
    card: "shadow-none border-0 bg-transparent p-0 gap-4",
    headerTitle: "font-semibold text-text text-[1.25rem] leading-tight",
    headerSubtitle: "text-text-muted text-sm",
    // Form inputs — match the app's field style
    formFieldInput:
      "border-border bg-[#FEFBF6] text-text placeholder:text-text-muted focus:ring-primary focus:border-primary rounded-xl text-sm",
    formFieldLabel: "text-text text-sm font-medium",
    // Primary action button
    formButtonPrimary:
      "bg-primary hover:bg-primary-hover active:bg-[#1e3026] text-white font-semibold rounded-xl shadow-sm transition-colors",
    // Social / secondary buttons
    socialButtonsBlockButton:
      "border-border bg-surface text-text hover:bg-[#F5F0E8] rounded-xl font-medium transition-colors",
    socialButtonsBlockButtonText: "text-sm font-medium",
    // Divider
    dividerLine: "bg-border",
    dividerText: "text-text-muted text-xs",
    // Footer links
    footerActionLink: "text-accent hover:text-accent-hover font-medium",
    footerActionText: "text-text-muted text-sm",
    // Identifier / alternate links inside the form
    identityPreviewText: "text-text text-sm",
    identityPreviewEditButton: "text-accent hover:text-accent-hover",
    // OTP / code input
    otpCodeFieldInput:
      "border-border bg-[#FEFBF6] text-text rounded-xl focus:ring-primary focus:border-primary",
    // Error messages
    formFieldErrorText: "text-danger text-xs",
    alertText: "text-sm",
    // Back link
    backLink: "text-accent hover:text-accent-hover text-sm font-medium",
    // Spinner
    spinner: "text-primary",
  },
};

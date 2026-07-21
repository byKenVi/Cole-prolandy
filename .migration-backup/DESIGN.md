# Landy's Pro interface rules

## Visual system

- Use the semantic colors, typography, spacing, radii, and shadows defined in
  `tailwind.config.ts` and `app/globals.css`.
- Keep the land-inspired green, gold, cream, and warm-neutral palette.
- Prefer existing UI primitives over one-off controls.

## Interaction

- Design phone-first and keep primary actions thumb-reachable.
- Inputs keep visible labels, a minimum 48px height, clear focus states, and
  16px text on mobile.
- Disable pending actions to prevent duplicate financial or lead operations.
- Use layout-matched skeletons for loading states; avoid blank screens.

## Business information

- Money is stored and calculated in integer cents and formatted only for display.
- Never display fabricated operational metrics or fallback records.
- Explain financial values in plain language and distinguish estimates from
  authoritative Stripe or database values.

## Critical flows

- Lead acceptance must make price, wallet balance, and consequences obvious.
- Contact information stays hidden until acceptance.
- Authentication and contractor assignment must not rely on visual state alone.

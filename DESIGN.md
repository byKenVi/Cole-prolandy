# DESIGN.md — Landy's Pro

> **Read this file before building or modifying any UI.** It is the single source of truth for the look and feel of Landy's Pro. Every screen must comply. When a design decision isn't covered here, choose the option most consistent with the principles below, then note it.

---

## 1. The one principle that governs everything

**Simple for the pro. Premium for the brand.**

Two audiences, one product, opposite needs:

- **The contractor (pro)** is often older, low-tech, on a phone in a truck or on a bulldozer, sometimes with one bar of signal. Some barely use smartphones. Their screens must be **radically simple**: one primary action per screen, huge tap targets, minimal reading, no navigation puzzles. If a 60-year-old excavator operator can't complete the task in under 15 seconds with his thumb, the screen has failed — no matter how it looks.
- **The brand** must feel **high-end** — Airbnb-tier polish, calm confidence, considered spacing and type. This is what earns trust and justifies the premium positioning.

These are not in tension if you hold the line: **simplicity is the interaction; premium is the finish.** Simple flows, beautifully rendered.

When in doubt, remove. The best pro screen is the one with the fewest things on it.

---

## 2. Mobile-first, always

- **Design at 375px width first.** Build and verify the phone layout before touching tablet/desktop. Desktop is the enhancement, not the baseline — especially for contractor screens, which are phone-only in practice.
- **Tap targets: minimum 44×44px.** Primary actions (Accept, Add Funds) should be larger — full-width buttons, 56px tall.
- **Thumb zone:** the primary action lives in the lower half of the screen, reachable by a thumb. Never put the main CTA top-right on a contractor screen.
- **One primary action per screen.** Secondary actions are visually quieter (ghost/outline), never competing for attention.
- **Text is legible outdoors:** minimum 16px body on contractor screens (also prevents iOS input zoom). High contrast. No thin weights for content.
- Everything is fully responsive and works down to 320px without horizontal scroll.
- Test loading, empty, and error states at 375px too — they are part of the design, not an afterthought.

---

## 3. Design tokens

Define these as CSS variables and mirror them into the Tailwind theme (`tailwind.config.ts`). Never hardcode a hex, spacing value, or radius in a component — always reference a token.

### Color — an earthy, natural "land" palette

The brand lives close to the land: deep forest greens, warm neutrals, a crisp actionable accent. Calm and premium, not loud.

```css
:root {
  /* Brand greens (primary) */
  --color-primary:        #2F4A3C;  /* deep forest — primary brand, headers, key CTAs */
  --color-primary-hover:  #263C31;
  --color-primary-soft:   #E7EDE8;  /* tinted backgrounds, selected states */

  /* Accent (action / go) */
  --color-accent:         #C6733B;  /* warm terracotta — high-intent actions, "Accept" */
  --color-accent-hover:   #AE6231;

  /* Warm neutrals (surfaces & text) */
  --color-bg:             #FAF8F4;  /* app background — warm off-white */
  --color-surface:        #FFFFFF;  /* cards, sheets */
  --color-border:         #E6E1D8;  /* hairlines, dividers */
  --color-text:           #23271F;  /* primary text — near-black, warm */
  --color-text-muted:     #6B6F66;  /* secondary text, meta */

  /* Semantic */
  --color-success:        #3F7D52;  /* accepted, paid, positive balance */
  --color-warning:        #C99A2E;  /* low balance, expiring soon */
  --color-danger:         #B23B3B;  /* insufficient funds, declined, errors */
  --color-success-soft:   #E6F0E9;
  --color-warning-soft:   #F7EFD8;
  --color-danger-soft:    #F5E3E3;
}
```

**Usage rules**
- `--color-primary` = the brand and structural UI. `--color-accent` = the *one* thing you want the pro to tap (Accept lead, Add funds). Never use accent for two competing actions on the same screen.
- Money: positive balance in `--color-text`; low/insufficient in `--color-warning`/`--color-danger`. Never rely on color alone — pair with a label ("Low balance") for outdoor legibility and accessibility.
- Maintain WCAG AA contrast (4.5:1 body, 3:1 large text) against whatever background the text sits on.

### Typography

```css
:root {
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-display: "Fraunces", "Inter", serif; /* premium serif for brand/marketing headings ONLY */

  /* Type scale (mobile-first) */
  --text-xs:   0.75rem;  /* 12 — meta, timestamps */
  --text-sm:   0.875rem; /* 14 — secondary */
  --text-base: 1rem;     /* 16 — body (min on contractor screens) */
  --text-lg:   1.125rem; /* 18 */
  --text-xl:   1.375rem; /* 22 — screen titles */
  --text-2xl:  1.75rem;  /* 28 — key numbers (wallet balance, lead price) */
  --text-3xl:  2.25rem;  /* 36 — hero / brand */

  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
}
```

- **Inter** for all product UI. **Fraunces** (serif) only for brand/marketing headings to carry the premium feel — never for pro-portal controls or data.
- Money and lead prices use `--text-2xl` semibold so the number the pro cares about is unmissable.
- Never go below 16px for anything a contractor reads or taps.

### Spacing, radius, shadow

```css
:root {
  /* 4px base spacing scale */
  --space-1: 0.25rem; --space-2: 0.5rem;  --space-3: 0.75rem;
  --space-4: 1rem;    --space-5: 1.25rem; --space-6: 1.5rem;
  --space-8: 2rem;    --space-10: 2.5rem; --space-12: 3rem;

  --radius-sm: 0.5rem;   /* inputs, chips */
  --radius-md: 0.875rem; /* cards, buttons */
  --radius-lg: 1.25rem;  /* sheets, modals */
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(35,39,31,0.06);
  --shadow-md: 0 4px 16px rgba(35,39,31,0.08);  /* cards */
  --shadow-lg: 0 12px 32px rgba(35,39,31,0.12); /* sheets, key CTAs */
}
```

- Generous whitespace is a core part of the premium feel. Default card padding `--space-5`; screen gutters `--space-4` on mobile. Don't crowd.
- Rounded, soft shadows — no harsh borders as the primary separator. Prefer surface + soft shadow over boxed outlines.

---

## 4. Component conventions (shadcn/ui)

Use **shadcn/ui** as the component layer, restyled to these tokens (do not ship default shadcn slate/zinc — retheme to the land palette above).

- **Buttons**
  - *Primary/accent:* full-width on contractor screens, 56px tall, `--radius-md`, `--color-accent` bg, white text, `--text-lg` semibold. This is "Accept" / "Add funds."
  - *Primary/brand:* `--color-primary` bg — structural confirmations.
  - *Secondary:* outline, `--color-border`, `--color-text`.
  - *Destructive:* `--color-danger` — Decline, and only when destructive.
  - Always show pressed/loading/disabled states. Disable + spinner during async (e.g. accepting a lead) to prevent double-charge taps.
- **Cards** are the default container: `--color-surface`, `--radius-md`, `--shadow-md`, `--space-5` padding.
- **Lead card / lead detail** — the most important pro surface. Show at a glance: project type, location, tier badge, **price (large)**, and **current balance**. Contact info is hidden until accepted. The Accept button is the visual anchor.
- **Money display:** one `formatMoney()` helper, integer-cents in, `$1,234.00` out. Never render raw cents or floats.
- **Badges/tiers:** Tier 1/2/3 as calm chips using primary-soft; status (New / Accepted / Declined / Expired) using the semantic soft backgrounds.
- **Inputs:** 16px text, 48px tall, `--radius-sm`, clear focus ring in `--color-primary`. Labels always visible (no placeholder-only fields — bad for low-tech users).
- **Bottom sheet** preferred over center modal on mobile (thumb-friendly). The tokenized SMS accept screen is a single focused view, not a multi-step flow.

### Required states for every data view
- **Loading:** skeletons in `--color-primary-soft`, never a blank screen or bare spinner on primary content.
- **Empty:** a calm illustration-or-icon + one line + (if relevant) one action. E.g. empty lead feed: "No new leads yet — we'll text you the moment one comes in."
- **Error:** plain-language, never a stack trace or code. Offer the retry action.
- **Insufficient balance:** treat as a designed state, not an alert — show the shortfall clearly and put "Add funds" as the primary action inline.

---

## 5. Contractor vs. Admin — two different design registers

**Contractor (phone-only, minimal):**
- Big type, big buttons, one action per screen, near-zero chrome.
- Core screens: SMS accept view · lead feed (home) · lead detail · wallet · profile/onboarding. Nothing else competes.
- No dense tables, no multi-column layouts, no settings mazes.

**Admin (can be denser, still clean):**
- Data tables are fine here (leads, contractors, pricing matrix), but keep them readable — generous row height, clear hierarchy, the same palette and radius.
- "View as contractor" must faithfully render the contractor's mobile experience (show it in a phone frame / constrained width so the admin sees exactly what the pro sees).
- Pricing matrix editor: legible grid, inline edit, clear save state, confirmation on change.

---

## 6. Tokenized SMS accept screen (the single most important pro screen)

This is where the money happens and where the low-tech constraint is absolute. The contractor arrives from an SMS link, **not logged in.**

- One screen. No navigation. No login.
- Top: what the job is (project type, location, tier). Middle: **the price, large**, and their **current balance**. Bottom: two full-width buttons — **Accept & pay** (accent) and **Pass** (secondary).
- On accept: instant confirmation, reveal contact info, done. On insufficient balance: swap the accept button for "Add funds" with the shortfall shown. Handle already-accepted / declined / expired with a calm single-line message, never an error.
- It must load fast and work on a weak connection: minimal assets, no heavy images above the fold.

---

## 7. Quick checklist before shipping any screen

- [ ] Designed at 375px first; no horizontal scroll to 320px.
- [ ] Exactly one primary (accent) action; it's in the thumb zone.
- [ ] Tap targets ≥44px; primary CTA 56px.
- [ ] All colors/spacing/radii come from tokens, not hardcoded values.
- [ ] Body text ≥16px on contractor screens; AA contrast met.
- [ ] Money via `formatMoney()`; correct semantic color + label.
- [ ] Loading, empty, and error states designed — not blank.
- [ ] Async actions disable + show progress (no double-charge).
- [ ] Fraunces used only for brand headings, never pro controls.
- [ ] Feels calm and premium; nothing crowded.

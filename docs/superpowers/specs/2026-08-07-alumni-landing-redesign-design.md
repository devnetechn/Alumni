# Alumni Landing Page Redesign — Design

**Date:** 2026-08-07
**Scope:** `alumni-frontend` public landing page (`src/pages/PublicHome.jsx`) and its header/nav, for logged-out visitors. No backend, auth, or authenticated-app (Dashboard/Sidebar) changes.

## Problem

The current landing page uses a generic indigo→purple→pink gradient hero with a stock `GraduationCap` icon and default Inter typography throughout. It reads as an unbranded SaaS template rather than something built for a specific alumni community. There is no video hero, and there's no clear branding identity (school colors/logo aren't wired in anywhere).

## Goals

- Replace the generic gradient hero with a full-bleed background video hero (video asset to be supplied later; build with a swappable placeholder now).
- Establish a "warm & nostalgic" visual identity (soft warm tones, generous whitespace, serif display accents) instead of the current cool tech-SaaS purple gradient.
- Wire in a single, centralized place for school brand colors and logo, so dropping in the real logo/colors later is a one-file change.
- Refresh the header/nav, hero, announcements, events, and CTA sections to feel cohesive with the new identity.
- Add scroll/entrance motion (Framer Motion) so the page feels polished rather than static.

## Non-goals

- No backend or API changes — same `/announcements`, `/events`, `/stats` endpoints and response shapes.
- No changes to Login, Register, Dashboard, Sidebar, or any authenticated page.
- No new landing sections (e.g., testimonials, featured alumni) — restyle existing sections only.
- Not responsible for sourcing the final video/logo files — only for making them trivially swappable.

## Architecture

### New dependency

- `framer-motion` — scroll-triggered (`whileInView`) and mount entrance animations. Small, well-established, matches the "premium/fashionable" goal better than hand-rolled `IntersectionObserver` code.

### Brand tokens (`src/index.css`)

Add CSS custom properties on `:root` as the single source of truth for brand colors, so swapping to the real school colors later touches one place:

```css
:root {
  --brand-primary: #2b2118;    /* warm near-black, placeholder */
  --brand-secondary: #7a3b2e;  /* warm terracotta/maroon, placeholder */
  --brand-accent: #c99a4a;     /* warm gold, placeholder */
  --brand-cream: #f6efe4;      /* warm off-white background */
}
```

These are referenced via Tailwind arbitrary values (e.g., `bg-[var(--brand-primary)]`) rather than hardcoded hex, so a future edit to this block re-themes the whole page.

Add a Google Fonts import for a serif display face (Fraunces) alongside the existing Inter import, applied only to headline/section-title elements via a `font-display` utility class — body copy stays Inter for readability.

### Logo & video swap points

- `src/assets/logo.svg` (or `.png`) — referenced from the header. Until supplied, the header falls back to the existing `GraduationCap` icon in a brand-colored badge, so nothing breaks if the file is absent.
- `src/assets/hero.mp4` — referenced from `Hero.jsx` as the `<video>` source. Until supplied, `Hero.jsx` detects the missing file at build time isn't feasible in JS, so instead it takes the video path as a constant at the top of the file with a code comment marking it as the swap point; the `poster` attribute (existing `hero.png`) and a static gradient layer render underneath so the section looks intentional (not broken) even with no video file present yet.

### Component structure

- New: `src/components/Hero.jsx` — encapsulates the full-bleed video hero (video/gradient background, overlay, headline, subtext, stats boxes). Takes `stats` as a prop from `PublicHome`.
- Modified: `src/pages/PublicHome.jsx` — renders the new `Hero`, restyles the header/nav inline (kept inline since it's specific to this page's logged-out state), restyles Announcements/Events/CTA sections with brand tokens and Framer Motion `whileInView` wrappers.
- No changes to `App.jsx`'s `Sidebar`/`MobileHeader` (those are for authenticated views only).

## Data flow

Unchanged. `PublicHome` still calls `api.get('/announcements')`, `api.get('/events')`, `api.get('/stats')` on mount and passes results down as props/state. `Hero` is presentational only — no new data fetching.

## Visual design details

**Header/nav:** sticky, blur-on-scroll (existing behavior kept). Icon badge and "Login/Register" buttons re-themed from indigo/slate to brand tokens. Brand name label switches to the serif display font. Background transitions from transparent (over video) to a blurred brand-tinted bar on scroll, instead of jumping straight to opaque white — feels continuous with the video hero instead of like a separate widget.

**Hero:** full-bleed `<video autoPlay muted loop playsInline poster="/hero.png">` with a warm gradient overlay (darker at bottom for text contrast, lighter at top). Framer Motion staggers in: eyebrow badge → serif headline → subtext → stats row, on mount (not scroll-triggered, since it's above the fold).

**Announcements/Events/CTA:** existing grid layouts and data bindings kept; card borders/shadows/icon badges re-themed to brand tokens, section titles in the serif font, each section wrapped in a Framer Motion `whileInView` fade+slide-up with per-card stagger. CTA section background moves from flat `slate-900` to a warm brand-tinted gradient.

**Footer:** re-themed text color only; content/layout unchanged.

## Error handling

No new failure modes introduced. If `hero.mp4` doesn't exist yet, the `<video>` tag simply shows nothing over the poster image + gradient (standard browser behavior for a missing/empty source) — the section remains visually complete via the poster/gradient layers. No JS error boundaries needed for this.

## Testing

- Manual verification via `npm run dev`, viewed in-browser at desktop and mobile widths, both before the video asset exists (poster/gradient fallback looks intentional) and after a placeholder `.mp4` is dropped in (confirm video plays, loops, muted, covers the section).
- Confirm existing behavior is preserved: announcements/events still render from the API, empty-state messages still show when lists are empty, logged-in vs logged-out header states still branch correctly (`user` from `useAuth()`), CTA section still hides when `user` is truthy.
- `npm run lint` after implementation.

## Open items for later (explicitly out of scope now)

- Real school name, logo file, and exact brand hex colors — user will provide; swapping them in is a one-file edit to the `:root` tokens plus dropping `logo.svg`/`hero.mp4` into `src/assets/`.

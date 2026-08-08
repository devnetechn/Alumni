# Frontend Visual Redesign — Bold Brutalist Design System

**Date:** 2026-08-08
**Scope:** `alumni-frontend` — a full visual reskin of every page (landing, auth, and all authenticated app pages) onto a new, distinctive design system. Structure, data flow, and functionality are unchanged; only the visual language changes.

## Problem

The current design (warm cream background, maroon/gold accents, Fraunces serif headlines, soft rounded cards with blurred shadows) was itself a redesign done the previous day to escape a generic indigo→purple→pink AI-SaaS-template gradient look. It has since been extended from the landing page into the authenticated app (Sidebar, Dashboard — currently uncommitted). Despite being a deliberate redesign, it still reads as a generic "AI-generated SaaS template": warm-cream-plus-serif-plus-soft-card-grid is itself now a very common default aesthetic. Separately, the app is being converted into a multi-tenant SaaS product (see `2026-08-08-multi-tenant-saas-design.md`), which is a natural point to establish a real, distinctive product identity rather than continue re-skinning colors on the same generic bones.

## Goals

- Replace the current visual language everywhere (landing page, auth pages, and all 13+ authenticated app pages) with a single, distinctive design system, applied in one pass rather than left half-migrated.
- Establish this as the **platform's own product identity** — not a per-school theme. Every tenant (school) sees the same platform design language; only the school's name (and, in a later out-of-scope project, its own logo/colors) varies per tenant.
- Move decisively away from patterns that read as generic/templated: no soft blurred shadows, no rounded-pill soft cards, no purple/indigo gradients, no stock serif-display-on-cream combo.
- Keep the CSS-custom-property token architecture so a future per-school theming project (explicitly out of scope today, per the multi-tenant design doc) can still hook in cheaply later.

## Non-goals

- No UX or layout restructuring — page structure, information architecture, and functionality stay as-is. If a page's layout is awkward independent of styling, that's a separate follow-up, not folded into this pass.
- No per-school branding/theming (still out of scope, as established in the multi-tenant SaaS design doc).
- No new automated visual regression tooling.
- No final product name/logo — a clearly-marked placeholder wordmark is used; swapping in a real name/logo later is a one-file edit.
- Not a re-scope of the multi-tenant SaaS backend work — this doc supersedes only the *visual direction* set in `2026-08-07-alumni-landing-redesign-design.md`, not its structural decisions (video hero mechanics, brand-token mechanism, Framer Motion usage) or the multi-tenant plan's non-goals.

## Architecture

### Design tokens (`src/index.css`)

Replace the current warm-palette tokens with the platform's own brutalist token set. Same mechanism (CSS custom properties, referenced via Tailwind arbitrary values) as today — only the values and the token *meaning* change, from "school brand" to "platform brand":

```css
:root {
  /* Platform brand tokens — the SaaS product's own identity.
     Not swappable per-school; per-school theming is a separate future project. */
  --brand-ink:        #111111;  /* borders, body text, shadow color */
  --brand-bg:         #ffffff;  /* base background */
  --brand-surface:    #f7f7f8;  /* subtle section backgrounds */
  --brand-accent:     #2b5cff;  /* electric blue — primary actions, active nav state */
  --brand-accent-ink: #ffffff;  /* text/icon color on top of accent fills */
  --brand-danger:     #ff5c35;
  --brand-success:    #16a34a;

  --radius: 6px;
  --border-w: 2.5px;
  --shadow: 4px 4px 0 var(--brand-ink);
  --shadow-sm: 3px 3px 0 var(--brand-ink);

  --font-display: 'Archivo Black', sans-serif; /* headlines only */
  --font-body: 'Inter', sans-serif;            /* everything else */
}
```

`Fraunces` (serif display font) and the `font-display` utility class are removed; `Archivo Black` is added via the existing Google Fonts `@import` alongside `Inter`. `Inter` stays as the body font (already in place, no change needed there).

### Component patterns

These replace the current soft/rounded/blurred-shadow patterns used across `Dashboard.jsx`, `App.jsx` (Sidebar), and the other pages:

- **Tiles/cards/panels:** `var(--brand-bg)` fill, `var(--border-w) solid var(--brand-ink)` border, `var(--radius)` corners, `var(--shadow)` hard offset shadow (zero blur). This is the single biggest visual signature of the new system and the main thing that makes it read as deliberate rather than templated.
- **Buttons (primary):** `var(--brand-accent)` fill, black border, `var(--shadow-sm)`, uppercase label, `Inter 700`. Press/hover state translates the element toward its own shadow (shadow appears to shrink) rather than fading opacity or brightening — a physical "press" metaphor instead of a soft hover glow.
- **Buttons (secondary):** white fill, black border/text, same shadow treatment.
- **Inputs:** white fill, `var(--border-w)` black border, no native focus ring; focus state swaps the border to `var(--brand-accent)` and shifts the shadow.
- **Badges/status pills:** rectangular (not pill-shaped), black border, colored fill per status (blue/green/orange) — replaces the current soft rounded "Live" badge style.
- **Tables** (`Directory.jsx`, `AdminUsers.jsx`): thick top/bottom rule lines instead of zebra-striping; numeric columns right-aligned.
- **Charts** (`Dashboard.jsx`, via `recharts`): flat fills, no gradients; black axis lines; categorical palette drawn from the token set (`--brand-accent`, `--brand-danger`, `--brand-success`, plus 1-2 supporting flat colors); tooltips restyled as small brutalist tiles (bordered, hard-shadowed) instead of the current soft rounded tooltip.
- **Sidebar** (`App.jsx`): switches from a filled dark-brown panel to a white panel with a `var(--border-w)` right border; nav items become blocky tabs, active state is a solid `var(--brand-accent)` fill with black border rather than a soft accent-tinted background.
- **Corners:** consistently `6px` everywhere (not fully sharp 90°) — keeps the bold-border/hard-shadow brutalist signature while staying approachable for a community-facing product rather than reading as a raw industrial tool.

### Layout

Sidebar-based shell (`Sidebar` + `MobileHeader` + `Shell` in `App.jsx`) is kept structurally as-is — same left-rail pattern, same responsive collapse-to-drawer behavior on mobile — only its visual treatment changes per the component patterns above. This was confirmed as the preferred nav pattern over a top nav bar or icon-only rail, since the ~13 nav items (more once admin items are included) read best as a persistent, labeled left rail rather than needing an overflow menu (top nav) or relying on icon-only recognizability (icon rail).

### Motion

`framer-motion` (already a dependency) is kept, but entrance/scroll transitions shift from the current airy fade + slide-up (longer duration, floaty easing) to shorter, snappier transitions (~150–200ms, minimal easing float) — matching the "hard, confident" brutalist feel rather than the softer editorial motion the landing page currently has.

### Placeholder platform brand

No final product name or logo exists yet. The sidebar header and any other brand-mark location use a clearly-marked text-only wordmark placeholder (monospace-bracket style, e.g. rendered via a small dedicated component or constant) so swapping in a real name/logo later is a one-file edit — the same "swap point" pattern already used for the hero video/logo in the prior landing redesign. The school's own name (e.g. "IHES Alumni Association") remains the secondary line beneath it, unchanged — that's tenant identity, distinct from platform identity.

### Rollout scope

Applied in one pass to every page, since a half-migrated app (some pages old style, some new) is worse than the current consistent-but-generic state:

- **Shell:** `App.jsx` (`Sidebar`, `MobileHeader`, `Shell`)
- **Marketing:** `PublicHome.jsx`, `Hero.jsx` — restyled onto the new token set; supersedes only the *visual direction* of the prior landing redesign (warm-gradient-video-hero look), not its structural mechanics (video/poster/gradient-fallback swap points stay as built)
- **Auth:** `Login.jsx`, `Register.jsx`
- **App pages:** `Dashboard.jsx`, `Directory.jsx`, `Events.jsx`, `EventCheckin.jsx`, `EventRegistrations.jsx`, `Announcements.jsx`, `Jobs.jsx`, `Profile.jsx`, `AlumniId.jsx`, `Messages.jsx`, `Groups.jsx`, `Notifications.jsx`, `AdminUsers.jsx`, `AdminPostings.jsx`, `ScanRedirect.jsx`
- **Shared components:** `PosterBadge.jsx`

## Data flow

Unchanged. This is a styling-layer change only — no component's props, state, API calls, or routing behavior changes as part of this work.

## Error handling

No new failure modes. Existing empty-states, loading states, and error messages across pages get the new visual treatment (bordered/shadowed panels instead of soft cards) but keep their existing conditions and copy.

## Testing

- Manual verification via `npm run dev`, checked at desktop and mobile widths, across pages representative of each pattern: `Dashboard.jsx` (data/chart-heavy), `Directory.jsx` (table-heavy), `Login.jsx` (form-heavy), `PublicHome.jsx` (marketing/hero).
- Confirm existing behavior is preserved on every touched page: data still renders correctly, empty/loading/error states still show under the same conditions as before, responsive sidebar collapse still works on mobile.
- `npm run lint` after implementation.

## Open items for later (explicitly out of scope now)

- Real platform product name and logo — placeholder wordmark until decided; swap is a one-file edit.
- Per-school branding/theming (each school's own logo/colors) — separate future project per the multi-tenant SaaS design doc.
- Any UX/layout restructuring independent of visual styling.

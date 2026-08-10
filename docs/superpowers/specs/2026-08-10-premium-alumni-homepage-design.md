# Premium Alumni Homepage Redesign Design

## Background

The homepage went through an incremental layered redesign earlier today (Editorial Intro, About/History, Photo Mosaic, Officers, Partnership — see `2026-08-10-layered-homepage-design.md`), plus a global accent-color change to orange (#F04E22) matching tourism.gov.ph.

The user has now provided a much more complete brief for a full premium alumni homepage — 10 defined sections, editorial serif typography, and an institutional navy/beige palette — explicitly modeled on tourism-website visual language but adapted for an alumni community ("people, memories, achievements, community, belonging" instead of destinations). This supersedes the earlier incremental design; the five sections built today are replaced, not kept alongside the new ones.

## Goals

- Replace the current ad-hoc homepage sections with the fully-specified 10-section premium design from the brief.
- Introduce an editorial serif display font, scoped to the homepage only (rest of the app keeps its existing bold sans `font-display`).
- Introduce navy/beige/soft-gray tokens for the homepage's section backgrounds, reusing the existing global `--brand-accent` orange as the "small accent" the brief calls for (not reverting the color decided earlier today).
- Preserve real backend-driven data (Announcements, Events, Highlights, Stats) in the sections that map to it — restyled to the new visual language, not replaced with static placeholders — since removing real functionality wasn't part of what was asked.
- Placeholder content (realistic-sounding, not Lorem Ipsum) for everything with no backend data model yet: Featured Alumni profiles, Alumni Stories, Alumni by Batch counts/highlights, Give Back copy.

## Non-goals

- No new backend routes, tables, or data. Sections without a matching data source use static placeholder content, same approach as the earlier Officers/Partnership sections.
- No admin CMS for managing this new placeholder content (same deferral as before).
- No change to any page other than the homepage (`PublicHome.jsx` and its section components) and the two new shared tokens (font, colors) — Register/Login/Dashboard/etc. keep their current look entirely.

## Design

### Section flow (replaces today's earlier 5-section addition)

1. Header *(kept, extended)* — sticky nav, transparent-over-hero → solid on scroll (already exists via the `scrolled` state). Add anchor links: Home, About, Alumni, Stories, Events, Memories, Give Back, scrolling to each section's `id`. Keep the existing Login/Register/Dashboard right-side buttons.
2. **Hero** *(`components/Hero.jsx`, content updated in place, not a new component)* — new headline "Where Every Journey Begins, and Every Story Continues.", new supporting copy, two CTAs (primary "Explore Our Alumni Community" scrolls to Featured Alumni, secondary "Join the Alumni Association" links to `/register`), small scroll indicator at the bottom. Keeps its existing video/photo background and the real `stats` prop display.
3. **Alumni Introduction** *(new `AlumniIntro.jsx`, replaces `EditorialIntro.jsx`)* — split layout, image left / eyebrow label + serif heading + paragraph + "Learn More →" link right.
4. **Featured Alumni** *(new `FeaturedAlumni.jsx`)* — "Meet Our Alumni," large editorial cards (portrait via `Avatar` fallback since no real photos, name, batch year, program, short achievement quote, "Read Story →"). Placeholder profiles.
5. **Alumni Stories** *(new `AlumniStories.jsx`)* — "Stories That Inspire," asymmetrical editorial cards (category, title, description, date). Placeholder stories.
6. **Announcements** *(kept, restyled only — real data, unchanged fetch/state)*.
7. **Alumni Events** *(existing Events section restyled in place — real `/events` data, not replaced with placeholder)* — reframed heading "Reconnect. Celebrate. Belong."
8. **Alumni by Batch** *(new `BatchExplorer.jsx`)* — decade tiles (1990s/2000s/2010s/2020s), hover reveal showing placeholder alumni count + featured reunion + explore link.
9. **School Memories** *(new `SchoolMemories.jsx`, replaces `PhotoMosaic.jsx`)* — masonry-style gallery using the same real `highlights` data and `onSelect`/lightbox wiring `PhotoMosaic` used, restyled as an asymmetric masonry instead of a mosaic grid.
10. **Alumni Impact** *(new `AlumniImpact.jsx`)* — large stat typography. Uses real `stats.totalAlumni` / `stats.totalEvents` where they map; "Years of Community" and "Active Batches" are placeholders (no such backend concept exists).
11. **Give Back** *(new `GiveBack.jsx`, replaces `Partnership.jsx`)* — full-width CTA section, placeholder copy about scholarships/mentorship/donations/outreach.
12. **Join CTA** *(existing bottom CTA block, content replaced in place)* — new headline "Your Story Is Part of Our Story.", two buttons (Join the Alumni Network → `/register`, Update Your Profile → `/profile` if logged in).
13. Footer *(unchanged)*.

Deleted: `EditorialIntro.jsx`, `AboutHistory.jsx`, `OfficersShowcase.jsx`, `Partnership.jsx`, `PhotoMosaic.jsx` (superseded by the components above).

### Typography

Add Playfair Display via the existing Google Fonts `@import` in `index.css`. Add a new CSS custom property/utility, `--font-editorial: 'Playfair Display', serif`, and a `font-editorial` Tailwind-usable class (via an `@layer utilities` rule, matching how `font-display` is already set up) — used only inside the new homepage section components for their large headings. Body copy in these sections still uses `Inter` (the existing default). The app-wide `font-display` (Archivo Black) is untouched.

### Colors

New tokens added to `:root` in `index.css`, additive to the existing `--brand-*` tokens (none of which change):

```css
--editorial-navy: #12233F;
--editorial-beige: #F1E9DD;
--editorial-gray: #EDEDE8;
```

Used for section backgrounds only (e.g., Hero overlay tone, Alumni Impact section background, alternating section backgrounds for visual rhythm). `--brand-accent` (#F04E22) continues to be used sparingly for buttons/badges/small highlights, per the brief's "do not overuse color" direction — not for large section backgrounds.

### Data flow

No new API calls. `PublicHome.jsx` continues to fetch `announcements`, `events`, `stats`, `highlights` exactly as it does now; the new/restyled section components receive the same props the old ones did (`SchoolMemories` gets `highlights`/`onSelect` exactly like `PhotoMosaic` did; `AlumniImpact` gets `stats`; Announcements/Events sections keep their existing inline data usage).

## Verification

- Visual check in a browser after each section, both desktop and mobile widths.
- Confirm the lightbox still opens from `SchoolMemories` (same `onSelect`/`setLightbox` wiring as `PhotoMosaic` before it).
- Confirm Announcements/Events still render real data unchanged.
- Confirm Register/Login/Dashboard pages are visually unaffected (no `font-editorial` leakage, no unintended token changes).
- Confirm new nav anchor links scroll to the correct sections.

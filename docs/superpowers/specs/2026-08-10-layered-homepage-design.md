# Layered Homepage Redesign Design

## Background

The public homepage (`alumni-frontend/src/pages/PublicHome.jsx`) currently uses a consistent card-grid layout (bordered `Panel` components, uniform sections) matching the rest of the app's neo-brutalist design system (thick black borders, offset "hard shadow" cards, `--brand-accent` colors).

The user wants the homepage specifically to adopt a "layered," editorial, full-bleed section style — referencing https://www.tourism.gov.ph/, which stacks visually distinct full-width sections: a full-bleed video hero, big bold editorial typography paired with body copy, an asymmetric photo mosaic, and card carousels.

## Goals

- Give the homepage a richer, more visually varied "layered" scroll experience by adding new full-bleed sections.
- Keep the change scoped to the homepage only — the rest of the app (Register, Login, Dashboard) keeps its current design system unchanged.
- Reuse existing data sources where they exist (highlights); use placeholder content where no data source exists yet (About/History, Officers).

## Non-goals

- Restyling the rest of the app to match.
- Building admin-editable content management for About/History or Officers text in this pass (explicitly deferred — static/hardcoded content for now, per user request. A future pass could add a `schools.about_text` column and an `officers` table with an admin UI, if needed).
- Sourcing real About/History copy or real officer names/photos — placeholder content only.

## Design

### Section flow

The existing dynamic sections (Announcements, Events, CTA) keep their current styling and position, unchanged. New full-bleed sections are inserted around them:

1. Header *(unchanged)*
2. Hero *(unchanged — `components/Hero.jsx` is already a full-bleed video hero with overlay text, matching the reference site's opening pattern already)*
3. **Editorial Intro** *(new)* — white background, big bold statement on one side, a short paragraph on the other (mirrors the reference site's "New Experiences. Familiar Shores..." block). A short hook, not the full history.
4. **About/History** *(new)* — full-bleed section, background photo with a dark overlay, white text, a longer narrative paragraph (placeholder copy).
5. Announcements *(unchanged)*
6. Events *(unchanged)*
7. **Highlights, restyled as a photo mosaic** — same data (`GET /events/highlights`, already fetched in `PublicHome.jsx`), asymmetric grid layout instead of the current uniform card grid. This is the one existing section getting a layout change, since "photo mosaic" specifically means restyling how these photos are presented.
8. **Officers/Board** *(new)* — grid of officer cards; photos use the existing `components/ui/Avatar` component's initials-based fallback (no upload mechanism needed since there's no photo data source yet), placeholder names/positions.
9. CTA *(unchanged)*
10. Footer *(unchanged)*

### File structure

New components, following the existing pattern of `Hero.jsx`/`PosterBadge.jsx` being split out of `PublicHome.jsx` rather than inlined:

- `alumni-frontend/src/components/home/EditorialIntro.jsx` — static content, no props needed.
- `alumni-frontend/src/components/home/AboutHistory.jsx` — static content, no props needed.
- `alumni-frontend/src/components/home/PhotoMosaic.jsx` — takes `highlights` (same shape currently passed inline in `PublicHome.jsx`'s Highlights section: `{ id, media, media_type, event_title, event_date }[]`) and an `onSelect` callback (replaces the current inline `setLightbox` click handler) as props, so it plugs into `PublicHome.jsx`'s existing lightbox state without duplicating it.
- `alumni-frontend/src/components/home/OfficersShowcase.jsx` — static placeholder officer list defined inside the component (name, position, no photo — `Avatar` handles the fallback).

`PublicHome.jsx` is modified to import and render these four new components in the order above, and to replace its current inline Highlights JSX block with `<PhotoMosaic highlights={highlights} onSelect={setLightbox} />` (the surrounding lightbox modal stays as-is).

### Visual consistency

All new sections use the existing design tokens (`--brand-ink`, `--brand-accent`, `--brand-surface`, `--radius`, `font-display` for headings) for buttons, accents, and typography — so the new full-bleed sections read as a richer *arrangement* of the existing visual language, not a different brand. Framer Motion `whileInView` fade-in (matching the existing `sectionFade`/`cardFade` variants already used lower in `PublicHome.jsx`) is used for scroll-in animation on each new section, for consistency with the existing Announcements/Events sections.

## Verification

- Visual check in a browser (dev server) after each section is added: correct order, no layout breakage, animations trigger on scroll.
- Existing Announcements/Events/CTA/Highlights data flow is unaffected — `PhotoMosaic` receives the same `highlights` data and calls the same `setLightbox` state setter as the current inline implementation, so the lightbox modal continues to work identically.
- No new backend routes or data required for this pass (About/History and Officers are static placeholder content within their components).

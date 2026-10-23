# Homepage Redesign: Design

## Intent
The homepage below the hero should tell the story of the association: reconnecting
alumni, where the school has come to, and the people behind its success. Every
piece of content on it is curated by the admin. Visitors only read and click.

## Goals
- Reorder `PublicHome.jsx` into the section order below.
- Every card on the homepage links to its own detail page.
- All new content (overview text, announcements + agenda, event recap photos,
  per-batch gallery, projects, successful alumni, sponsorship inquiries) is
  created and edited by admins only.
- Reuse what exists: `partners` table/route/admin page, `events` + `event_photos`,
  `announcements`, `EventDetail`, `Lightbox`, `Section`/`Empty` components.

## Non-goals
- No changes to the hero, auth, payments, batch communities, or chat.
- No uploads or edits by batch presidents or ordinary alumni.
- No online payment for sponsorships (inquiry form only).

## Anti-goals
- Placeholder/hardcoded data in production sections (current `components/home/*`
  drafts use fake STORIES/ALUMNI arrays). Sections with no data must hide or show
  a tidy empty state, never fake content.

## Section order (decided by the user)
1. **Hero**: unchanged.
2. **Overview**: what this website is for: reconnecting alumni and the unity
   of the association, a "proof of life" that the alumni community is alive and
   active (the user's words). Text + image, admin-editable (my call: stored on
   the `schools` row, e.g. `overview_title`, `overview_body`, `overview_image`;
   the existing `school.about` stays for the About page). My guess: the live
   numbers from `/public-stats` (batches, registered alumni, upcoming events,
   active communities) sit inside this section as the literal proof of life,
   so the stats strip is folded into the Overview instead of removed.
3. **Announcements**: cards, each clickable to `/announcements/:id`, which shows
   the full text and an **agenda** (list of time + activity). The detail route
   must be public (today `/announcements` is behind `Protected`). Agenda is
   stored as JSONB on `announcements` (my call).
4. **Wrap-up of the last event + per-batch gallery**: a recap of the most
   recent past event (title, date, photo strip) linking to `/events/:id`.
   Below it, a gallery that can be filtered per batch; photos open in the
   existing `Lightbox`. Admin uploads photos and tags them with a batch.
   Per-batch gallery photos are a new `batch_gallery` table (my call), separate
   from `event_photos`, so a photo can belong to a batch without an event.
5. **Highlighted Projects**: cards linking to `/projects/:id` (description,
   photos, who led it, batch). New `projects` table with a `featured` flag;
   admin chooses which appear on the homepage.
6. **Faces Behind the Success**: successful-alumni cards (photo, name, batch,
   role, quote) linking to `/alumni-stories/:id` (full story). New
   `alumni_stories` table. Replaces the fake `FeaturedAlumni`/`AlumniStories` drafts.
7. **Sponsorship**: call-to-action band linking to `/sponsor`, a page with
   sponsorship packages/benefits and an inquiry form. Inquiries stored in
   `sponsor_inquiries` and visible to admins (my call; email notification is
   out of scope).
8. **Partnership**: logo grid from the existing `partners` table. Logo links to
   the partner's `website_url` (opens in new tab); partners without a URL are
   not links (my call, instead of a dedicated partner page).

The "Find your batch" / "Upcoming gatherings" sections (the stats strip moves
into the Overview, above) are not in the requested order. My call: remove them from the homepage (they
remain reachable via `/batches` and `/events`). The final "Join" CTA band stays
at the bottom.

## Admin side
New admin pages under the existing `Protected admin` area, following the style
of `AdminPartnerships`/`AdminHighlights`: overview text, announcement agenda
(extend the existing announcement form), batch gallery, projects, alumni
stories, sponsor inquiries. Add them to the admin nav.

## Constraints and conventions
- Backend: Express routes in `alumni-backend/src/routes`, tenant-scoped via
  `req.db`, writes guarded by `requireAuth, requireAdmin`, public GETs open.
  New tables need `school_id`, RLS tenant_isolation policy and `GRANT` to
  `alumni_app`, matching `schema.sql`; add tests like the existing ones in
  `tests/`.
- Images are currently stored in the `media`/`logo` TEXT columns (data URLs,
  as `event_photos` and `partners` do). Follow that, and cap upload size
  client-side. Switching to object storage is out of scope.
- Frontend: React + Vite + Tailwind with existing CSS vars (`--navy`, `--gold`),
  `serif` headings, lucide icons. Match `PublicHome.jsx` style. Respect
  accessibility (alt text, `aria-label`s, focusable cards).
- Delete the unused placeholder components in `components/home/` that this
  replaces, or rewrite them to take real props.
- Do not commit: the user will say when.

## Left to the builder
Exact visual styling, card layouts, pagination/limits on the homepage (suggest
3 announcements, 6 projects, 6 faces, 12 gallery photos), migration filename,
empty states, and routing details.

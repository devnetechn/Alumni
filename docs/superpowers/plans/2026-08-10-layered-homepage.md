# Layered Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the public homepage (`alumni-frontend/src/pages/PublicHome.jsx`) a richer, "layered" full-bleed scroll experience by adding four new sections (Editorial Intro, About/History, a photo mosaic replacing the current Highlights grid, and an Officers/Board showcase), while leaving Announcements/Events/CTA and the rest of the app unchanged.

**Architecture:** Four new presentational React components under `alumni-frontend/src/components/home/`, imported and composed into the existing `PublicHome.jsx`. No new backend routes or data — About/History and Officers use static placeholder content; the photo mosaic reuses the `highlights` data `PublicHome.jsx` already fetches.

**Tech Stack:** React, Tailwind CSS (utility classes + the app's `--brand-*` CSS custom properties), Framer Motion (`whileInView` scroll animations, matching the existing pattern in `PublicHome.jsx`).

## Global Constraints

- Scoped to the homepage only — do not modify Register, Login, Dashboard, or any shared design tokens.
- Reuse existing design tokens (`--brand-ink`, `--brand-accent`, `--brand-surface`, `--radius`, `font-display`) — no new colors or fonts.
- No frontend test runner exists in this repo (confirmed: no `*.test.*` files, no test script in `alumni-frontend/package.json`) — verification is manual (dev server + visual check), not automated tests.
- About/History and Officers content is placeholder text, hardcoded in the component — not fetched from an API, not admin-editable (deferred per the design doc).
- No new image asset exists for a background photo in About/History (only `hero.png`/`hero.mp4`, already used prominently in the Hero section right above it — reusing it there would look repetitive). Use a solid `--brand-ink` background with a subtle `--brand-accent` accent shape instead of a photo for that section.

---

### Task 1: `EditorialIntro` component

**Files:**
- Create: `alumni-frontend/src/components/home/EditorialIntro.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: nothing (no props).
- Produces: default export `EditorialIntro`, a `<section>` — consumed directly by `PublicHome.jsx`.

- [ ] **Step 1: Create the component**

```jsx
import { motion } from 'framer-motion';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export default function EditorialIntro() {
  return (
    <motion.section
      className="bg-white py-20 px-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        <h2 className="font-display text-4xl md:text-5xl leading-tight text-[var(--brand-ink)]">
          New Connections.
          <br />
          Familiar Faces.
          <br />
          Lifelong Ties.
        </h2>
        <p className="text-lg text-slate-600 leading-relaxed">
          The Alumni Association exists to keep every graduate connected — to
          each other, to their school, and to the opportunities that come
          from staying in touch. Whether you graduated last year or decades
          ago, this is your space to reconnect, celebrate milestones, and
          give back to the community that shaped you.
        </p>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Wire it into `PublicHome.jsx`**

Add the import near the other component imports (after `import Hero from '../components/Hero';`):

```jsx
import EditorialIntro from '../components/home/EditorialIntro';
```

Render it directly after `<Hero stats={stats} />` (before the `{/* Announcements */}` comment):

```jsx
      <Hero stats={stats} />

      <EditorialIntro />

      {/* Announcements */}
```

- [ ] **Step 3: Verify locally**

Run: `cd alumni-frontend && npm run dev`, open `http://localhost:5173/`, confirm the new section renders between the hero and Announcements, with a fade-in on scroll.

- [ ] **Step 4: Commit**

Hold — do not commit yet. Per this session's working agreement, wait for explicit go-ahead before any `git commit`/`git push` (see later "Commit checkpoint" note at the end of this plan).

---

### Task 2: `AboutHistory` component

**Files:**
- Create: `alumni-frontend/src/components/home/AboutHistory.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: nothing (no props).
- Produces: default export `AboutHistory`, a `<section>` — consumed directly by `PublicHome.jsx`.

- [ ] **Step 1: Create the component**

```jsx
import { motion } from 'framer-motion';
import { Landmark } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export default function AboutHistory() {
  return (
    <motion.section
      className="relative overflow-hidden bg-[var(--brand-ink)] py-24 px-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div
        className="absolute -right-24 -top-24 w-96 h-96 rounded-full opacity-20"
        style={{ background: 'var(--brand-accent)' }}
        aria-hidden="true"
      />
      <div className="relative max-w-3xl mx-auto text-center text-white">
        <div className="inline-flex p-3 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-white mb-6">
          <Landmark size={24} />
        </div>
        <h2 className="font-display text-4xl mb-6">Our Story</h2>
        <p className="text-lg text-white/80 leading-relaxed">
          Founded by a small group of graduates determined to stay in touch,
          the Alumni Association has grown into a network spanning every
          batch since. From reunions and mentorship programs to community
          outreach, our history is written by every member who chooses to
          stay connected. This is where that story continues.
        </p>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Wire it into `PublicHome.jsx`**

Add the import after the `EditorialIntro` import:

```jsx
import AboutHistory from '../components/home/AboutHistory';
```

Render it directly after `<EditorialIntro />`:

```jsx
      <EditorialIntro />

      <AboutHistory />

      {/* Announcements */}
```

- [ ] **Step 3: Verify locally**

Reload `http://localhost:5173/`, confirm the dark full-bleed section renders between Editorial Intro and Announcements, with the accent circle visible in the corner and text centered and readable.

- [ ] **Step 4: Commit**

Hold — see "Commit checkpoint" note at the end of this plan.

---

### Task 3: `PhotoMosaic` component (replaces the inline Highlights grid)

**Files:**
- Create: `alumni-frontend/src/components/home/PhotoMosaic.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx:199-246` (the existing `{/* Highlights */}` block)

**Interfaces:**
- Consumes: `highlights` prop — array of `{ id, media, media_type, event_title, event_date }` (same shape `PublicHome.jsx` already fetches via `api.get('/events/highlights')` into its `highlights` state, currently rendered inline at `PublicHome.jsx:216-244`). `onSelect` prop — callback invoked with the clicked highlight object (same role the current inline `onClick={() => setLightbox(h)}` plays).
- Produces: default export `PhotoMosaic`, a `<section>` (returns `null` when `highlights.length === 0`, matching the current inline `{highlights.length > 0 && (...)}` guard) — consumed directly by `PublicHome.jsx`, wired to its existing `setLightbox` state.

- [ ] **Step 1: Create the component**

Asymmetric mosaic: first item spans 2 columns/2 rows, the rest fill in as single cells — a CSS grid with explicit spans rather than the current uniform `grid-cols-4` card grid.

```jsx
import { motion } from 'framer-motion';
import { Sparkles, Play } from 'lucide-react';

const sectionFade = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.05, ease: 'easeOut' },
  }),
};

export default function PhotoMosaic({ highlights, onSelect }) {
  if (highlights.length === 0) return null;

  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)]">
          <Sparkles className="text-white" size={22} />
        </div>
        <h2 className="font-display text-3xl text-[var(--brand-ink)]">Highlights</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 grid-flow-dense gap-3">
        {highlights.map((h, i) => (
          <motion.button
            key={h.id}
            type="button"
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={cardFade}
            onClick={() => onSelect(h)}
            className={`group relative rounded-[var(--radius)] overflow-hidden border-[2.5px] border-[var(--brand-ink)] hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow text-left ${
              i === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'
            }`}
          >
            {h.media_type === 'video' ? (
              <>
                <video src={h.media} className="w-full h-full object-cover" preload="metadata" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Play className="text-white" fill="white" size={i === 0 ? 48 : 32} />
                </div>
              </>
            ) : (
              <img src={h.media} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
              {h.event_title} · {new Date(h.event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Replace the inline Highlights block in `PublicHome.jsx`**

Add the import after the `AboutHistory` import:

```jsx
import PhotoMosaic from '../components/home/PhotoMosaic';
```

Replace the entire `{/* Highlights */}` block (`PublicHome.jsx:199-246`, from `{highlights.length > 0 && (` through its matching `)}`) with:

```jsx
      <PhotoMosaic highlights={highlights} onSelect={setLightbox} />
```

Remove the now-unused `Sparkles` and `Play` imports from the top of `PublicHome.jsx` if they're no longer referenced elsewhere in the file (check first — `Play` is only used in the block being removed; `Sparkles` likewise).

- [ ] **Step 3: Verify locally**

Reload `http://localhost:5173/`. If there's existing highlights data (from the event photos feature), confirm the mosaic renders with the first item large and the rest smaller, and clicking any photo still opens the existing lightbox modal (unchanged code path — `setLightbox` is the same state setter as before). If there's no highlights data locally, temporarily confirm the section correctly renders nothing (no crash) — this matches the pre-existing empty-state behavior.

- [ ] **Step 4: Commit**

Hold — see "Commit checkpoint" note at the end of this plan.

---

### Task 4: `OfficersShowcase` component

**Files:**
- Create: `alumni-frontend/src/components/home/OfficersShowcase.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: nothing (no props — placeholder officer list is defined inside the component).
- Produces: default export `OfficersShowcase`, a `<section>` — consumed directly by `PublicHome.jsx`.

- [ ] **Step 1: Create the component**

Reuses `components/ui/Avatar`'s initials-based fallback (no `pic` provided) rather than introducing a new avatar treatment.

```jsx
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import Avatar from '../ui/Avatar';

const sectionFade = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.05, ease: 'easeOut' },
  }),
};

const OFFICERS = [
  { name: 'President Name', position: 'President' },
  { name: 'VP Name', position: 'Vice President' },
  { name: 'Secretary Name', position: 'Secretary' },
  { name: 'Treasurer Name', position: 'Treasurer' },
];

export default function OfficersShowcase() {
  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)]">
          <Users className="text-white" size={22} />
        </div>
        <h2 className="font-display text-3xl text-[var(--brand-ink)]">Officers & Board</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {OFFICERS.map((officer, i) => (
          <motion.div
            key={officer.name}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={cardFade}
            className="bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-6 text-center hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
          >
            <div className="flex justify-center mb-4">
              <Avatar name={officer.name} size="lg" />
            </div>
            <p className="font-bold text-[var(--brand-ink)]">{officer.name}</p>
            <p className="text-sm text-slate-500">{officer.position}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Wire it into `PublicHome.jsx`**

Add the import after the `PhotoMosaic` import:

```jsx
import OfficersShowcase from '../components/home/OfficersShowcase';
```

Render it directly after the `<PhotoMosaic ... />` line (before the `{/* CTA */}` comment):

```jsx
      <PhotoMosaic highlights={highlights} onSelect={setLightbox} />

      <OfficersShowcase />

      {/* CTA */}
```

- [ ] **Step 3: Verify locally**

Reload `http://localhost:5173/`, confirm the Officers grid renders with initials-based avatars (colored `--brand-accent` circles with the first letter of each placeholder name) between Highlights and the CTA section.

- [ ] **Step 4: Commit**

Hold — see "Commit checkpoint" note at the end of this plan.

---

### Task 5: Full-page visual pass

**Files:** none (verification only).

- [ ] **Step 1: Scroll through the full homepage**

With `npm run dev` running, load `http://localhost:5173/` and scroll top to bottom. Confirm: section order matches the design (Header, Hero, Editorial Intro, About/History, Announcements, Events, Photo Mosaic, Officers, CTA, Footer), no overlapping/broken layout at both desktop and a narrow mobile width (resize the browser or use dev tools device toolbar), and every new section's scroll-in fade-in animation fires once and doesn't re-trigger oddly on scroll-back.

- [ ] **Step 2: Check the existing lightbox still works**

Click a photo in the new Photo Mosaic (if highlights data exists) and confirm the existing full-screen lightbox modal at the bottom of `PublicHome.jsx` still opens/closes correctly — this confirms `PhotoMosaic`'s `onSelect` prop is correctly wired to the pre-existing `setLightbox`/`lightbox` state, unchanged from before this plan.

---

## Commit checkpoint

Per this session's working agreement, do not run `git add`/`git commit`/`git push` for any step above until the user explicitly asks for it. Once all 5 tasks are verified, tell the user what changed and wait for their go-ahead before committing.

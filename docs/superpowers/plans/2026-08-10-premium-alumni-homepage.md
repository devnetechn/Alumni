# Premium Alumni Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's earlier 5-section homepage addition with the fully-specified 10-section premium alumni homepage from the brief — editorial serif typography, navy/beige/gray section backgrounds, real backend data preserved where it exists (Announcements, Events, Highlights, Stats), realistic placeholder content everywhere else.

**Architecture:** New/updated presentational components under `alumni-frontend/src/components/home/`, composed into `alumni-frontend/src/pages/PublicHome.jsx`. `Hero.jsx` is updated in place (not replaced). Old section components from today's earlier round (`EditorialIntro`, `AboutHistory`, `OfficersShowcase`, `Partnership`, `PhotoMosaic`) are deleted and superseded.

**Tech Stack:** React, Tailwind CSS, Framer Motion, `lucide-react` icons — same stack as the rest of the homepage.

## Global Constraints

- Scoped to the homepage only, plus two additive shared tokens (a new `font-editorial` CSS class, three new `--editorial-*` color custom properties) — no other page changes.
- `--brand-accent` (#F04E22) is NOT reverted — it's reused as the "small accent" the brief calls for. Do not touch existing `--brand-*` tokens.
- Real backend data (Announcements, Events, Highlights via `/events/highlights`, Stats via `/stats`) must keep flowing through unchanged fetch calls in `PublicHome.jsx` — sections consuming it are restyled, not replaced with placeholders.
- No frontend test runner exists — verification is manual (dev server + visual check), consistent with earlier rounds today.
- Don't commit anything until explicitly asked (standing agreement for this session).

---

### Task 1: Editorial typography + navy/beige/gray tokens

**Files:**
- Modify: `alumni-frontend/src/index.css`

- [ ] **Step 1: Add Playfair Display to the font import and a `.font-editorial` class**

In `index.css`, change the Google Fonts `@import` line (line 1) to also load Playfair Display:

```css
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Playfair+Display:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
```

Add a new class next to the existing `.font-display` rule:

```css
.font-editorial {
  font-family: 'Playfair Display', serif;
}
```

- [ ] **Step 2: Add the new color tokens**

In the `:root` block, after `--brand-success: #16a34a;`, add:

```css
  /* Homepage-only editorial palette, additive to the --brand-* tokens above.
     Used for section backgrounds on the premium alumni homepage; --brand-accent
     stays the only accent color per the "don't overuse color" design direction. */
  --editorial-navy: #12233F;
  --editorial-beige: #F1E9DD;
  --editorial-gray: #EDEDE8;
```

- [ ] **Step 3: Verify**

Run `cd alumni-frontend && npm run dev` (if not already running), confirm no CSS errors in the browser console and the existing homepage still renders (fonts/colors are additive, nothing consumes them yet).

---

### Task 2: Hero content update

**Files:**
- Modify: `alumni-frontend/src/components/Hero.jsx`

**Interfaces:**
- Consumes: `stats` prop (unchanged — same shape `PublicHome.jsx` already passes).
- Produces: no interface change, same default export.

- [ ] **Step 1: Replace the headline, copy, and CTAs**

In `Hero.jsx`, replace the `<motion.h1>` block (current lines 47–57) with:

```jsx
        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="font-editorial text-5xl md:text-6xl mb-6 leading-tight"
        >
          Where Every Journey Begins,
          <br />
          and Every Story Continues.
        </motion.h1>
```

Replace the `<motion.p>` block (current lines 59–68) with:

```jsx
        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10"
        >
          Reconnect with the people, memories, and community that make our
          alumni family special.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={2.5}
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-4 mb-10"
        >
          <a
            href="#alumni"
            className="inline-flex items-center gap-2 bg-[var(--brand-accent)] text-white font-bold px-6 py-3 rounded-[var(--radius)] border-2 border-white hover:opacity-90 transition-opacity"
          >
            Explore Our Alumni Community
          </a>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-transparent text-white font-bold px-6 py-3 rounded-[var(--radius)] border-2 border-white/60 hover:border-white transition-colors"
          >
            Join the Alumni Association
          </Link>
        </motion.div>
```

Add the `Link` import at the top of the file:

```jsx
import { Link } from 'react-router-dom';
```

- [ ] **Step 2: Add a scroll indicator**

After the closing `</motion.div>` of the stats grid (end of the `{stats && (...)}` block, before the closing `</div>` of the hero content wrapper), add:

```jsx
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-white/50 flex items-start justify-center p-1.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          </motion.div>
        </motion.div>
```

This needs `position: relative` on the outer `<section>` — already present (`className="relative overflow-hidden min-h-[90vh] flex items-center"` on line 17) — no change needed there.

- [ ] **Step 3: Verify**

Reload `http://localhost:5173/`, confirm the new headline (serif font), both CTA buttons, and the bouncing scroll indicator at the bottom of the hero render correctly. Clicking "Explore Our Alumni Community" won't scroll anywhere useful yet (target section doesn't exist until Task 5) — that's expected at this point in the plan.

---

### Task 3: AlumniIntro component (replaces EditorialIntro)

**Files:**
- Create: `alumni-frontend/src/components/home/AlumniIntro.jsx`
- Delete: `alumni-frontend/src/components/home/EditorialIntro.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: nothing (no props).
- Produces: default export `AlumniIntro`, a `<section id="about">`.

- [ ] **Step 1: Create the component**

```jsx
import { motion } from 'framer-motion';
import heroPoster from '../../assets/hero.png';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export default function AlumniIntro() {
  return (
    <motion.section
      id="about"
      className="bg-white py-24 px-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="rounded-[var(--radius)] overflow-hidden border-2 border-[var(--brand-ink)]">
          <img src={heroPoster} alt="" className="w-full h-full object-cover aspect-[4/3]" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-4">
            OUR COMMUNITY
          </p>
          <h2 className="font-editorial text-4xl md:text-5xl leading-tight text-[var(--brand-ink)] mb-6">
            Connected by memories. United by purpose.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            The Alumni Association exists to keep every graduate connected —
            to each other, to their school, and to the opportunities that
            come from staying in touch. Whether you graduated last year or
            decades ago, this is your space to reconnect, celebrate
            milestones, and give back to the community that shaped you.
          </p>
          <a href="#alumni" className="inline-flex items-center gap-2 font-bold text-[var(--brand-ink)] hover:text-[var(--brand-accent)] transition-colors">
            Learn More →
          </a>
        </div>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Delete `EditorialIntro.jsx` and swap the import/usage in `PublicHome.jsx`**

Delete `alumni-frontend/src/components/home/EditorialIntro.jsx`.

In `PublicHome.jsx`, replace the import (currently `import EditorialIntro from '../components/home/EditorialIntro';`) with:

```jsx
import AlumniIntro from '../components/home/AlumniIntro';
```

Replace `<EditorialIntro />` (currently right after `<Hero stats={stats} />`) with `<AlumniIntro />`.

- [ ] **Step 3: Verify**

Reload the homepage, confirm the split layout renders with the serif heading and the "Learn More →" link.

---

### Task 4: FeaturedAlumni component

**Files:**
- Create: `alumni-frontend/src/components/home/FeaturedAlumni.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: nothing (no props — placeholder profiles defined inside).
- Produces: default export `FeaturedAlumni`, a `<section id="alumni">`.

- [ ] **Step 1: Create the component**

Uses `Avatar` (`size="lg"`) for the portrait fallback, same pattern as the earlier `OfficersShowcase`.

```jsx
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Avatar from '../ui/Avatar';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.08, ease: 'easeOut' },
  }),
};

const ALUMNI = [
  {
    name: 'Maria Santos',
    year: 'Class of 2015',
    program: 'Entrepreneurship',
    quote: 'From campus dreams to building a business that creates opportunities for others.',
  },
  {
    name: 'Jon Dela Cruz',
    year: 'Class of 2012',
    program: 'Civil Engineering',
    quote: 'Every bridge I design carries a little of what I learned here.',
  },
  {
    name: 'Liza Fernandez',
    year: 'Class of 2018',
    program: 'Education',
    quote: 'Now teaching the next generation the same way I was taught.',
  },
];

export default function FeaturedAlumni() {
  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-24"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeIn}
    >
      <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">MEET OUR ALUMNI</p>
      <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-12">
        Faces behind the stories.
      </h2>
      <div className="grid md:grid-cols-3 gap-8">
        {ALUMNI.map((a, i) => (
          <motion.div
            key={a.name}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={cardFade}
            className="group"
          >
            <div className="mb-5 flex justify-center">
              <Avatar name={a.name} size="lg" />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-[var(--brand-ink)]">{a.name}</p>
              <p className="text-sm text-slate-500 mb-3">{a.year} · {a.program}</p>
              <p className="text-slate-600 italic leading-relaxed mb-4">&ldquo;{a.quote}&rdquo;</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand-ink)] group-hover:text-[var(--brand-accent)] transition-colors cursor-default">
                Read Story <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Wire into `PublicHome.jsx`**

Add the import after `AlumniIntro`:

```jsx
import FeaturedAlumni from '../components/home/FeaturedAlumni';
```

Render `<FeaturedAlumni />` directly after `<AlumniIntro />`.

- [ ] **Step 3: Verify**

Reload, confirm the 3-column profile grid renders with initials avatars, quotes, and "Read Story" affordance.

---

### Task 5: AlumniStories component

**Files:**
- Create: `alumni-frontend/src/components/home/AlumniStories.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: nothing (no props).
- Produces: default export `AlumniStories`, a `<section id="stories">`.

- [ ] **Step 1: Create the component**

Asymmetric layout: first story spans 2 columns, others are single — same `grid-flow-dense` + `col-span-2` technique used in the earlier `PhotoMosaic`.

```jsx
import { motion } from 'framer-motion';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.06, ease: 'easeOut' },
  }),
};

const STORIES = [
  {
    category: 'Alumni Spotlight',
    title: 'Building a business that gives back to the batch that raised her',
    description: 'How one graduate turned a small idea into a company that now employs a dozen fellow alumni.',
    date: 'Jul 2026',
    big: true,
  },
  {
    category: 'Career Journey',
    title: 'From classroom to courtroom',
    description: 'A decade after graduation, one alum reflects on the path to law school.',
    date: 'Jun 2026',
  },
  {
    category: 'Community Impact',
    title: 'The scholarship fund started by three batchmates',
    description: 'What began as a reunion pledge is now sending five students to college.',
    date: 'May 2026',
  },
  {
    category: 'Life After Graduation',
    title: 'Coming home to teach',
    description: 'Why one graduate chose to return and lead the same classroom she once sat in.',
    date: 'Apr 2026',
  },
];

export default function AlumniStories() {
  return (
    <motion.section
      className="py-24 px-6"
      style={{ background: 'var(--editorial-beige)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">FEATURED WRITING</p>
        <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-12">
          Stories That Inspire
        </h2>
        <div className="grid md:grid-cols-2 gap-6 grid-flow-dense">
          {STORIES.map((s, i) => (
            <motion.article
              key={s.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              className={`bg-white rounded-[var(--radius)] border-2 border-[var(--brand-ink)] p-8 hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow ${s.big ? 'md:col-span-2' : ''}`}
            >
              <p className="text-xs font-bold tracking-wider text-[var(--brand-accent)] mb-3">{s.category.toUpperCase()}</p>
              <h3 className={`font-editorial text-[var(--brand-ink)] mb-3 ${s.big ? 'text-3xl' : 'text-2xl'}`}>{s.title}</h3>
              <p className="text-slate-600 leading-relaxed mb-4">{s.description}</p>
              <p className="text-xs text-slate-400">{s.date}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Wire into `PublicHome.jsx`**

Add the import after `FeaturedAlumni`, render `<AlumniStories />` directly after `<FeaturedAlumni />`.

- [ ] **Step 3: Verify**

Reload, confirm the first story spans both columns and the rest sit in a 2-column grid, on the new beige background.

---

### Task 6: Extract and restyle Announcements into its own component

**Files:**
- Create: `alumni-frontend/src/components/home/AnnouncementsSection.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `announcements` prop — same array `PublicHome.jsx` already fetches via `api.get('/announcements')` (`{ id, title, body, poster_name, poster_email, poster_pic, poster_role, poster_position, created_at }[]`).
- Produces: default export `AnnouncementsSection`, a `<section>`. No new data flow — same real data, same `PosterBadge` usage, unchanged.

- [ ] **Step 1: Create the component**

This is the existing Announcements JSX block from `PublicHome.jsx` (current lines 98–147), moved into its own file with only the heading/icon area restyled (serif heading, accent-colored icon chip instead of a bordered box) — the data rendering (map, `PosterBadge`, empty state) is unchanged.

```jsx
import { motion } from 'framer-motion';
import { Megaphone } from 'lucide-react';
import PosterBadge from '../PosterBadge';
import { Panel } from '../ui';

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

export default function AnnouncementsSection({ announcements }) {
  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <div className="flex items-center gap-3 mb-8">
        <Megaphone className="text-[var(--brand-accent)]" size={26} />
        <h2 className="font-editorial text-3xl md:text-4xl text-[var(--brand-ink)]">
          Latest Announcements
        </h2>
      </div>
      {announcements.length === 0 ? (
        <Panel className="p-8 text-slate-500">No announcements yet.</Panel>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {announcements.map((a, i) => (
            <motion.article
              key={a.id}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              className="group bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-6 hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
            >
              <div className="mb-4">
                <PosterBadge
                  name={a.poster_name}
                  email={a.poster_email}
                  pic={a.poster_pic}
                  role={a.poster_role}
                  subtitle={a.poster_position}
                  date={new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  size="sm"
                />
              </div>
              <h3 className="font-display text-xl mb-2 text-[var(--brand-ink)]">
                {a.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">{a.body}</p>
            </motion.article>
          ))}
        </div>
      )}
    </motion.section>
  );
}
```

- [ ] **Step 2: Replace the inline block in `PublicHome.jsx`**

Add the import: `import AnnouncementsSection from '../components/home/AnnouncementsSection';`

Replace the entire `{/* Announcements */}` block (current lines 98–147) with:

```jsx
      <AnnouncementsSection announcements={announcements} />
```

- [ ] **Step 3: Verify**

Reload, confirm announcements still render identically in content (same cards, same data), just with the new serif heading treatment. If there's existing announcement data locally, confirm it still shows; if not, confirm the "No announcements yet." empty state still renders.

---

### Task 7: Extract and restyle Events into AlumniEventsSection

**Files:**
- Create: `alumni-frontend/src/components/home/AlumniEventsSection.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `events` prop — same array `PublicHome.jsx` already fetches via `api.get('/events')` (`{ id, title, description, location, event_date }[]`).
- Produces: default export `AlumniEventsSection`, a `<section id="events">`. Same real data, unchanged.

- [ ] **Step 1: Create the component**

Existing Events JSX (current `PublicHome.jsx` lines 149–206), moved out, heading reframed, date block recolored to `--editorial-navy` instead of `--brand-ink`.

```jsx
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { Panel } from '../ui';

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

export default function AlumniEventsSection({ events }) {
  return (
    <motion.section
      id="events"
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">UPCOMING</p>
      <h2 className="font-editorial text-3xl md:text-4xl text-[var(--brand-ink)] mb-8">
        Reconnect. Celebrate. Belong.
      </h2>
      {events.length === 0 ? (
        <Panel className="p-8 text-slate-500">No events scheduled yet.</Panel>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {events.map((ev, i) => (
            <motion.div
              key={ev.id}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              className="group bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] overflow-hidden hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
            >
              <div className="p-6 text-white" style={{ background: 'var(--editorial-navy)' }}>
                <div className="text-xs uppercase tracking-wider opacity-70 mb-1">
                  {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="font-editorial text-3xl">
                  {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-sm opacity-70">
                  {new Date(ev.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2 text-[var(--brand-ink)]">
                  {ev.title}
                </h3>
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                    <MapPin size={14} />
                    {ev.location}
                  </div>
                )}
                <p className="text-sm text-slate-600 line-clamp-2">{ev.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}
```

- [ ] **Step 2: Replace the inline block in `PublicHome.jsx`**

Add the import: `import AlumniEventsSection from '../components/home/AlumniEventsSection';`

Replace the entire `{/* Events */}` block (current lines 149–206) with:

```jsx
      <AlumniEventsSection events={events} />
```

- [ ] **Step 3: Verify**

Reload, confirm events render identically in content with the navy date block and new heading.

---

### Task 8: BatchExplorer component

**Files:**
- Create: `alumni-frontend/src/components/home/BatchExplorer.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: nothing (no props — placeholder decade data defined inside).
- Produces: default export `BatchExplorer`, a `<section>`.

- [ ] **Step 1: Create the component**

Hover reveal implemented with Tailwind `group`/`group-hover` (no extra JS state needed) — a dark overlay slides up on hover to reveal the count/reunion/explore copy.

```jsx
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.06, ease: 'easeOut' },
  }),
};

const BATCHES = [
  { range: '1990–1999', count: '420+', reunion: 'Silver Homecoming 2025' },
  { range: '2000–2009', count: '890+', reunion: 'Class of 2005 Reunion' },
  { range: '2010–2019', count: '1,340+', reunion: "Decade's End Gala" },
  { range: '2020–2026', count: '610+', reunion: 'Newest Grads Meetup' },
];

export default function BatchExplorer() {
  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-24"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeIn}
    >
      <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">FIND YOUR YEARS</p>
      <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-12">
        Explore Your Batch
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {BATCHES.map((b, i) => (
          <motion.div
            key={b.range}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={cardFade}
            className="group relative aspect-[3/4] rounded-[var(--radius)] overflow-hidden border-2 border-[var(--brand-ink)] cursor-default"
            style={{ background: 'var(--editorial-navy)' }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-editorial text-2xl md:text-3xl text-white text-center px-2">{b.range}</p>
            </div>
            <div className="absolute inset-0 bg-[var(--brand-ink)]/90 flex flex-col items-center justify-center gap-2 px-4 text-center opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="font-editorial text-3xl text-white">{b.count}</p>
              <p className="text-xs text-white/70 uppercase tracking-wider">Alumni</p>
              <p className="text-sm text-white/90 mt-2">{b.reunion}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-accent)] mt-2">
                Explore <ArrowRight size={12} />
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Wire into `PublicHome.jsx`**

Add the import after `AlumniEventsSection`, render `<BatchExplorer />` directly after `<AlumniEventsSection events={events} />`.

- [ ] **Step 3: Verify**

Reload, confirm 4 navy tiles render and hovering each reveals the count/reunion/explore overlay smoothly.

---

### Task 9: SchoolMemories component (replaces PhotoMosaic)

**Files:**
- Create: `alumni-frontend/src/components/home/SchoolMemories.jsx`
- Delete: `alumni-frontend/src/components/home/PhotoMosaic.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `highlights` prop (same shape as before: `{ id, media, media_type, event_title, event_date }[]`), `onSelect` callback — identical contract to the old `PhotoMosaic`, so `PublicHome.jsx`'s existing `setLightbox` wiring carries over unchanged.
- Produces: default export `SchoolMemories`, a `<section id="memories">`. Returns `null` when `highlights.length === 0`, same guard as before.

- [ ] **Step 1: Create the component**

More varied tile sizing than the old mosaic (true masonry feel) via explicit `row-span` variation keyed off index modulo, still using `grid-flow-dense` so gaps fill in regardless of array length.

```jsx
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

const fadeIn = {
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

const SPAN_PATTERN = ['row-span-2', 'row-span-1', 'row-span-1', 'row-span-2', 'row-span-1', 'row-span-1'];

export default function SchoolMemories({ highlights, onSelect }) {
  if (highlights.length === 0) return null;

  return (
    <motion.section
      id="memories"
      className="py-24 px-6"
      style={{ background: 'var(--editorial-gray)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">THE ARCHIVE</p>
        <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-12">
          Moments We'll Always Remember
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 grid-flow-dense gap-3" style={{ gridAutoRows: '160px' }}>
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
              className={`group relative rounded-[var(--radius)] overflow-hidden border-2 border-[var(--brand-ink)] hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow text-left ${SPAN_PATTERN[i % SPAN_PATTERN.length]}`}
            >
              {h.media_type === 'video' ? (
                <>
                  <video src={h.media} className="w-full h-full object-cover" preload="metadata" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Play className="text-white" fill="white" size={28} />
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
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Delete `PhotoMosaic.jsx` and swap usage in `PublicHome.jsx`**

Delete `alumni-frontend/src/components/home/PhotoMosaic.jsx`.

Replace the import (`import PhotoMosaic from '../components/home/PhotoMosaic';`) with:

```jsx
import SchoolMemories from '../components/home/SchoolMemories';
```

Replace `<PhotoMosaic highlights={highlights} onSelect={setLightbox} />` with:

```jsx
      <SchoolMemories highlights={highlights} onSelect={setLightbox} />
```

- [ ] **Step 3: Verify**

Reload, confirm the gallery renders with varied tile heights (masonry feel) on the gray background, and clicking a photo still opens the existing lightbox modal (same `onSelect`/`setLightbox` contract as before — this is the one interface that must not change).

---

### Task 10: AlumniImpact component

**Files:**
- Create: `alumni-frontend/src/components/home/AlumniImpact.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `stats` prop — same shape `PublicHome.jsx` already fetches via `api.get('/stats')` (`{ totalAlumni, totalEvents, totalCheckins }`). Only `totalAlumni` is used here (a real, meaningful, growing number); "Years of Community," "Active Batches," and "Annual Events" are placeholders — none of them map to a real backend concept (`totalEvents` is a small *upcoming*-events count, not a meaningful "annual events" figure, so it's not reused here to avoid an anticlimactic number in what's meant to be an aspirational stats section).
- Produces: default export `AlumniImpact`, a `<section>`.

- [ ] **Step 1: Create the component**

```jsx
import { motion } from 'framer-motion';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const statFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.08, ease: 'easeOut' },
  }),
};

export default function AlumniImpact({ stats }) {
  const items = [
    { value: stats?.totalAlumni ? `${stats.totalAlumni}+` : '—', label: 'Alumni' },
    { value: '35+', label: 'Years of Community' },
    { value: '25', label: 'Active Batches' },
    { value: '50+', label: 'Annual Events' },
  ];

  return (
    <motion.section
      className="py-24 px-6 text-white"
      style={{ background: 'var(--editorial-navy)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {items.map((item, i) => (
          <motion.div key={item.label} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={statFade}>
            <p className="font-editorial text-5xl md:text-6xl mb-2">{item.value}</p>
            <p className="text-sm text-white/60 uppercase tracking-wider">{item.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Wire into `PublicHome.jsx`**

Add the import after `SchoolMemories`, render `<AlumniImpact stats={stats} />` directly after `<SchoolMemories highlights={highlights} onSelect={setLightbox} />`.

- [ ] **Step 3: Verify**

Reload, confirm the 4-stat navy band renders, with the Alumni figure reflecting real data (or `—` if `stats` hasn't loaded yet).

---

### Task 11: GiveBack component (replaces Partnership)

**Files:**
- Create: `alumni-frontend/src/components/home/GiveBack.jsx`
- Delete: `alumni-frontend/src/components/home/Partnership.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: nothing (no props).
- Produces: default export `GiveBack`, a `<section>`.

- [ ] **Step 1: Create the component**

```jsx
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { GraduationCap, Users, HeartHandshake, Megaphone } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const WAYS = [
  { icon: GraduationCap, label: 'Scholarships' },
  { icon: Users, label: 'Mentorship' },
  { icon: HeartHandshake, label: 'Donations' },
  { icon: Megaphone, label: 'Outreach' },
];

export default function GiveBack() {
  return (
    <motion.section
      id="give-back"
      className="py-24 px-6"
      style={{ background: 'var(--editorial-beige)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-6">
          Give Back. Make an Impact.
        </h2>
        <p className="text-lg text-slate-600 leading-relaxed mb-10">
          Alumni support the school and community in more ways than one —
          through scholarships that open doors, mentorship that guides the
          next generation, donations that fund real change, and outreach
          that keeps the community strong.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
          {WAYS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-white border-2 border-[var(--brand-ink)]">
                <Icon size={22} className="text-[var(--brand-accent)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--brand-ink)]">{label}</p>
            </div>
          ))}
        </div>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-[var(--brand-accent)] text-white font-bold px-8 py-3 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] hover:opacity-90 transition-opacity"
        >
          Make a Difference →
        </Link>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Delete `Partnership.jsx` and swap usage in `PublicHome.jsx`**

Delete `alumni-frontend/src/components/home/Partnership.jsx`.

Replace the import and the `<OfficersShowcase />` + `<Partnership />` lines — both are being removed (superseded by `FeaturedAlumni`/`BatchExplorer` and `GiveBack` respectively, already wired in earlier tasks). Delete `alumni-frontend/src/components/home/OfficersShowcase.jsx` too, and remove its import/usage.

Add the import: `import GiveBack from '../components/home/GiveBack';`

Render `<GiveBack />` directly after `<AlumniImpact stats={stats} />`.

- [ ] **Step 3: Verify**

Reload, confirm the Give Back section renders on the beige background with the 4 icon items and CTA button.

---

### Task 12: Join CTA content update + nav anchor links + cleanup

**Files:**
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

- [ ] **Step 1: Add anchor nav links to the header**

In the header's `<div className="flex gap-2 items-center">` block, add nav links before the existing Login/Register/Dashboard buttons. Replace:

```jsx
          <div className="flex gap-2 items-center">
            {user ? (
```

with:

```jsx
          <nav className="hidden md:flex items-center gap-6 mr-6">
            {[
              ['Home', '#'],
              ['About', '#about'],
              ['Alumni', '#alumni'],
              ['Stories', '#stories'],
              ['Events', '#events'],
              ['Memories', '#memories'],
              ['Give Back', '#give-back'],
            ].map(([label, href]) => (
              <a key={label} href={href} className="text-sm font-semibold text-white/80 hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex gap-2 items-center">
            {user ? (
```

(`GiveBack.jsx` from Task 11 already has `id="give-back"` on its root `<motion.section>`, so this link resolves correctly.)

- [ ] **Step 2: Replace the final CTA content**

Replace the existing `{/* CTA */}` block (the `{!user && (...)}` section) with:

```jsx
      {/* Join CTA */}
      <motion.section
        className="max-w-7xl mx-auto px-6 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={sectionFade}
      >
        <div className="bg-[var(--brand-ink)] border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-12 text-center text-white">
          <h2 className="font-editorial text-4xl md:text-5xl mb-4">Your Story Is Part of Our Story.</h2>
          <p className="text-white/70 mb-8 text-lg max-w-xl mx-auto">
            Stay connected, meet fellow alumni, and continue making a difference in the community.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {!user && (
              <Link to="/register">
                <Button variant="primary">
                  Join the Alumni Network
                  <ArrowRight size={18} />
                </Button>
              </Link>
            )}
            {user && (
              <Link to="/profile">
                <Button variant="primary">
                  Update Your Profile
                  <ArrowRight size={18} />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.section>
```

- [ ] **Step 3: Verify**

Reload, confirm the nav links appear on desktop widths and scroll smoothly to each section when clicked (relies on the existing `html { scroll-behavior: smooth; }` in `index.css`), and the final CTA shows the correct button depending on logged-in state.

---

### Task 13: Full-page verification pass

**Files:** none (verification only).

- [ ] **Step 1: Confirm the old files are gone and nothing still imports them**

Run: `cd alumni-frontend && grep -rn "EditorialIntro\|AboutHistory\|OfficersShowcase\|Partnership\|PhotoMosaic" src/` — expect no matches (all superseded components deleted and unreferenced).

- [ ] **Step 2: Scroll through the full homepage**

With `npm run dev` running, load `http://localhost:5173/` and scroll top to bottom at both desktop and a narrow mobile width. Confirm section order: Header, Hero, Alumni Intro, Featured Alumni, Alumni Stories, Announcements, Alumni Events, Batch Explorer, School Memories, Alumni Impact, Give Back, Join CTA, Footer. No overlapping/broken layout, no horizontal scroll on mobile.

- [ ] **Step 3: Confirm real data and the lightbox still work**

Confirm Announcements and Events sections still show real backend data (or their correct empty states), and clicking a photo in School Memories still opens the existing lightbox modal.

- [ ] **Step 4: Confirm other pages are unaffected**

Visit `/register` and `/login`, confirm they still use `Archivo Black` (`font-display`) for headings, not the new serif — the `font-editorial` class should not appear anywhere outside the homepage.

## Commit checkpoint

Per this session's working agreement, do not run `git add`/`git commit`/`git push` for any step above until the user explicitly asks for it. Once all 13 tasks are verified, tell the user what changed and wait for their go-ahead before committing.

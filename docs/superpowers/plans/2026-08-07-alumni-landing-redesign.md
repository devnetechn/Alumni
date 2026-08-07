# Alumni Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic gradient hero and cool-purple SaaS look of the public landing page (`alumni-frontend/src/pages/PublicHome.jsx`) with a warm/nostalgic, brand-tokenized design that includes a swappable full-bleed video hero and Framer Motion polish.

**Architecture:** A new `Hero.jsx` component owns the full-bleed video/poster/gradient hero and its stat boxes. `PublicHome.jsx` keeps its existing data-fetching (unchanged `/announcements`, `/events`, `/stats` calls) and renders `Hero` plus re-themed Announcements/Events/CTA/Footer sections. All colors route through four CSS custom properties in `index.css` so re-theming later is a one-file edit. Video and logo assets are wired as commented-out imports with a `null` fallback constant, so the page renders correctly today and lights up automatically once the real files are dropped in and the import line is uncommented.

**Tech Stack:** React 19, Tailwind CSS v4 (arbitrary-value / inline-style bridge to CSS custom properties), `framer-motion` (new dependency), `lucide-react` (existing), Vite.

## Global Constraints

- No backend, auth, routing, or authenticated-page (Dashboard/Sidebar/etc.) changes — public landing page only, per `docs/superpowers/specs/2026-08-07-alumni-landing-redesign-design.md`.
- Brand colors are placeholders (`--brand-primary: #2b2118`, `--brand-secondary: #7a3b2e`, `--brand-accent: #c99a4a`, `--brand-cream: #f6efe4`) defined once in `alumni-frontend/src/index.css`. Every restyled element must reference these tokens (via `style={{ ... 'var(--brand-*)' }}` or `color-mix(in srgb, var(--brand-*) N%, white)`) — never hardcode a new hex value for brand color, so a future palette swap stays a one-file change.
- Video source is `src/assets/hero.mp4` (not yet supplied) and logo is `src/assets/logo.svg` (not yet supplied). Both are wired as commented-out imports behind a `null` constant — do not `import` them directly, since Vite will fail the build on a missing file.
- This repo has no JS test runner configured (checked: no vitest/jest/testing-library in `package.json`). There is no unit test step in this plan.
- **Lint is scoped, not whole-repo.** Baseline `npm run lint` on this branch already reports 14 pre-existing errors in files this plan never touches: `src/auth.jsx`, `src/pages/AdminPostings.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Directory.jsx`, `src/pages/Groups.jsx`, `src/pages/Messages.jsx`, `src/pages/Notifications.jsx`. Do not fix those — out of scope. Per-task verification is: `npm run lint` must show **zero errors attributed to files this task creates or modifies** (compare the file list in the lint output against the task's own `Files:` section); pre-existing errors in other files are expected and not a task failure. Also do a manual check in the browser via `npm run dev`.
- **Run `npm`/`npx` scripts via PowerShell, not git-bash.** In this environment, git-bash's execution of npm's Windows `.cmd` shims fails with a spurious `'"node"' is not recognized as an internal or external command` error unrelated to the code — confirmed on a clean checkout before any plan changes. Use the PowerShell tool (or `cmd.exe /c npm run ...`) for every `npm run lint` / `npm run dev` / `npm install` step in this plan.
- Follow existing code style in the touched files (Tailwind utility classes, function components, no semicolonless style, double-quoted JSX attributes as already used).

---

### Task 1: Brand tokens, serif font, and `framer-motion` dependency

**Files:**
- Modify: `alumni-frontend/package.json` (via `npm install`)
- Modify: `alumni-frontend/src/index.css`

**Interfaces:**
- Produces: CSS custom properties `--brand-primary`, `--brand-secondary`, `--brand-accent`, `--brand-cream` on `:root`, and a `.font-display` utility class (Fraunces serif), both consumed by every later task.

- [ ] **Step 1: Install `framer-motion`**

```bash
cd alumni-frontend && npm install framer-motion
```

- [ ] **Step 2: Verify the dependency was added**

Run: `grep framer-motion alumni-frontend/package.json`
Expected: a line like `"framer-motion": "^11.x.x"` under `dependencies`.

- [ ] **Step 3: Add brand tokens, serif font import, and `.font-display` utility to `index.css`**

Replace the full contents of `alumni-frontend/src/index.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
@import "tailwindcss";

:root {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;

  /* Brand tokens — placeholder warm palette until the real school logo/colors
     are supplied. Swap these four values to re-theme the whole public site. */
  --brand-primary: #2b2118;
  --brand-secondary: #7a3b2e;
  --brand-accent: #c99a4a;
  --brand-cream: #f6efe4;
}

body {
  margin: 0;
  background: var(--brand-cream);
  color: #0f172a;
  -webkit-font-smoothing: antialiased;
}

* {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.font-display {
  font-family: 'Fraunces', Georgia, serif;
}

html {
  scroll-behavior: smooth;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: #f1f5f9;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 5px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
```

- [ ] **Step 4: Verify lint and dev server still run**

Run (PowerShell, not git-bash — see Global Constraints): `cd alumni-frontend; npm run lint`
Expected: no errors attributed to `package.json` or `src/index.css` (pre-existing errors in the untouched files listed in Global Constraints are expected and not a failure here).

Run: `cd alumni-frontend; npm run dev`, open the printed local URL.
Expected: app loads with no console errors; overall background is now a warm cream instead of `#f8fafc`.

- [ ] **Step 5: Commit**

```bash
git add alumni-frontend/package.json alumni-frontend/package-lock.json alumni-frontend/src/index.css
git commit -m "Add brand color tokens, serif display font, and framer-motion"
```

---

### Task 2: `Hero.jsx` component

**Files:**
- Create: `alumni-frontend/src/components/Hero.jsx`

**Interfaces:**
- Consumes: `--brand-primary`, `--brand-accent` tokens from Task 1; `src/assets/hero.png` (existing file).
- Produces: `export default function Hero({ stats })` — `stats` is either `null` or `{ totalAlumni, totalEvents, totalCheckins }`, matching the shape `PublicHome.jsx` already gets from `api.get('/stats')`. Consumed by Task 3.

- [ ] **Step 1: Create the component**

Create `alumni-frontend/src/components/Hero.jsx`:

```jsx
import { motion } from 'framer-motion';
import { Users, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import heroPoster from '../assets/hero.png';

// Swap point: once the real hero video is supplied, save it as
// src/assets/hero.mp4 and uncomment the two lines below.
// import heroVideoSrc from '../assets/hero.mp4';
const heroVideoSrc = null;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: 'easeOut' },
  }),
};

export default function Hero({ stats }) {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      <div className="absolute inset-0">
        {heroVideoSrc ? (
          <video
            className="w-full h-full object-cover"
            src={heroVideoSrc}
            poster={heroPoster}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img src={heroPoster} alt="" className="w-full h-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(43,33,24,0.55) 0%, rgba(43,33,24,0.75) 60%, rgba(43,33,24,0.92) 100%)',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-24 text-center text-white w-full">
        <motion.div
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeUp}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
        >
          <Sparkles size={14} />
          Reconnect. Network. Grow.
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="font-display text-5xl md:text-6xl font-semibold mb-6 leading-tight"
        >
          Welcome home,
          <br />
          <span style={{ color: 'var(--brand-accent)' }}>fellow alumni.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10"
        >
          Stay connected with your batchmates, discover upcoming events, and explore career
          opportunities — all in one place.
        </motion.p>

        {stats && (
          <motion.div
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
            className="grid grid-cols-3 gap-4 max-w-2xl mx-auto"
          >
            <StatBox icon={Users} label="Alumni" value={stats.totalAlumni} />
            <StatBox icon={Calendar} label="Events" value={stats.totalEvents} />
            <StatBox icon={CheckCircle2} label="Check-ins" value={stats.totalCheckins} />
          </motion.div>
        )}
      </div>
    </section>
  );
}

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5">
      <Icon className="mx-auto mb-2 opacity-80" size={20} />
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs opacity-80 uppercase tracking-wider">{label}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

Run (PowerShell): `cd alumni-frontend; npm run lint`
Expected: no errors attributed to `src/components/Hero.jsx` (this file isn't imported anywhere yet, so it must be lint-clean standalone; pre-existing errors in other files are expected).

- [ ] **Step 3: Commit**

```bash
git add alumni-frontend/src/components/Hero.jsx
git commit -m "Add Hero component with swappable video/poster background"
```

---

### Task 3: Wire `Hero` into `PublicHome` and re-theme the header/nav

**Files:**
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `Hero` from `../components/Hero` (Task 2); brand tokens from `index.css` (Task 1).

- [ ] **Step 1: Replace the top of `PublicHome.jsx` (imports through the header) and remove the old inline hero + `StatBox`**

Replace the entire contents of `alumni-frontend/src/pages/PublicHome.jsx` with (this will be extended further in Tasks 4–5; sections below the header are still the pre-existing ones for now — the full final file appears at the end of Task 5):

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Megaphone, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import Hero from '../components/Hero';

// Swap point: once the real school logo is supplied, save it as
// src/assets/logo.svg and uncomment the two lines below.
// import logo from '../assets/logo.svg';
const logo = null;

export default function PublicHome() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api.get('/announcements').then((r) => setAnnouncements(r.data.announcements));
    api.get('/events').then((r) => setEvents(r.data.events));
    api.get('/stats').then((r) => setStats(r.data));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-cream)' }}>
      {/* Top bar */}
      <header
        className={`fixed top-0 left-0 right-0 z-20 transition-colors duration-300 border-b ${
          scrolled ? 'backdrop-blur-lg' : 'border-transparent'
        }`}
        style={
          scrolled
            ? { background: 'rgba(43,33,24,0.75)', borderColor: 'rgba(255,255,255,0.1)' }
            : undefined
        }
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="Alumni logo" className="h-9 w-9 rounded-lg object-contain" />
            ) : (
              <div className="p-2 rounded-lg" style={{ background: 'var(--brand-secondary)' }}>
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <span className="font-display font-semibold text-white">Alumni System</span>
          </Link>
          <div className="flex gap-2">
            {user ? (
              <Link
                to="/dashboard"
                className="px-5 py-2 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm"
                style={{ background: 'var(--brand-secondary)' }}
              >
                Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2 text-white/90 hover:text-white font-semibold text-sm">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm"
                  style={{ background: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <Hero stats={stats} />

      {/* Announcements */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Megaphone className="text-indigo-600" size={22} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Latest Announcements</h2>
        </div>
        {announcements.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200">No announcements yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {announcements.map((a) => (
              <article key={a.id} className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all">
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
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{a.title}</h3>
                <p className="text-slate-600 leading-relaxed">{a.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Events */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Calendar className="text-purple-600" size={22} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Upcoming Events</h2>
        </div>
        {events.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200">No events scheduled yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {events.map((ev) => (
              <div key={ev.id} className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl transition-all">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white">
                  <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="text-3xl font-bold">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-sm opacity-80">
                    {new Date(ev.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{ev.title}</h3>
                  {ev.location && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                      <MapPin size={14} />
                      {ev.location}
                    </div>
                  )}
                  <p className="text-sm text-slate-600 line-clamp-2">{ev.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      {!user && (
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Ready to reconnect?</h2>
            <p className="text-slate-300 mb-8 text-lg">Join thousands of alumni in our growing network.</p>
            <Link to="/register" className="inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors">
              Create Your Account
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-200 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Alumni Management System. Built with ❤️ for lifelong connections.
        </div>
      </footer>
    </div>
  );
}
```

Note: `Users`, `CheckCircle2`, and `Sparkles` are intentionally dropped from this file's imports (they now live in `Hero.jsx`), and the old inline `StatBox` function is removed (it now lives in `Hero.jsx`). The header is `fixed` instead of `sticky` so it can overlay the video hero transparently before the user scrolls.

- [ ] **Step 2: Verify lint passes**

Run (PowerShell): `cd alumni-frontend; npm run lint`
Expected: no errors attributed to `src/pages/PublicHome.jsx`, no unused-import warnings there (pre-existing errors in other files are expected).

- [ ] **Step 3: Manual check in the browser**

Run: `cd alumni-frontend; npm run dev`, open the local URL at `/`.
Expected: hero renders full-bleed with the existing `hero.png` as a static background (no video file exists yet, so this is the poster/gradient fallback — that's correct), headline/subtext/stats fade in on load, header is transparent at the top and turns into a dark blurred bar after scrolling ~40px, Login/Register buttons show in the new palette.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/pages/PublicHome.jsx
git commit -m "Wire Hero component and re-theme header/nav on the landing page"
```

---

### Task 4: Re-theme Announcements and Events sections with scroll motion

**Files:**
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `motion` from `framer-motion` (Task 1 dependency); brand tokens from `index.css`.

- [ ] **Step 1: Add the `motion` import and two shared variants objects**

In `alumni-frontend/src/pages/PublicHome.jsx`, add `import { motion } from 'framer-motion';` below the existing `import { api } from '../api';` line, and add these two constants above `export default function PublicHome()`:

```jsx
const sectionFade = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: 'easeOut' },
  }),
};
```

- [ ] **Step 2: Replace the Announcements `<section>` block**

Find the `{/* Announcements */}` section in `PublicHome.jsx` and replace it with:

```jsx
      {/* Announcements */}
      <motion.section
        className="max-w-7xl mx-auto px-6 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionFade}
      >
        <div className="flex items-center gap-3 mb-8">
          <div
            className="p-2 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--brand-accent) 18%, white)' }}
          >
            <Megaphone style={{ color: 'var(--brand-secondary)' }} size={22} />
          </div>
          <h2 className="font-display text-3xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Latest Announcements
          </h2>
        </div>
        {announcements.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200">No announcements yet.</p>
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
                className="group bg-white p-6 rounded-2xl border border-[#e8ddc8] hover:shadow-lg transition-shadow"
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
                <h3 className="font-display text-xl font-semibold mb-2" style={{ color: 'var(--brand-primary)' }}>
                  {a.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">{a.body}</p>
              </motion.article>
            ))}
          </div>
        )}
      </motion.section>
```

- [ ] **Step 3: Replace the Events `<section>` block**

Find the `{/* Events */}` section and replace it with:

```jsx
      {/* Events */}
      <motion.section
        className="max-w-7xl mx-auto px-6 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionFade}
      >
        <div className="flex items-center gap-3 mb-8">
          <div
            className="p-2 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--brand-secondary) 15%, white)' }}
          >
            <Calendar style={{ color: 'var(--brand-secondary)' }} size={22} />
          </div>
          <h2 className="font-display text-3xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Upcoming Events
          </h2>
        </div>
        {events.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200">No events scheduled yet.</p>
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
                className="group bg-white rounded-2xl overflow-hidden border border-[#e8ddc8] hover:shadow-xl transition-shadow"
              >
                <div
                  className="p-6 text-white"
                  style={{ background: 'linear-gradient(135deg, var(--brand-secondary), var(--brand-primary))' }}
                >
                  <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="text-3xl font-display font-semibold">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-sm opacity-80">
                    {new Date(ev.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--brand-primary)' }}>
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
```

- [ ] **Step 4: Verify lint passes**

Run (PowerShell): `cd alumni-frontend; npm run lint`
Expected: no errors attributed to `src/pages/PublicHome.jsx`.

- [ ] **Step 5: Manual check in the browser**

Run: `cd alumni-frontend; npm run dev`, open `/`, scroll down.
Expected: Announcements and Events section headers/cards fade+slide up as they enter the viewport, staggered per card; card borders are warm-toned instead of `slate-200`; if there are zero announcements/events the existing "No announcements/events yet" empty-state text still renders unchanged.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/pages/PublicHome.jsx
git commit -m "Re-theme Announcements and Events sections with scroll-reveal motion"
```

---

### Task 5: Re-theme CTA and footer, final cleanup

**Files:**
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

- [ ] **Step 1: Replace the CTA `<section>` block**

Find the `{/* CTA */}` block and replace it with:

```jsx
      {/* CTA */}
      {!user && (
        <motion.section
          className="max-w-7xl mx-auto px-6 py-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionFade}
        >
          <div
            className="rounded-3xl p-12 text-center text-white"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}
          >
            <h2 className="font-display text-4xl font-semibold mb-4">Ready to reconnect?</h2>
            <p className="text-white/80 mb-8 text-lg">Join thousands of alumni in our growing network.</p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              style={{ background: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
            >
              Create Your Account
              <ArrowRight size={18} />
            </Link>
          </div>
        </motion.section>
      )}
```

- [ ] **Step 2: Replace the `<footer>` block**

```jsx
      <footer className="border-t py-8 mt-8" style={{ borderColor: '#e8ddc8' }}>
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Alumni Management System. Built with ❤️ for lifelong connections.
        </div>
      </footer>
```

- [ ] **Step 3: Verify lint passes**

Run (PowerShell): `cd alumni-frontend; npm run lint`
Expected: no errors attributed to `src/pages/PublicHome.jsx`.

- [ ] **Step 4: Manual check in the browser**

Run: `cd alumni-frontend; npm run dev`, open `/` while logged out.
Expected: CTA card uses the warm brand gradient (not `slate-900`), "Create Your Account" button uses the gold accent token; footer border is warm-toned. Log in (or check `useAuth` state) and confirm the CTA section disappears when `user` is truthy, matching prior behavior.

- [ ] **Step 5: Commit**

```bash
git add alumni-frontend/src/pages/PublicHome.jsx
git commit -m "Re-theme CTA and footer sections on the landing page"
```

---

### Task 6: Cross-browser/breakpoint QA and video swap-in check

**Files:** none (verification only)

- [ ] **Step 1: Full lint pass**

Run (PowerShell): `cd alumni-frontend; npm run lint`
Expected: exactly the same 14 pre-existing errors as the documented baseline (see Global Constraints), zero new ones, and zero errors in any file this plan touched (`index.css`, `Hero.jsx`, `PublicHome.jsx`, `package.json`).

- [ ] **Step 2: Responsive check**

Run: `cd alumni-frontend; npm run dev`, open `/` in a browser, and use dev tools device toolbar to check at ~375px (mobile), ~768px (tablet), and desktop widths.
Expected: hero text stays centered and readable at all widths, stats grid (3 columns) doesn't overflow on mobile, header buttons don't wrap awkwardly, Announcements grid collapses to 1 column and Events grid collapses to 1 column below `md` breakpoint (existing Tailwind responsive classes, unchanged).

- [ ] **Step 3: Verify the video swap-in path works**

This confirms the swap point described in the design spec actually functions once a real video exists, using any small `.mp4` as a stand-in.

1. Copy any short `.mp4` file to `alumni-frontend/src/assets/hero.mp4`.
2. In `alumni-frontend/src/components/Hero.jsx`, uncomment the import line and change the constant:

```jsx
import heroVideoSrc from '../assets/hero.mp4';
```

   (delete the `const heroVideoSrc = null;` line below it)

3. Run `cd alumni-frontend; npm run dev`, open `/`.
   Expected: the hero now plays the video muted/looped/full-bleed instead of showing the static poster image.
4. Revert both changes (re-comment the import, restore `const heroVideoSrc = null;`) and delete `alumni-frontend/src/assets/hero.mp4`, since the real asset hasn't been supplied yet.

Run: `git status --short alumni-frontend/src/components/Hero.jsx`
Expected: no output (file matches the committed Task 2 version) — confirms the revert was clean.

- [ ] **Step 4: Confirm logged-in view is untouched**

Log in as any user, navigate to `/dashboard` and a couple of other authenticated pages (e.g. `/directory`, `/events`).
Expected: Sidebar, MobileHeader, and all authenticated pages look exactly as before — this redesign only touches the logged-out `/` landing page.

No commit for this task — it's verification only. If any check fails, fix the issue in the relevant earlier task's file and commit the fix there before moving on.

# President's Message Homepage Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static "A Word From Our President" section to the public homepage, between `AlumniIntro` and `FeaturedAlumni`.

**Architecture:** One new presentational React component (`PresidentMessage.jsx`) following the exact `motion.section` fade-in pattern already used by `AlumniIntro.jsx`, rendering hardcoded placeholder content (no props, no API calls). Wired into `PublicHome.jsx` with a single import + render line.

**Tech Stack:** React (JSX), Tailwind utility classes + this project's CSS custom properties (`--brand-ink`, `--brand-accent`, `--brand-bg`), `framer-motion` for the scroll-reveal, `lucide-react` for the quote icon, existing `Avatar` UI component.

## Global Constraints

- No backend/database changes — spec is explicit this is static content only (`docs/superpowers/specs/2026-08-11-president-message-design.md`, Non-goals).
- Placeholder content must be clearly marked with a code comment noting it needs to be swapped for the real name/photo/message later.
- Section must sit between `<AlumniIntro />` and `<FeaturedAlumni />` in `PublicHome.jsx`.
- Match existing homepage section conventions: `motion.section`, `hidden`/`visible` fade variant (`opacity` + `y: 16→0`, `duration: 0.25`, `ease: 'easeOut'`), `viewport={{ once: true, amount: 0.3 }}`, brand CSS tokens, `font-editorial` for display type.

---

### Task 1: Create the `PresidentMessage` component and wire it into the homepage

**Files:**
- Create: `alumni-frontend/src/components/home/PresidentMessage.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx` (add import near the other `components/home/*` imports at the top; render `<PresidentMessage />` between `<AlumniIntro />` and `<FeaturedAlumni />`)

**Interfaces:**
- Consumes: `Avatar` from `alumni-frontend/src/components/ui/Avatar.jsx` (existing signature: `<Avatar name={string} pic={string|undefined} size="lg" />` — renders initials when `pic` is omitted, confirmed at `alumni-frontend/src/components/ui/Avatar.jsx:1-10`), `Quote` icon from `lucide-react`, `motion` from `framer-motion`.
- Produces: default export `PresidentMessage` — a zero-prop component (`<PresidentMessage />`), consumed only by `PublicHome.jsx`.

This is a purely static, visual component — no state, no network calls, so there's no meaningful unit test to write (nothing to assert against besides "does React render this JSX," which the build step already covers). Verification is a lint + build pass plus a manual visual check in the dev server, per the spec's Testing section.

- [ ] **Step 1: Create the component file**

```jsx
// alumni-frontend/src/components/home/PresidentMessage.jsx
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import Avatar from '../ui/Avatar';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

// Placeholder content — replace with the real president's name, title,
// message, and photo (pass `pic` to <Avatar> once a photo exists).
const PRESIDENT_NAME = 'Juan Dela Cruz';
const PRESIDENT_TITLE = 'President, IHES Alumni Association';
const PRESIDENT_MESSAGE =
  "Every year, I'm reminded that this association isn't really about " +
  'reunions or events — it\'s about the friendships and support that never ' +
  'stopped, no matter how far apart life has taken us. Wherever you are ' +
  'now, know that you always have a home here, among people who remember ' +
  'where you started.';

export default function PresidentMessage() {
  return (
    <motion.section
      className="bg-[var(--brand-ink)] py-24 px-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-6">
          A WORD FROM OUR PRESIDENT
        </p>
        <Quote className="mx-auto mb-6 text-[var(--brand-accent)]" size={36} strokeWidth={2.5} />
        <p className="font-editorial italic text-2xl md:text-3xl leading-snug text-white mb-8">
          {PRESIDENT_MESSAGE}
        </p>
        <div className="flex flex-col items-center gap-3">
          <Avatar name={PRESIDENT_NAME} size="lg" />
          <div>
            <p className="font-bold text-white">{PRESIDENT_NAME}</p>
            <p className="text-sm text-white/60">{PRESIDENT_TITLE}</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Wire it into `PublicHome.jsx`**

Add the import next to the other `components/home/*` imports (`alumni-frontend/src/pages/PublicHome.jsx:8`, right after the `AlumniIntro` import):

```jsx
import AlumniIntro from '../components/home/AlumniIntro';
import PresidentMessage from '../components/home/PresidentMessage';
```

Render it between `<AlumniIntro />` and `<FeaturedAlumni />` (`alumni-frontend/src/pages/PublicHome.jsx:165-167`):

```jsx
      <AlumniIntro />

      <PresidentMessage />

      <FeaturedAlumni />
```

- [ ] **Step 3: Lint**

Run: `cd alumni-frontend && npm run lint`
Expected: no errors on `PresidentMessage.jsx` or `PublicHome.jsx`.

- [ ] **Step 4: Build**

Run: `cd alumni-frontend && npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manual visual check**

Run: `cd alumni-frontend && npm run dev`, open the homepage in a browser.
Confirm:
- The section appears directly after the "Connected by memories..." intro section and before the Featured Alumni section.
- It fades in on scroll the same way neighboring sections do.
- The dark panel, quote icon, italic message, and avatar/name/title signature render correctly.
- At a mobile viewport width (~375px), text and spacing stay readable (no overflow/clipping).

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/components/home/PresidentMessage.jsx alumni-frontend/src/pages/PublicHome.jsx
git commit -m "feat(frontend): add president's message section to homepage"
```

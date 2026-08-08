# Frontend Brutalist Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin every page of `alumni-frontend` (landing, auth, and all 15 authenticated pages) from the current warm-cream/serif/soft-shadow look onto a new Bold Brutalist design system (white base, electric-blue accent, thick borders, hard offset shadows, Archivo Black headlines + Inter body), as the platform's own SaaS product identity.

**Architecture:** Introduce a small shared `src/components/ui/` primitive kit (Panel, Button, Input, Badge, StatTile, Avatar, Wordmark) and a `src/lib/chartTheme.js` helper, both built once in Task 2. Every subsequent page task consumes these primitives instead of re-declaring Tailwind arbitrary-value strings, so the visual language stays consistent and any later tweak (e.g. adjusting the shadow offset) is a one-file change. No component's props, API calls, or routing logic changes — this is a styling-layer pass only.

**Tech Stack:** React 19, Tailwind CSS v4 (arbitrary-value classes against CSS custom properties), `lucide-react` icons, `recharts` v3, `framer-motion` v13. No test framework is configured for this package (`eslint` only) — verification per task is `npm run lint` plus a described manual check via `npm run dev`.

## Global Constraints

- Design tokens (colors, radius, shadow, fonts) are defined once in `src/index.css` per Task 1 and never redeclared with raw hex values in page files — always reference the CSS custom properties or the primitives that wrap them.
- No blurred/soft `box-shadow` anywhere in touched code — shadows are always the hard offset form `Npx Npx 0 var(--brand-ink)` (or `var(--shadow)` / `var(--shadow-sm)`).
- No `rounded-full` pill badges — badges are rectangular (`rounded-[var(--radius)]` at most), per the design spec's brutalist component patterns.
- Corner radius is `6px` (`--radius`) everywhere, never `0` and never Tailwind's larger `rounded-2xl`/`rounded-3xl`.
- `Archivo Black` is used only for headline-level text (`h1`/`h2`/section titles); body text, labels, and buttons stay on `Inter`.
- No page's data-fetching, state shape, routing, or conditional logic changes — only `className` strings, inline `style` objects, and which component (raw `<div>`/`<button>`/`<input>` vs. a `ui/` primitive) renders a given element.
- Every task ends with `npm run lint` passing with zero errors before commit.

---

## Task 1: Design tokens and fonts

**Files:**
- Modify: `alumni-frontend/src/index.css` (full file, currently 47 lines)

**Interfaces:**
- Produces: the CSS custom properties every later task relies on — `--brand-ink`, `--brand-bg`, `--brand-surface`, `--brand-accent`, `--brand-accent-ink`, `--brand-danger`, `--brand-success`, `--radius`, `--border-w`, `--shadow`, `--shadow-sm`, plus the `font-display`/`font-body` utility classes (`.font-display` already exists as a class; keep that name but repoint it to Archivo Black).

- [ ] **Step 1: Replace the Google Fonts import and brand tokens**

Replace lines 1–13 of `alumni-frontend/src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800&display=swap');
@import "tailwindcss";

:root {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;

  /* Platform brand tokens — the SaaS product's own identity, not a
     per-school theme. Per-school branding is a separate future project. */
  --brand-ink: #111111;
  --brand-bg: #ffffff;
  --brand-surface: #f7f7f8;
  --brand-accent: #2b5cff;
  --brand-accent-ink: #ffffff;
  --brand-danger: #ff5c35;
  --brand-success: #16a34a;

  --radius: 6px;
  --border-w: 2.5px;
  --shadow: 4px 4px 0 var(--brand-ink);
  --shadow-sm: 3px 3px 0 var(--brand-ink);
}
```

- [ ] **Step 2: Repoint `.font-display` and drop the now-unused warm scrollbar colors**

Replace lines 26–47 (the `.font-display` rule through end of file):

```css
.font-display {
  font-family: 'Archivo Black', sans-serif;
}

html {
  scroll-behavior: smooth;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: var(--brand-surface);
}
::-webkit-scrollbar-thumb {
  background: var(--brand-ink);
  border-radius: var(--radius);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--brand-accent);
}
```

Keep lines 15–24 (`body`, `*`) unchanged, except update `background: var(--brand-cream)` → `background: var(--brand-bg)` on the `body` rule (line 17).

- [ ] **Step 3: Verify**

Run: `npm run lint` (from `alumni-frontend/`)
Expected: 0 errors (CSS isn't linted by this config, but this confirms nothing else broke).

Run: `npm run dev`, open the app — every page will look visually broken/mixed at this point (old classNames referencing `--brand-primary`/`--brand-secondary`/`--brand-cream`, which no longer exist, will fall back to transparent/unstyled). This is expected until Task 3 onward migrate each page; don't chase it now.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/index.css
git commit -m "style: replace warm brand tokens with brutalist platform tokens"
```

---

## Task 2: Shared UI primitives and chart theme

**Files:**
- Create: `alumni-frontend/src/components/ui/Panel.jsx`
- Create: `alumni-frontend/src/components/ui/Button.jsx`
- Create: `alumni-frontend/src/components/ui/Input.jsx`
- Create: `alumni-frontend/src/components/ui/Badge.jsx`
- Create: `alumni-frontend/src/components/ui/StatTile.jsx`
- Create: `alumni-frontend/src/components/ui/Avatar.jsx`
- Create: `alumni-frontend/src/components/ui/Wordmark.jsx`
- Create: `alumni-frontend/src/components/ui/index.js`
- Create: `alumni-frontend/src/lib/chartTheme.js`

**Interfaces:**
- Consumes: tokens from Task 1 (`--brand-ink`, `--brand-accent`, `--radius`, etc.)
- Produces (exact names/signatures every later task imports):
  - `Panel({ children, className, as, ...props })` — bordered/shadowed white container.
  - `Button({ variant = 'primary'|'secondary'|'ghost'|'danger', className, ...props })` — renders `<button>`, forwards ref.
  - `Input({ as = 'input'|'textarea'|'select', className, ...props })` — forwards ref.
  - `Badge({ children, tone = 'neutral'|'accent'|'success'|'danger'|'warning', className })`.
  - `StatTile({ label, value, icon })` — `icon` is a `lucide-react` component reference.
  - `Avatar({ name, email, pic, size = 'sm'|'md'|'lg' })`.
  - `Wordmark({ className })` — platform placeholder brand mark.
  - `CHART_COLORS: string[]`, `chartTooltipStyle: object`, `chartAxisProps: object`, `chartGridProps: object` from `lib/chartTheme.js`.

- [ ] **Step 1: Create `Panel.jsx`**

```jsx
export default function Panel({ children, className = '', as: As = 'div', ...props }) {
  return (
    <As
      className={`bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[4px_4px_0_var(--brand-ink)] ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}
```

- [ ] **Step 2: Create `Button.jsx`**

```jsx
import { forwardRef } from 'react';

const base = 'inline-flex items-center justify-center gap-2 border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-xs uppercase tracking-wide px-4 py-2.5 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0';

const variants = {
  primary: 'bg-[var(--brand-accent)] text-white shadow-[3px_3px_0_var(--brand-ink)]',
  secondary: 'bg-white text-[var(--brand-ink)] shadow-[3px_3px_0_var(--brand-ink)]',
  ghost: 'bg-transparent text-[var(--brand-ink)] border-transparent shadow-none px-2 py-1',
  danger: 'bg-[var(--brand-danger)] text-white shadow-[3px_3px_0_var(--brand-ink)]',
};

const Button = forwardRef(({ variant = 'primary', className = '', ...props }, ref) => (
  <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
));
Button.displayName = 'Button';
export default Button;
```

- [ ] **Step 3: Create `Input.jsx`**

```jsx
import { forwardRef } from 'react';

const Input = forwardRef(({ as: As = 'input', className = '', ...props }, ref) => (
  <As
    ref={ref}
    className={`w-full border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--brand-accent)] focus:shadow-[3px_3px_0_var(--brand-accent)] transition-all placeholder:text-slate-400 ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';
export default Input;
```

- [ ] **Step 4: Create `Badge.jsx`**

```jsx
export default function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-white text-[var(--brand-ink)]',
    accent: 'bg-[var(--brand-accent)] text-white',
    success: 'bg-[var(--brand-success)] text-white',
    danger: 'bg-[var(--brand-danger)] text-white',
    warning: 'bg-[#ffd23f] text-[var(--brand-ink)]',
  };
  return (
    <span className={`inline-flex items-center gap-1 border-2 border-[var(--brand-ink)] rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Create `StatTile.jsx`**

```jsx
export default function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[4px_4px_0_var(--brand-ink)] p-4">
      {Icon && (
        <div className="mb-2">
          <Icon size={18} className="text-[var(--brand-ink)]" />
        </div>
      )}
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-display text-[26px] leading-none mt-1.5 text-[var(--brand-ink)]">{value}</p>
    </div>
  );
}
```

- [ ] **Step 6: Create `Avatar.jsx`**

```jsx
export default function Avatar({ name, email, pic, size = 'md' }) {
  const display = name || email || '?';
  const initial = display[0].toUpperCase();
  const dims = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-20 h-20 text-3xl' };
  return (
    <div className={`${dims[size]} rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}>
      {pic ? <img src={pic} alt="" className="w-full h-full object-cover" /> : initial}
    </div>
  );
}
```

- [ ] **Step 7: Create `Wordmark.jsx`**

```jsx
// Placeholder platform wordmark. Once the real product name/logo is
// decided, this is the single place to swap it — every brand-mark
// location in the app renders this component.
export default function Wordmark({ className = '' }) {
  return (
    <span className={`font-display text-[15px] tracking-tight ${className}`}>
      [ ALUMNI/OS ]
    </span>
  );
}
```

- [ ] **Step 8: Create the barrel `index.js`**

```js
export { default as Panel } from './Panel';
export { default as Button } from './Button';
export { default as Input } from './Input';
export { default as Badge } from './Badge';
export { default as StatTile } from './StatTile';
export { default as Avatar } from './Avatar';
export { default as Wordmark } from './Wordmark';
```

- [ ] **Step 9: Create `src/lib/chartTheme.js`**

```js
export const CHART_COLORS = ['#2b5cff', '#ff5c35', '#16a34a', '#ffd23f', '#8b5cf6', '#0ea5e9'];

export const chartTooltipStyle = {
  background: '#ffffff',
  border: '2.5px solid #111111',
  borderRadius: 6,
  boxShadow: '3px 3px 0 #111111',
  fontSize: 13,
};

export const chartAxisProps = { stroke: '#111111', fontSize: 12 };
export const chartGridProps = { stroke: '#e5e5e5', strokeDasharray: '3 3' };
```

- [ ] **Step 10: Verify**

Run: `npm run lint`
Expected: 0 errors. These files aren't imported anywhere yet, so nothing renders differently — this step only confirms the new files themselves are lint-clean (no unused-var/prop-types issues).

- [ ] **Step 11: Commit**

```bash
git add alumni-frontend/src/components/ui alumni-frontend/src/lib/chartTheme.js
git commit -m "feat: add brutalist UI primitive kit and chart theme"
```

---

## Task 3: App shell (Sidebar, MobileHeader, Shell)

**Files:**
- Modify: `alumni-frontend/src/App.jsx:47-147`

**Interfaces:**
- Consumes: `Wordmark`, `Button` from `./components/ui`.

- [ ] **Step 1: Replace the `Sidebar` function (lines 47–109)**

```jsx
function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:sticky lg:flex-shrink-0 top-0 left-0 h-screen w-64 bg-white border-r-[2.5px] border-[var(--brand-ink)] z-40 flex flex-col transition-transform lg:transform-none ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2 px-6 py-5 border-b-[2.5px] border-[var(--brand-ink)] flex-shrink-0">
          <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] rounded-[var(--radius)] p-2">
            <GraduationCap className="text-white" size={22} />
          </div>
          <div>
            <Wordmark />
            <p className="text-xs text-slate-500 leading-tight">IHES Alumni Association</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems
            .filter((i) => !i.adminOnly || user.role === 'admin')
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] text-sm font-bold transition-colors border-2 ${
                  isActive
                    ? 'bg-[var(--brand-accent)] text-white border-[var(--brand-ink)]'
                    : 'text-[var(--brand-ink)] border-transparent hover:border-[var(--brand-ink)] hover:bg-[var(--brand-surface)]'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t-[2.5px] border-[var(--brand-ink)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--brand-ink)] truncate">{user.email}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => { logout(); nav('/'); }}>
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Replace `MobileHeader` (lines 111–125)**

```jsx
function MobileHeader({ onMenu }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <header className="lg:hidden sticky top-0 z-20 bg-white border-b-[2.5px] border-[var(--brand-ink)] px-4 py-3 flex items-center gap-3">
      <button onClick={onMenu} className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        <GraduationCap className="text-[var(--brand-accent)]" size={20} />
        <Wordmark />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Update `Shell`'s background (line 139)**

Change:
```jsx
    <div className="flex min-h-screen bg-[var(--brand-cream)]">
```
to:
```jsx
    <div className="flex min-h-screen bg-[var(--brand-bg)]">
```

- [ ] **Step 4: Add the import**

At the top of `App.jsx`, after the existing `lucide-react` import line, add:
```jsx
import { Wordmark, Button } from './components/ui';
```

- [ ] **Step 5: Verify**

Run: `npm run lint` — expect 0 errors.
Run: `npm run dev`, log in, confirm: sidebar is white with a thick black right border, nav items show a hard black-bordered blue active state, mobile hamburger menu still opens/closes the drawer, logout button works.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/App.jsx
git commit -m "style: restyle app shell (sidebar, mobile header) to brutalist system"
```

---

## Task 4: Auth pages (Login, Register)

**Files:**
- Modify: `alumni-frontend/src/pages/Login.jsx` (full file, 121 lines)
- Modify: `alumni-frontend/src/pages/Register.jsx` (full file, 107 lines)

**Interfaces:**
- Consumes: `Panel`, `Button`, `Input`, `Wordmark` from `../components/ui`.

- [ ] **Step 1: Rewrite `Login.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth';
import { Button, Input, Wordmark } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email, password);
      nav('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--brand-ink)] relative overflow-hidden border-r-[2.5px] border-[var(--brand-ink)]">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-[var(--brand-accent)] border-2 border-white p-2 rounded-[var(--radius)]">
              <GraduationCap size={22} />
            </div>
            <Wordmark className="text-white" />
          </Link>
          <div>
            <h1 className="font-display text-5xl mb-4 leading-tight">
              Welcome<br />back.
            </h1>
            <p className="text-white/70 text-lg max-w-md">
              Sign in to access your alumni network, events, and career opportunities.
            </p>
          </div>
          <p className="text-sm text-white/50">© {new Date().getFullYear()} IHES Alumni Association</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <GraduationCap className="text-white" size={22} />
            </div>
            <Wordmark />
          </div>

          <h2 className="font-display text-3xl text-[var(--brand-ink)] mb-2">Sign in</h2>
          <p className="text-slate-500 mb-8">Enter your credentials to continue</p>

          {err && (
            <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-4 text-sm">
              {err}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  className="pl-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  as="input"
                  type="password"
                  className="pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : <>Sign in <ArrowRight size={18} /></>}
            </Button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account? <Link to="/register" className="text-[var(--brand-accent)] hover:underline font-bold">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

Note: the hardcoded demo-credential hint block (old lines 112–116) and the `password` field's `admin123` default value are removed here — both were flagged as misleading in a multi-school world by the multi-tenant SaaS design doc, and removing them was already in that doc's scope.

- [ ] **Step 2: Rewrite `Register.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth';
import { Panel, Button, Input, Wordmark } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', batch_year: '', course: '', contact: '', company: '', position: '', industry: ''
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await register({ ...form, batch_year: form.batch_year ? parseInt(form.batch_year) : null });
      nav('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.error || 'Register failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[var(--brand-ink)] hover:text-[var(--brand-accent)] mb-6 text-sm font-bold">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <Panel className="p-8 lg:p-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <GraduationCap className="text-white" size={22} />
            </div>
            <Wordmark />
          </div>

          <h1 className="font-display text-3xl text-[var(--brand-ink)] mb-2">Create your account</h1>
          <p className="text-slate-500 mb-8">Join the alumni network and stay connected.</p>

          {err && (
            <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-5 text-sm">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <Section title="Account">
              <Field label="Full Name" span>
                <Input value={form.full_name} onChange={update('full_name')} required />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={update('email')} required />
              </Field>
              <Field label="Password">
                <Input type="password" value={form.password} onChange={update('password')} required />
              </Field>
            </Section>

            <Section title="Academic">
              <Field label="Batch Year">
                <Input value={form.batch_year} onChange={update('batch_year')} placeholder="2020" />
              </Field>
              <Field label="Course">
                <Input value={form.course} onChange={update('course')} placeholder="BS Computer Science" />
              </Field>
            </Section>

            <Section title="Professional">
              <Field label="Contact">
                <Input value={form.contact} onChange={update('contact')} />
              </Field>
              <Field label="Industry">
                <Input value={form.industry} onChange={update('industry')} />
              </Field>
              <Field label="Company">
                <Input value={form.company} onChange={update('company')} />
              </Field>
              <Field label="Position">
                <Input value={form.position} onChange={update('position')} />
              </Field>
            </Section>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : <>Create Account <ArrowRight size={18} /></>}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account? <Link to="/login" className="text-[var(--brand-accent)] hover:underline font-bold">Sign in</Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect 0 errors.
Run: `npm run dev`, visit `/login` and `/register` logged out. Confirm: forms submit correctly (test with an existing seeded account if available), error states render in the new danger-red bordered box, layout unchanged (left dark panel on Login at `lg+`, back-link + card on Register).

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/pages/Login.jsx alumni-frontend/src/pages/Register.jsx
git commit -m "style: restyle Login and Register to brutalist system"
```

---

## Task 5: Landing page (PublicHome, Hero)

**Files:**
- Modify: `alumni-frontend/src/components/Hero.jsx` (full file, 107 lines)
- Modify: `alumni-frontend/src/pages/PublicHome.jsx` (full file, 258 lines)

**Interfaces:**
- Consumes: `Panel`, `Button`, `Badge`, `Wordmark` from `../components/ui`.
- Produces: no change to `Hero`'s prop contract (`stats`) — `PublicHome` continues to pass it the same way.

- [ ] **Step 1: Restyle `Hero.jsx`**

Replace the gradient overlay (lines 37–43) with a flatter dark scrim (brutalist doesn't use soft gradients, but a hero video still needs *some* darkening for text contrast — use a flat semi-opaque black instead of the color-mix gradient):

```jsx
        <div className="absolute inset-0 bg-black/55" />
```

Replace the eyebrow badge (lines 47–56):
```jsx
        <motion.div
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeUp}
          className="inline-flex items-center gap-2 bg-[var(--brand-accent)] border-2 border-white px-4 py-1.5 rounded-[var(--radius)] text-sm font-bold mb-6 text-white"
        >
          <Sparkles size={14} />
          Reconnect. Network. Grow.
        </motion.div>
```

Replace the headline (lines 58–68) — swap `font-display text-5xl md:text-6xl font-semibold` for the new Archivo Black weight and drop the accent-colored span's reliance on `--brand-accent` text-on-dark (electric blue is legible on the dark scrim, keep it):
```jsx
        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="font-display text-5xl md:text-6xl mb-6 leading-tight"
        >
          Welcome home,
          <br />
          <span style={{ color: 'var(--brand-accent)' }}>fellow alumni.</span>
        </motion.h1>
```

Replace `StatBox` (lines 99–107):
```jsx
function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/10 border-2 border-white/40 rounded-[var(--radius)] p-5">
      <Icon className="mx-auto mb-2 opacity-90" size={20} />
      <p className="font-display text-3xl">{value}</p>
      <p className="text-xs opacity-80 uppercase tracking-wider">{label}</p>
    </div>
  );
}
```

Shorten every `fadeUp` transition (line 11–18) from the current 0.6s/0.12s-stagger to match the plan's snappier motion goal:
```jsx
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, delay: i * 0.06, ease: 'easeOut' },
  }),
};
```

- [ ] **Step 2: Restyle `PublicHome.jsx` header/nav (lines 16–99)**

Shorten `sectionFade`/`cardFade` durations to match Hero's snappier motion:
```jsx
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
```

Replace the `<header>` block (lines 53–99):
```jsx
      <header
        className={`fixed top-0 left-0 right-0 z-20 transition-colors duration-300 border-b-[2.5px] ${
          scrolled ? 'bg-[var(--brand-ink)] border-[var(--brand-ink)]' : 'border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="Alumni logo" className="h-9 w-9 rounded-[var(--radius)] object-contain" />
            ) : (
              <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-white">
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <Wordmark className="text-white" />
          </Link>
          <div className="flex gap-2 items-center">
            {user ? (
              <Link to="/dashboard">
                <Button variant="primary">Dashboard →</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2 text-white/90 hover:text-white font-bold text-sm">
                  Login
                </Link>
                <Link to="/register">
                  <Button variant="primary">Register</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
```

Change the page root background (line 51) from `style={{ background: 'var(--brand-cream)' }}` to `style={{ background: 'var(--brand-bg)' }}`.

- [ ] **Step 3: Restyle the Announcements section (lines 103–156)**

Replace the section icon badge + heading (lines 111–121):
```jsx
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)]">
            <Megaphone className="text-white" size={22} />
          </div>
          <h2 className="font-display text-3xl text-[var(--brand-ink)]">
            Latest Announcements
          </h2>
        </div>
```

Replace the empty state (line 123):
```jsx
          <Panel className="p-8 text-slate-500">No announcements yet.</Panel>
```

Replace the card wrapper's className/style (lines 134–135) — drop the `style` prop entirely and use the standard Panel look:
```jsx
                className="group bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-6 hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
```
(remove the `style={{ borderColor: ... }}` prop on this element entirely)

Replace the card title color (line 148, `style={{ color: 'var(--brand-primary)' }}` → drop the `style` prop, add `text-[var(--brand-ink)]` to the className):
```jsx
                <h3 className="font-display text-xl mb-2 text-[var(--brand-ink)]">
```

- [ ] **Step 4: Restyle the Events section (lines 159–222)**

Same icon-badge pattern as Step 3 (lines 166–176):
```jsx
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)]">
            <Calendar className="text-white" size={22} />
          </div>
          <h2 className="font-display text-3xl text-[var(--brand-ink)]">
            Upcoming Events
          </h2>
        </div>
```

Replace the empty state (line 178) the same way as Step 3's.

Replace the event card (lines 189–218) — drop the `style` border-color prop, flatten the date-header gradient to a solid ink fill:
```jsx
                className="group bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] overflow-hidden hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
              >
                <div className="p-6 text-white bg-[var(--brand-ink)]">
                  <div className="text-xs uppercase tracking-wider opacity-70 mb-1">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="font-display text-3xl">
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
```
(the remainder of the card — location/description — is unchanged)

- [ ] **Step 5: Restyle the CTA section (lines 224–249)**

```jsx
          <div className="bg-[var(--brand-ink)] border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-12 text-center text-white">
            <h2 className="font-display text-4xl mb-4">Ready to reconnect?</h2>
            <p className="text-white/70 mb-8 text-lg">Join thousands of alumni in our growing network.</p>
            <Link to="/register">
              <Button variant="primary">
                Create Your Account
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
```

- [ ] **Step 6: Restyle the footer (lines 251–255)**

```jsx
      <footer className="border-t-[2.5px] border-[var(--brand-ink)] py-8 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} IHES Alumni Association. Built for lifelong connections.
        </div>
      </footer>
```

- [ ] **Step 7: Update imports**

At the top of `PublicHome.jsx`, add to the existing named imports from `../components/ui`:
```jsx
import { Panel, Button, Wordmark } from '../components/ui';
```

- [ ] **Step 8: Verify**

Run: `npm run lint` — expect 0 errors.
Run: `npm run dev`, visit `/` logged out and logged in. Confirm: hero renders with poster fallback (no `hero.mp4` present yet — expected per the original swap-point design), header is transparent-over-hero then solid ink on scroll, announcement/event cards show hard shadows, CTA section hides when logged in, footer renders.

- [ ] **Step 9: Commit**

```bash
git add alumni-frontend/src/components/Hero.jsx alumni-frontend/src/pages/PublicHome.jsx
git commit -m "style: restyle landing page (Hero, PublicHome) to brutalist system"
```

---

## Task 6: Dashboard (stats + recharts)

**Files:**
- Modify: `alumni-frontend/src/pages/Dashboard.jsx` (full file, 205 lines)

**Interfaces:**
- Consumes: `StatTile` from `../components/ui`; `CHART_COLORS`, `chartTooltipStyle`, `chartAxisProps`, `chartGridProps` from `../lib/chartTheme`.

- [ ] **Step 1: Replace the top-of-file imports and `COLORS` constant (lines 1–11)**

```jsx
import { useEffect, useState } from 'react';
import {
  Users, Calendar, CheckCircle2, MessageSquare,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '../api';
import { StatTile } from '../components/ui';
import { CHART_COLORS, chartTooltipStyle, chartAxisProps, chartGridProps } from '../lib/chartTheme';
```

- [ ] **Step 2: Replace the header and stat-tile row (lines 22–35)**

```jsx
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)]">Welcome back</h1>
        <p className="text-slate-500 mt-1">Here's what's happening in your alumni community</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total Alumni" value={stats.totalAlumni} icon={Users} />
        <StatTile label="Total Events" value={stats.totalEvents} icon={Calendar} />
        <StatTile label="Check-ins" value={stats.totalCheckins} icon={CheckCircle2} />
        <StatTile label="Messages Sent" value={stats.totalMessages} icon={MessageSquare} />
      </div>
```

(This removes the old per-tile `bg`/icon-color props and the "Live" `ArrowUpRight` badge, matching the new flat `StatTile` primitive.)

- [ ] **Step 3: Replace the area chart's gradient defs and series colors (lines 37–60)**

```jsx
      <Panel title="Registrations & Check-ins Trend" subtitle="Last 12 months">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={mergeTrends(stats.registrationsTrend, stats.checkinsTrend)}>
            <CartesianGrid {...chartGridProps} vertical={false} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Area type="monotone" dataKey="registrations" stroke={CHART_COLORS[0]} strokeWidth={2.5} fill={CHART_COLORS[0]} fillOpacity={0.15} name="New Alumni" />
            <Area type="monotone" dataKey="checkins" stroke={CHART_COLORS[1]} strokeWidth={2.5} fill={CHART_COLORS[1]} fillOpacity={0.15} name="Event Check-ins" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
```

(Flat-opacity fills replace the `<linearGradient>` defs — no gradients anywhere in the brutalist system.)

- [ ] **Step 4: Replace the bar chart (lines 64–80)**

```jsx
        <Panel title="Alumni by Batch Year">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.byBatch}>
              <CartesianGrid {...chartGridProps} vertical={false} />
              <XAxis dataKey="label" {...chartAxisProps} />
              <YAxis {...chartAxisProps} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--brand-surface)' }} />
              <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[2, 2, 0, 0]} name="Alumni" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
```

- [ ] **Step 5: Replace the two `Cell`-mapped pie charts' color source (lines 96–98 and 146–148)**

Both occurrences of:
```jsx
                {stats.byIndustry.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
```
and
```jsx
                {stats.byCourse.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
```
change `COLORS` → `CHART_COLORS` (the import replaces the old local constant entirely — there is no other reference to `COLORS` left in the file after Step 1).

- [ ] **Step 6: Replace the remaining `Tooltip`/`CartesianGrid`/`XAxis`/`YAxis` props (lines 100, 110–113, 123–127) with the shared theme**

Line 100 and 150 (`<Tooltip contentStyle={tooltipStyle} />`) → `<Tooltip contentStyle={chartTooltipStyle} />`.

Lines 110–113 (Events by Month line chart):
```jsx
              <CartesianGrid {...chartGridProps} vertical={false} />
              <XAxis dataKey="label" {...chartAxisProps} />
              <YAxis {...chartAxisProps} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[2]} strokeWidth={3} dot={{ fill: CHART_COLORS[2], r: 5 }} activeDot={{ r: 7 }} name="Events" />
```

Lines 123–127 (Top Companies horizontal bar):
```jsx
              <CartesianGrid {...chartGridProps} horizontal={false} />
              <XAxis type="number" {...chartAxisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="label" {...chartAxisProps} width={100} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--brand-surface)' }} />
              <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[0, 2, 2, 0]} name="Alumni" />
```

- [ ] **Step 7: Delete the old local `tooltipStyle` const and `StatCard` function (lines 169–193)**

Both are fully superseded — `tooltipStyle` by the imported `chartTooltipStyle`, `StatCard` by the imported `StatTile`. Delete both function/const declarations entirely.

- [ ] **Step 8: Replace the `Panel` helper (lines 195–205)**

```jsx
function Panel({ title, subtitle, children, full }) {
  return (
    <div className={`bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[4px_4px_0_var(--brand-ink)] p-6 ${full ? 'lg:col-span-2' : ''}`}>
      <div className="mb-4">
        <h2 className="font-display text-lg text-[var(--brand-ink)]">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
```

(This local `Panel` stays a distinct file-local component rather than importing the shared `ui/Panel` — it has a `title`/`subtitle`/`full` API the shared primitive doesn't, and every other Dashboard panel already calls it that way. Renaming call sites is out of scope for this pass.)

- [ ] **Step 9: Verify**

Run: `npm run lint` — expect 0 errors (watch for the removed `ArrowUpRight` and `TrendingUp` icon imports — both are unused after Step 1 and must not remain imported).
Run: `npm run dev`, visit `/dashboard`. Confirm: 4 stat tiles render with hard shadows, all 6 charts render with flat (non-gradient) fills, tooltips show as small bordered/shadowed boxes, no console errors.

- [ ] **Step 10: Commit**

```bash
git add alumni-frontend/src/pages/Dashboard.jsx
git commit -m "style: restyle Dashboard stats and charts to brutalist system"
```

---

## Task 7: Directory and AdminUsers (table-heavy pages)

**Files:**
- Modify: `alumni-frontend/src/pages/Directory.jsx` (full file, 118 lines)
- Modify: `alumni-frontend/src/pages/AdminUsers.jsx` (full file, 122 lines)

**Interfaces:**
- Consumes: `Panel`, `Button`, `Input`, `Badge`, `Avatar` from `../components/ui`.

- [ ] **Step 1: Rewrite `Directory.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Briefcase, GraduationCap, Tag, MessageSquare, Handshake } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input, Avatar } from '../components/ui';

export default function Directory() {
  const [alumni, setAlumni] = useState([]);
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [course, setCourse] = useState('');
  const [industry, setIndustry] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [mentor, setMentor] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = async () => {
    const { data } = await api.get('/alumni', {
      params: { search, batch, course, industry, company, location, mentor: mentor ? 1 : '' },
    });
    setAlumni(data.alumni);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)]">Alumni Directory</h1>
        <p className="text-slate-500 mt-1">Find and connect with fellow alumni</p>
      </div>

      <Panel className="p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={18} />
            <Input
              className="pl-10"
              placeholder="Search name, company, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
          <Input className="md:w-32" placeholder="Batch" value={batch} onChange={(e) => setBatch(e.target.value)} />
          <Input className="md:w-48" placeholder="Course" value={course} onChange={(e) => setCourse(e.target.value)} />
          <Button onClick={load}>Search</Button>
        </div>
        <div className="mt-3">
          <button onClick={() => setShowAdvanced((v) => !v)} className="text-sm text-[var(--brand-accent)] hover:underline font-bold">
            {showAdvanced ? 'Hide' : 'Show'} advanced filters
          </button>
        </div>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-[var(--brand-ink)] font-semibold">
              <input type="checkbox" checked={mentor} onChange={(e) => setMentor(e.target.checked)} />
              Mentors only
            </label>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {alumni.length === 0 && (
          <Panel className="col-span-full p-8 text-center text-slate-500">
            No alumni found.
          </Panel>
        )}
        {alumni.map((a) => (
          <Panel key={a.id} className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Avatar name={a.full_name} size="md" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[var(--brand-ink)] truncate">{a.full_name}</h3>
                <p className="text-xs text-slate-500 truncate">{a.email}</p>
              </div>
              {a.mentor_available && (
                <span title="Mentor" className="text-[var(--brand-success)]"><Handshake size={18} /></span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <GraduationCap size={14} className="text-[var(--brand-accent)]" />
                <span>Batch {a.batch_year} · {a.course}</span>
              </div>
              {a.company && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Briefcase size={14} className="text-[var(--brand-accent)]" />
                  <span className="truncate">{a.position} @ {a.company}</span>
                </div>
              )}
              {a.industry && (
                <div className="text-xs text-slate-500">Industry: {a.industry}</div>
              )}
              {a.nfc_uid && (
                <div className="flex items-center gap-2 text-[var(--brand-success)]">
                  <Tag size={14} />
                  <span className="text-xs font-mono">{a.nfc_uid}</span>
                </div>
              )}
            </div>
            <Link to={`/messages?to=${a.user_id}`}>
              <Button variant="secondary" className="mt-4 w-full">
                <MessageSquare size={14} /> Message
              </Button>
            </Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `AdminUsers.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Shield, UserX, UserCheck, Trash2, Crown, Star } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Badge, Avatar } from '../components/ui';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);

  const load = () => api.get('/admin/users').then((r) => setUsers(r.data.users));
  useEffect(() => { load(); }, []);

  const toggleRole = async (u) => {
    await api.put(`/admin/users/${u.id}`, { role: u.role === 'admin' ? 'alumni' : 'admin' });
    load();
  };

  const toggleActive = async (u) => {
    await api.put(`/admin/users/${u.id}`, { active: !u.active });
    load();
  };

  const toggleLeader = async (u) => {
    await api.put(`/admin/users/${u.id}`, { is_batch_leader: !u.is_batch_leader });
    load();
  };

  const remove = async (u) => {
    if (!confirm(`Delete ${u.email}?`)) return;
    await api.delete(`/admin/users/${u.id}`);
    load();
  };

  if (me?.role !== 'admin') {
    return <div className="p-8 text-[var(--brand-danger)] font-semibold">Admin access required.</div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Shield className="text-[var(--brand-accent)]" size={28} />
          User Management
        </h1>
        <p className="text-slate-500 mt-1">Manage alumni accounts, roles, and membership status</p>
      </div>

      <Panel className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-[2.5px] border-[var(--brand-ink)] text-[var(--brand-ink)] text-xs uppercase tracking-wider">
              <th className="py-3 px-6 text-left font-bold">User</th>
              <th className="py-3 px-6 text-left font-bold">Batch</th>
              <th className="py-3 px-6 text-left font-bold">Role</th>
              <th className="py-3 px-6 text-left font-bold">Status</th>
              <th className="py-3 px-6 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-200 hover:bg-[var(--brand-surface)]">
                <td className="py-3 px-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.full_name} email={u.email} size="md" />
                    <div>
                      <p className="font-bold text-[var(--brand-ink)]">{u.full_name || '(No profile)'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-6 text-slate-600">
                  {u.batch_year || '—'}
                  {u.is_batch_leader && (
                    <Badge tone="warning" className="ml-2"><Star size={10} /> Leader</Badge>
                  )}
                </td>
                <td className="py-3 px-6">
                  {u.role === 'admin' ? (
                    <Badge tone="accent"><Crown size={12} /> Admin</Badge>
                  ) : (
                    <Badge tone="neutral">Alumni</Badge>
                  )}
                </td>
                <td className="py-3 px-6">
                  {u.active ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="danger">Inactive</Badge>
                  )}
                </td>
                <td className="py-3 px-6 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => toggleRole(u)} title="Toggle admin" className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                      <Crown size={16} />
                    </button>
                    <button onClick={() => toggleActive(u)} title="Toggle active" className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                      {u.active ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    <button onClick={() => toggleLeader(u)} title="Toggle batch leader" className={`p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] ${u.is_batch_leader ? 'text-[#b8860b]' : 'text-[var(--brand-ink)]'}`}>
                      <Star size={16} />
                    </button>
                    {u.id !== me.id && (
                      <button onClick={() => remove(u)} title="Delete" className="p-2 border-2 border-transparent hover:border-[var(--brand-danger)] rounded-[var(--radius)] text-[var(--brand-danger)]">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect 0 errors.
Run: `npm run dev`, visit `/directory` (search + advanced filters still work) and `/admin/users` as an admin account (role toggle, active toggle, leader toggle, delete still work).

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/pages/Directory.jsx alumni-frontend/src/pages/AdminUsers.jsx
git commit -m "style: restyle Directory and AdminUsers to brutalist system"
```

---

## Task 8: Events cluster (Events, EventCheckin, EventRegistrations)

**Files:**
- Modify: `alumni-frontend/src/pages/Events.jsx` (full file, 142 lines)
- Modify: `alumni-frontend/src/pages/EventCheckin.jsx` (full file, 100 lines)
- Modify: `alumni-frontend/src/pages/EventRegistrations.jsx` (full file, 115 lines)

**Interfaces:**
- Consumes: `Panel`, `Button`, `Input`, `Badge` from `../components/ui`.

- [ ] **Step 1: Rewrite `Events.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Calendar, Clock, QrCode, X, Check, HelpCircle, XCircle, ClipboardCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Button, Input } from '../components/ui';

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', event_date: '' });

  const [rsvpState, setRsvpState] = useState({});

  const load = async () => {
    const { data } = await api.get('/events');
    setEvents(data.events);
    const states = {};
    await Promise.all(data.events.map(async (ev) => {
      try {
        const r = await api.get(`/events/${ev.id}/rsvp`);
        states[ev.id] = { counts: r.data.counts, myStatus: r.data.myStatus };
      } catch {}
    }));
    setRsvpState(states);
  };
  useEffect(() => { load(); }, []);

  const rsvp = async (eventId, status) => {
    await api.post(`/events/${eventId}/rsvp`, { status });
    load();
  };

  const create = async (e) => {
    e.preventDefault();
    await api.post('/events', form);
    setForm({ title: '', description: '', location: '', event_date: '' });
    setShowForm(false);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">Events</h1>
          <p className="text-slate-500 mt-1">Upcoming alumni gatherings and activities</p>
        </div>
        {user.role === 'admin' && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New Event</>}
          </Button>
        )}
      </div>

      {showForm && (
        <Panel as="form" onSubmit={create} className="p-6 mb-6 grid grid-cols-2 gap-4">
          <Input className="col-span-2" placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
          <Input as="textarea" className="col-span-2" rows="3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button type="submit" className="col-span-2">Create Event</Button>
        </Panel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.length === 0 && (
          <Panel className="col-span-full p-8 text-center text-slate-500">
            No events yet.
          </Panel>
        )}
        {events.map((ev) => {
          const d = new Date(ev.event_date);
          return (
            <Panel key={ev.id} className="overflow-hidden group">
              <div className="bg-[var(--brand-ink)] p-6 text-white">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-70 mb-1">
                  <Calendar size={12} />
                  {d.toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="font-display text-4xl">
                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex items-center gap-1 text-sm opacity-80 mt-1">
                  <Clock size={12} />
                  {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-[var(--brand-ink)] mb-2 group-hover:text-[var(--brand-accent)] transition-colors">{ev.title}</h3>
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                    <MapPin size={14} />
                    {ev.location}
                  </div>
                )}
                <p className="text-sm text-slate-600 line-clamp-2 mb-4">{ev.description}</p>

                {rsvpState[ev.id]?.counts && (
                  <div className="flex gap-3 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1"><Check size={12} className="text-[var(--brand-success)]" /> {rsvpState[ev.id].counts.going} going</span>
                    <span className="flex items-center gap-1"><HelpCircle size={12} className="text-[#b8860b]" /> {rsvpState[ev.id].counts.maybe}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1 mb-3">
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'going'} onClick={() => rsvp(ev.id, 'going')} tone="success" icon={Check} label="Going" />
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'maybe'} onClick={() => rsvp(ev.id, 'maybe')} tone="warning" icon={HelpCircle} label="Maybe" />
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'not_going'} onClick={() => rsvp(ev.id, 'not_going')} tone="danger" icon={XCircle} label="No" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link to={`/events/${ev.id}/checkin`}>
                    <Button variant="secondary" className="w-full">
                      <QrCode size={16} /> Check-in
                    </Button>
                  </Link>
                  <Link to={`/events/${ev.id}/registrations`}>
                    <Button variant="secondary" className="w-full">
                      <ClipboardCheck size={16} /> Registrations
                    </Button>
                  </Link>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function RsvpBtn({ active, onClick, tone, icon: Icon, label }) {
  const toneMap = {
    success: active ? 'bg-[var(--brand-success)] text-white border-[var(--brand-ink)]' : 'border-slate-300 text-slate-600 hover:border-[var(--brand-success)]',
    warning: active ? 'bg-[#ffd23f] text-[var(--brand-ink)] border-[var(--brand-ink)]' : 'border-slate-300 text-slate-600 hover:border-[#b8860b]',
    danger: active ? 'bg-[var(--brand-danger)] text-white border-[var(--brand-ink)]' : 'border-slate-300 text-slate-600 hover:border-[var(--brand-danger)]',
  };
  return (
    <button onClick={onClick} className={`border-2 px-2 py-1.5 rounded-[var(--radius)] text-xs font-bold flex items-center justify-center gap-1 transition-colors ${toneMap[tone]}`}>
      <Icon size={12} /> {label}
    </button>
  );
}
```

- [ ] **Step 2: Rewrite `EventCheckin.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Download, QrCode } from 'lucide-react';
import { api, API_BASE } from '../api';
import { Panel, Button, Badge } from '../components/ui';

export default function EventCheckin() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const canvasRef = useRef(null);

  const loadAttendance = () => api.get(`/events/${id}/checkin`).then((r) => setAttendance(r.data.attendance));

  useEffect(() => {
    api.get(`/events/${id}`).then((r) => setEvent(r.data.event)).catch(() => {});
    loadAttendance();
  }, [id]);

  useEffect(() => {
    if (canvasRef.current) {
      const payload = `EVENT:${id}`;
      QRCode.toCanvas(canvasRef.current, payload, {
        width: 280,
        margin: 2,
        color: { dark: '#111111', light: '#ffffff' },
      });
    }
  }, [id]);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">Event Check-in</h1>
          <p className="text-slate-500 mt-1">Show this QR code to alumni at the entrance</p>
        </div>
        <a href={`${API_BASE}/api/events/${id}/export`}>
          <Button variant="secondary">
            <Download size={18} />
            Export CSV
          </Button>
        </a>
      </div>

      <Panel className="p-8 mb-6 flex flex-col items-center">
        {event && (
          <div className="text-center mb-4">
            <h2 className="font-display text-2xl text-[var(--brand-ink)]">{event.title}</h2>
            {event.location && <p className="text-slate-500">{event.location}</p>}
            <p className="text-sm text-slate-500">{new Date(event.event_date).toLocaleString()}</p>
          </div>
        )}
        <div className="p-4 bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)]">
          <canvas ref={canvasRef} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <QrCode size={16} />
          <span>Event code: <span className="font-mono font-semibold">EVENT:{id}</span></span>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="p-6 border-b-[2.5px] border-[var(--brand-ink)] flex items-center justify-between">
          <h2 className="font-bold text-[var(--brand-ink)]">Attendance List</h2>
          <Badge tone="accent">{attendance.length} checked in</Badge>
        </div>
        {attendance.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No check-ins yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--brand-ink)] text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-6 font-bold">Name</th>
                  <th className="py-3 px-6 font-bold">Batch</th>
                  <th className="py-3 px-6 font-bold">Course</th>
                  <th className="py-3 px-6 font-bold">Time</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-[var(--brand-surface)]">
                    <td className="py-3 px-6 font-semibold text-[var(--brand-ink)]">{a.full_name}</td>
                    <td className="py-3 px-6 text-slate-600">{a.batch_year}</td>
                    <td className="py-3 px-6 text-slate-600">{a.course}</td>
                    <td className="py-3 px-6 text-slate-500">{new Date(a.checked_in_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `EventRegistrations.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, XCircle, DollarSign, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Button, Badge } from '../components/ui';

export default function EventRegistrations() {
  const { id } = useParams();
  const { user } = useAuth();
  const [regs, setRegs] = useState([]);
  const [err, setErr] = useState(null);

  const load = async () => {
    setErr(null);
    try {
      const { data } = await api.get(`/events/${id}/registrations`);
      setRegs(data.registrations);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load');
    }
  };

  useEffect(() => { load(); }, [id]);

  const patch = async (alumniId, body) => {
    try {
      await api.patch(`/events/${id}/registrations/${alumniId}`, body);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Update failed');
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[var(--brand-ink)] mb-4 font-semibold">
        <ArrowLeft size={14} /> Back to events
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
            <ClipboardCheck className="text-[var(--brand-accent)]" /> Event Registrations
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin ? 'Mark attendees as paid before the event' : 'View-only — only admin/president can mark payment'}
          </p>
        </div>
      </div>

      {err && (
        <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-4 rounded-[var(--radius)] mb-4">{err}</div>
      )}

      <Panel className="overflow-hidden">
        {regs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No registrations yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-[var(--brand-ink)] border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">Alumni</th>
                <th className="py-3 px-4 text-left font-bold">Batch</th>
                <th className="py-3 px-4 text-left font-bold">RSVP</th>
                <th className="py-3 px-4 text-left font-bold">Payment</th>
                <th className="py-3 px-4 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.rsvp_id} className="border-t border-slate-100">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[var(--brand-ink)]">{r.full_name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{r.batch_year}</td>
                  <td className="py-3 px-4">
                    <Badge tone={r.status === 'going' ? 'success' : 'neutral'}>{r.status}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    {r.paid ? (
                      <span className="inline-flex items-center gap-1 text-[var(--brand-success)] font-semibold"><CheckCircle2 size={14} /> Paid</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--brand-danger)] font-semibold"><XCircle size={14} /> Unpaid</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isAdmin ? (
                      <Button
                        variant={r.paid ? 'secondary' : 'primary'}
                        className="text-xs px-3 py-1.5"
                        onClick={() => patch(r.alumni_id, { paid: !r.paid })}
                      >
                        <DollarSign size={12} /> {r.paid ? 'Mark Unpaid' : 'Mark Paid'}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="mt-4 text-xs text-slate-500">
        Gate: alumni must RSVP <b>going</b> and be marked <b>paid</b> by the admin/president before check-in. Scanning at the event is done by <b>officers</b> (batch leaders) or admin.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint` — expect 0 errors.
Run: `npm run dev`. Visit `/events` (create event as admin, RSVP as alumni, both nav links to checkin/registrations work), `/events/:id/checkin` (QR renders, CSV export link works, attendance table renders), `/events/:id/registrations` (paid toggle works for admin, view-only for non-admin).

- [ ] **Step 5: Commit**

```bash
git add alumni-frontend/src/pages/Events.jsx alumni-frontend/src/pages/EventCheckin.jsx alumni-frontend/src/pages/EventRegistrations.jsx
git commit -m "style: restyle Events, EventCheckin, EventRegistrations to brutalist system"
```

---

## Task 9: Content/posting pages (Announcements, Jobs, AdminPostings) and PosterBadge

**Files:**
- Modify: `alumni-frontend/src/components/PosterBadge.jsx` (full file, 30 lines)
- Modify: `alumni-frontend/src/pages/Announcements.jsx` (full file, 101 lines)
- Modify: `alumni-frontend/src/pages/Jobs.jsx` (full file, 149 lines)
- Modify: `alumni-frontend/src/pages/AdminPostings.jsx` (full file, 157 lines)

**Interfaces:**
- Consumes: `Panel`, `Button`, `Input`, `Badge`, `Avatar`, `Wordmark` from `../components/ui` (or `./ui` from within `components/`).
- Produces: `PosterBadge`'s prop contract (`name, email, pic, role, subtitle, date, size`) is unchanged — only its internals restyle.

- [ ] **Step 1: Rewrite `PosterBadge.jsx`**

```jsx
import { Crown } from 'lucide-react';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';

export default function PosterBadge({ name, email, pic, role, subtitle, date, size = 'md' }) {
  const display = name || email || 'Unknown';

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} email={email} pic={pic} size={size === 'sm' ? 'sm' : 'md'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-[var(--brand-ink)] text-sm truncate">{display}</p>
          {role === 'admin' && <Badge tone="accent"><Crown size={10} /> ADMIN</Badge>}
        </div>
        {(subtitle || date) && (
          <p className="text-xs text-slate-500 truncate">
            {subtitle}{subtitle && date ? ' · ' : ''}{date}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `Announcements.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import { Panel, Button, Input } from '../components/ui';

export default function Announcements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', body: '' });
  const [showForm, setShowForm] = useState(false);

  const load = () => api.get('/announcements').then((r) => setItems(r.data.announcements));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post('/announcements', form);
    setForm({ title: '', body: '' });
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    await api.delete(`/announcements/${id}`);
    load();
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">Announcements</h1>
          <p className="text-slate-500 mt-1">News and updates for the alumni community</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New</>}
          </Button>
        )}
      </div>

      {showForm && isAdmin && (
        <Panel as="form" onSubmit={submit} className="p-6 mb-6 space-y-4">
          <Input placeholder="Announcement title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input as="textarea" rows="5" placeholder="Write your announcement..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Button type="submit">Publish</Button>
        </Panel>
      )}

      <div className="space-y-4">
        {items.length === 0 && (
          <Panel className="p-8 text-center text-slate-500">
            No announcements yet.
          </Panel>
        )}
        {items.map((a) => (
          <Panel key={a.id} className="p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <PosterBadge
                name={a.poster_name}
                email={a.poster_email}
                pic={a.poster_pic}
                role={a.poster_role}
                subtitle={a.poster_position}
                date={new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              />
              {isAdmin && (
                <button onClick={() => remove(a.id)} className="text-slate-400 hover:text-[var(--brand-danger)] p-1">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <h3 className="text-xl font-bold text-[var(--brand-ink)] mb-2">{a.title}</h3>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `Jobs.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Trash2, Briefcase, MapPin, Building2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import { Panel, Button, Input, Badge, Wordmark } from '../components/ui';

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', description: '', job_type: 'job', is_referral: false });
  const [filter, setFilter] = useState('');

  const load = () => api.get('/jobs', { params: filter ? { type: filter } : {} }).then((r) => setJobs(r.data.jobs));
  useEffect(() => { load(); }, [filter]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post('/jobs', form);
    setForm({ title: '', company: '', location: '', description: '', job_type: 'job', is_referral: false });
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this job posting?')) return;
    await api.delete(`/jobs/${id}`);
    load();
  };

  const content = (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">Job Board</h1>
          <p className="text-slate-500 mt-1">Career opportunities shared by our alumni</p>
        </div>
        {user ? (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> Post Job</>}
          </Button>
        ) : (
          <Link to="/login"><Button>Login to post</Button></Link>
        )}
      </div>

      {showForm && user && (
        <Panel as="form" onSubmit={submit} className="p-6 mb-6 grid grid-cols-2 gap-4">
          <Input className="col-span-2" placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input as="select" value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
            <option value="job">Full-time / Part-time</option>
            <option value="internship">Internship</option>
          </Input>
          <label className="flex items-center gap-2 text-sm text-[var(--brand-ink)] font-semibold">
            <input type="checkbox" checked={form.is_referral} onChange={(e) => setForm({ ...form, is_referral: e.target.checked })} />
            Referral (I can refer applicants)
          </label>
          <Input as="textarea" className="col-span-2" rows="4" placeholder="Job description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button type="submit" className="col-span-2">Post</Button>
        </Panel>
      )}

      <div className="mb-5 flex gap-2">
        {['', 'job', 'internship'].map((t) => (
          <button
            key={t || 'all'}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-[var(--radius)] text-sm font-bold border-2 ${filter === t ? 'bg-[var(--brand-accent)] text-white border-[var(--brand-ink)]' : 'bg-white border-[var(--brand-ink)] text-[var(--brand-ink)]'}`}
          >
            {t === '' ? 'All' : t === 'job' ? 'Jobs' : 'Internships'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {jobs.length === 0 && (
          <Panel className="col-span-full p-8 text-center text-slate-500">
            No job postings yet.
          </Panel>
        )}
        {jobs.map((j) => (
          <Panel key={j.id} className="p-6 group">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2.5 rounded-[var(--radius)]">
                <Briefcase className="text-white" size={20} />
              </div>
              {user && (user.role === 'admin' || user.email === j.poster_email) && (
                <button onClick={() => remove(j.id)} className="text-slate-400 hover:text-[var(--brand-danger)] p-1">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-[var(--brand-ink)] group-hover:text-[var(--brand-accent)] transition-colors">{j.title}</h3>
              {j.job_type === 'internship' && <Badge tone="warning">Internship</Badge>}
              {j.is_referral && <Badge tone="success">Referral</Badge>}
            </div>
            {j.company && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--brand-ink)] font-semibold mt-1">
                <Building2 size={14} />
                {j.company}
              </div>
            )}
            {j.location && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                <MapPin size={14} />
                {j.location}
              </div>
            )}
            <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap line-clamp-3">{j.description}</p>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <PosterBadge
                name={j.poster_name}
                email={j.poster_email}
                pic={j.poster_pic}
                role={j.poster_role}
                subtitle={j.poster_position}
                date={new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                size="sm"
              />
            </div>
          </Panel>
        ))}
      </div>
    </>
  );

  if (user) {
    return <div className="p-6 lg:p-10 max-w-7xl mx-auto">{content}</div>;
  }
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 bg-white border-b-[2.5px] border-[var(--brand-ink)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <Briefcase className="text-white" size={20} />
            </div>
            <Wordmark />
          </Link>
          <Link to="/login"><Button>Login</Button></Link>
        </div>
      </header>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto">{content}</div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `AdminPostings.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { FileText, Calendar, Briefcase, Trash2, Shield } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import { Panel, Badge } from '../components/ui';

export default function AdminPostings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('announcements');
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [jobs, setJobs] = useState([]);

  const load = async () => {
    const [a, e, j] = await Promise.all([
      api.get('/announcements'),
      api.get('/events'),
      api.get('/jobs'),
    ]);
    setAnnouncements(a.data.announcements);
    setEvents(e.data.events);
    setJobs(j.data.jobs);
  };

  useEffect(() => { load(); }, []);

  const del = async (type, id) => {
    if (!confirm('Delete this posting?')) return;
    await api.delete(`/${type}/${id}`);
    load();
  };

  if (user?.role !== 'admin') {
    return <div className="p-8 text-[var(--brand-danger)] font-semibold">Admin access required.</div>;
  }

  const tabs = [
    { id: 'announcements', label: 'Announcements', icon: FileText, count: announcements.length },
    { id: 'events', label: 'Events', icon: Calendar, count: events.length },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, count: jobs.length },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Shield className="text-[var(--brand-accent)]" size={28} />
          Manage Postings
        </h1>
        <p className="text-slate-500 mt-1">All announcements, events, and job postings in one place</p>
      </div>

      <div className="flex gap-2 mb-6 bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-1.5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius)] font-bold text-sm transition-colors ${
              tab === t.id ? 'bg-[var(--brand-accent)] text-white' : 'text-[var(--brand-ink)] hover:bg-[var(--brand-surface)]'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            <Badge tone={tab === t.id ? 'neutral' : 'neutral'} className={tab === t.id ? '!border-white' : ''}>{t.count}</Badge>
          </button>
        ))}
      </div>

      {tab === 'announcements' && (
        <List
          items={announcements}
          empty="No announcements yet."
          render={(a) => (
            <Row key={a.id} poster={a} title={a.title} body={a.body} date={a.created_at} onDelete={() => del('announcements', a.id)} />
          )}
        />
      )}

      {tab === 'events' && (
        <List
          items={events}
          empty="No events yet."
          render={(e) => (
            <Row key={e.id} poster={e} title={e.title} body={`${e.location || 'TBA'} · ${new Date(e.event_date).toLocaleString()}`} sub={e.description} date={e.created_at} onDelete={() => del('events', e.id)} />
          )}
        />
      )}

      {tab === 'jobs' && (
        <List
          items={jobs}
          empty="No job postings yet."
          render={(j) => (
            <Row key={j.id} poster={j} title={j.title} body={`${j.company || ''} ${j.location ? '· ' + j.location : ''}`} sub={j.description} date={j.created_at} onDelete={() => del('jobs', j.id)} />
          )}
        />
      )}
    </div>
  );
}

function List({ items, empty, render }) {
  if (items.length === 0) {
    return <Panel className="p-8 text-center text-slate-500">{empty}</Panel>;
  }
  return <div className="space-y-3">{items.map(render)}</div>;
}

function Row({ poster, title, body, sub, date, onDelete }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <PosterBadge
          name={poster.poster_name}
          email={poster.poster_email}
          pic={poster.poster_pic}
          role={poster.poster_role}
          subtitle={poster.poster_position}
          date={new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          size="sm"
        />
        <button onClick={onDelete} className="text-slate-400 hover:text-[var(--brand-danger)] p-1">
          <Trash2 size={16} />
        </button>
      </div>
      <h3 className="font-bold text-[var(--brand-ink)]">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{body}</p>
      {sub && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{sub}</p>}
    </Panel>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run lint` — expect 0 errors.
Run: `npm run dev`. Visit `/announcements` (post/delete as admin), `/jobs` both logged in and logged out (filter pills, post form, delete as owner/admin), `/admin/postings` (tab switching, delete across all three types). Confirm `PosterBadge` renders correctly everywhere it's used (also appears on `PublicHome.jsx` from Task 5 — spot check that page still renders correctly since `PosterBadge` changed).

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/components/PosterBadge.jsx alumni-frontend/src/pages/Announcements.jsx alumni-frontend/src/pages/Jobs.jsx alumni-frontend/src/pages/AdminPostings.jsx
git commit -m "style: restyle Announcements, Jobs, AdminPostings, PosterBadge to brutalist system"
```

---

## Task 10: Profile and AlumniId

**Files:**
- Modify: `alumni-frontend/src/pages/Profile.jsx` (full file, 239 lines)
- Modify: `alumni-frontend/src/pages/AlumniId.jsx` (full file, 124 lines)

**Interfaces:**
- Consumes: `Panel`, `Button`, `Input` from `../components/ui`.

- [ ] **Step 1: Rewrite `Profile.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { Radio, Save, UserCircle, CheckCircle2, XCircle, Upload, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input } from '../components/ui';

export default function Profile() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: 'Please select an image file' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Image too large (max 2MB)' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setForm((f) => ({ ...f, profile_pic: dataUrl }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => setForm((f) => ({ ...f, profile_pic: '' }));

  useEffect(() => {
    api.get('/me').then((r) => {
      setMe(r.data.me);
      setForm(r.data.me || {});
    });
  }, []);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const { data } = await api.put('/me', {
        ...form,
        batch_year: form.batch_year ? parseInt(form.batch_year) : null,
      });
      setMe(data.me);
      setMsg({ type: 'ok', text: 'Profile updated successfully!' });
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Update failed' });
    }
  };

  const scanNfc = async () => {
    if (!('NDEFReader' in window)) {
      alert('Web NFC only works on Chrome Android.');
      return;
    }
    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.onreading = (ev) => {
        setForm((f) => ({ ...f, nfc_uid: ev.serialNumber }));
      };
    } catch (e) {
      alert('NFC scan failed: ' + e.message);
    }
  };

  if (!me) return <div className="p-8 text-slate-500">Loading...</div>;

  const MsgIcon = msg?.type === 'ok' ? CheckCircle2 : XCircle;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)]">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your personal and professional information</p>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-4 rounded-[var(--radius)] mb-6 border-2 font-semibold ${
          msg.type === 'ok' ? 'bg-white border-[var(--brand-success)] text-[var(--brand-success)]' : 'bg-white border-[var(--brand-danger)] text-[var(--brand-danger)]'
        }`}>
          <MsgIcon size={20} />
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        <Panel className="p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] overflow-hidden flex items-center justify-center text-white font-extrabold text-3xl flex-shrink-0">
            {form.profile_pic ? (
              <img src={form.profile_pic} alt="" className="w-full h-full object-cover" />
            ) : (
              (me.full_name || me.email)[0].toUpperCase()
            )}
          </div>
          <div>
            <h2 className="font-display text-2xl text-[var(--brand-ink)]">{me.full_name || 'Complete your profile'}</h2>
            <p className="text-slate-500">{me.email}</p>
            {me.role === 'admin' && <span className="inline-block mt-1 bg-[var(--brand-accent)] text-white text-xs px-2 py-0.5 rounded border-2 border-[var(--brand-ink)] font-bold">ADMIN</span>}
          </div>
        </Panel>

        <Section title="Profile Photo">
          <div className="col-span-2 flex items-center gap-5">
            <div className="w-24 h-24 rounded-[var(--radius)] bg-[var(--brand-accent)] border-[2.5px] border-[var(--brand-ink)] overflow-hidden flex items-center justify-center text-white font-extrabold text-4xl flex-shrink-0">
              {form.profile_pic ? (
                <img src={form.profile_pic} alt="" className="w-full h-full object-cover" />
              ) : (
                (form.full_name || me.email)[0].toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} /> Upload Photo
                </Button>
                {form.profile_pic && (
                  <Button type="button" variant="danger" onClick={clearPhoto}>
                    <Trash2 size={16} /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">JPG or PNG, max 2MB. Auto-resized to 400px.</p>
            </div>
          </div>
        </Section>

        <Section title="Personal Information" icon={UserCircle}>
          <Field label="Full Name" span>
            <Input value={form.full_name || ''} onChange={update('full_name')} />
          </Field>
          <Field label="Contact">
            <Input value={form.contact || ''} onChange={update('contact')} />
          </Field>
          <Field label="Address">
            <Input value={form.address || ''} onChange={update('address')} />
          </Field>
        </Section>

        <Section title="Academic">
          <Field label="Batch Year">
            <Input value={form.batch_year || ''} onChange={update('batch_year')} />
          </Field>
          <Field label="Course">
            <Input value={form.course || ''} onChange={update('course')} />
          </Field>
        </Section>

        <Section title="Professional">
          <Field label="Company">
            <Input value={form.company || ''} onChange={update('company')} />
          </Field>
          <Field label="Position">
            <Input value={form.position || ''} onChange={update('position')} />
          </Field>
          <Field label="Industry" span>
            <Input value={form.industry || ''} onChange={update('industry')} />
          </Field>
          <Field label="Bio" span>
            <Input as="textarea" rows="3" value={form.bio || ''} onChange={update('bio')} placeholder="Tell other alumni about yourself..." />
          </Field>
          <Field label="Mentorship" span>
            <label className="flex items-center gap-2 text-sm text-[var(--brand-ink)] font-semibold">
              <input type="checkbox" checked={!!form.mentor_available} onChange={(e) => setForm({ ...form, mentor_available: e.target.checked })} />
              I am available as a mentor
            </label>
          </Field>
        </Section>

        <Section title="Alumni Card">
          <Field label="NFC UID" span>
            <div className="flex gap-2">
              <Input className="font-mono" value={form.nfc_uid || ''} onChange={update('nfc_uid')} placeholder="Tap scan or type manually" />
              <Button type="button" onClick={scanNfc} className="flex-shrink-0">
                <Radio size={16} /> Scan
              </Button>
            </div>
          </Field>
        </Section>

        <Button type="submit">
          <Save size={18} /> Save Changes
        </Button>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <Panel className="p-6">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </Panel>
  );
}

function Field({ label, children, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `AlumniId.jsx`**

The ID card keeps a distinct "physical card" treatment (it's meant to be printed/scanned, not just another dashboard panel) but moves from the soft indigo/purple gradient + blur-blob decoration to a flat ink card with a blue accent stripe, consistent with the rest of the system:

```jsx
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, GraduationCap } from 'lucide-react';
import { api } from '../api';
import { Button, Panel } from '../components/ui';

export default function AlumniId() {
  const [me, setMe] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get('/me').then((r) => setMe(r.data.me));
  }, []);

  useEffect(() => {
    if (me && canvasRef.current) {
      const code = me.nfc_uid || `ALUMNI:${me.id}`;
      QRCode.toCanvas(canvasRef.current, code, { width: 150, margin: 1, color: { dark: '#111111', light: '#ffffff' } });
    }
  }, [me]);

  const print = () => window.print();

  if (!me) return <div className="p-8 text-slate-500">Loading...</div>;

  if (!me.full_name) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <Panel className="p-6 border-[var(--brand-danger)]">
          <p className="font-bold mb-1 text-[var(--brand-danger)]">Profile incomplete</p>
          <p className="text-sm text-slate-600">Please complete your profile first to generate your alumni ID card.</p>
        </Panel>
      </div>
    );
  }

  const initial = me.full_name[0].toUpperCase();

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">My Alumni ID</h1>
          <p className="text-slate-500 mt-1">Use this QR code for quick event check-in</p>
        </div>
        <Button onClick={print}>
          <Printer size={18} />
          Print
        </Button>
      </div>

      <div className="flex justify-center">
        <div id="id-card" className="relative bg-[var(--brand-ink)] text-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[6px_6px_0_var(--brand-accent)] w-full max-w-sm overflow-hidden">
          <div className="h-2 bg-[var(--brand-accent)]" />
          <div className="relative z-10 p-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <div className="bg-white/10 border border-white/30 p-1.5 rounded-[var(--radius)]">
                  <GraduationCap size={16} />
                </div>
                <p className="text-[10px] uppercase tracking-widest font-semibold">Alumni ID</p>
              </div>
              <span className="bg-[var(--brand-accent)] border border-white/30 px-2.5 py-1 rounded text-[10px] font-bold">
                Batch {me.batch_year || '—'}
              </span>
            </div>

            <div className="flex justify-center mb-4">
              <div className="w-32 h-32 rounded-[var(--radius)] bg-white/10 border-2 border-white/30 overflow-hidden flex items-center justify-center">
                {me.profile_pic ? (
                  <img src={me.profile_pic} alt={me.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-extrabold text-white">{initial}</span>
                )}
              </div>
            </div>

            <div className="text-center mb-4">
              <h2 className="text-xl font-extrabold leading-tight">{me.full_name}</h2>
              <p className="text-sm opacity-80 mt-0.5">{me.course || '—'}</p>
              {me.position && me.company && (
                <p className="text-xs opacity-70 mt-2">{me.position} @ {me.company}</p>
              )}
            </div>

            <div className="flex justify-center mb-4">
              <div className="bg-white p-2.5 rounded-[var(--radius)] border-2 border-white">
                <canvas ref={canvasRef} />
              </div>
            </div>

            <div className="pt-4 border-t border-white/20 flex justify-between items-center text-[10px] uppercase tracking-widest opacity-70">
              <span>ID: {me.nfc_uid || `A${me.id}`}</span>
              <span>Scan at events</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 mt-4 print:hidden">
        Tip: Add a profile photo in your Profile page to replace the initial.
      </p>

      <style>{`
        @media print {
          aside, header, button { display: none !important; }
          body, html { background: white !important; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect 0 errors.
Run: `npm run dev`. Visit `/profile` (photo upload/remove, NFC scan button — NFC itself only works on Chrome Android, just confirm the button renders and doesn't crash elsewhere — save works). Visit `/my-id` both with and without a completed profile (incomplete-profile warning path), print preview via the Print button.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/pages/Profile.jsx alumni-frontend/src/pages/AlumniId.jsx
git commit -m "style: restyle Profile and AlumniId to brutalist system"
```

---

## Task 11: Messages, Groups, Notifications

**Files:**
- Modify: `alumni-frontend/src/pages/Messages.jsx` (full file, 224 lines)
- Modify: `alumni-frontend/src/pages/Groups.jsx` (full file, 132 lines)
- Modify: `alumni-frontend/src/pages/Notifications.jsx` (full file, 76 lines)

**Interfaces:**
- Consumes: `Panel`, `Button`, `Input`, `Badge`, `Avatar` from `../components/ui`.

- [ ] **Step 1: Rewrite `Messages.jsx`**

Keep all state/effects (lines 1–91) unchanged; replace the JSX return (lines 93–224):

```jsx
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)]">Messages</h1>
        <p className="text-slate-500 mt-1">Chat with fellow alumni</p>
      </div>

      <Panel className="overflow-hidden flex h-[calc(100vh-220px)] min-h-[500px]">
        <div className="w-80 border-r-[2.5px] border-[var(--brand-ink)] flex flex-col">
          <div className="p-4 border-b-[2.5px] border-[var(--brand-ink)]">
            <Button className="w-full" onClick={() => setSearching(!searching)}>
              <MessageSquare size={16} />
              {searching ? 'Cancel' : 'New Message'}
            </Button>
          </div>

          {searching && (
            <div className="p-3 border-b-[2.5px] border-[var(--brand-ink)]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <Input className="pl-9" placeholder="Search alumni..." value={searchQ} onChange={(e) => searchAlumni(e.target.value)} />
              </div>
              <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {alumniList.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { openThread(a.user_id); setSearching(false); setSearchQ(''); setAlumniList([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--brand-surface)] rounded-[var(--radius)] text-sm"
                  >
                    <p className="font-semibold text-[var(--brand-ink)]">{a.full_name}</p>
                    <p className="text-xs text-slate-500">{a.email}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {displayConversations.length === 0 && !searching && (
              <p className="p-6 text-center text-sm text-slate-500">No messages yet. Click "New Message" to start.</p>
            )}
            {displayConversations.map((c) => (
              <button
                key={c.other_id}
                onClick={() => openThread(c.other_id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-[var(--brand-surface)] transition-colors ${active === c.other_id ? 'bg-[var(--brand-surface)]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={c.other_name} email={c.other_email} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-[var(--brand-ink)] truncate">{c.other_name || c.other_email}</p>
                      {c.unread_count > 0 && <Badge tone="accent">{c.unread_count}</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.last_body}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b-[2.5px] border-[var(--brand-ink)]">
                <p className="font-bold text-[var(--brand-ink)]">{other?.full_name || other?.email}</p>
                <p className="text-xs text-slate-500">Batch {other?.batch_year || '—'} · {other?.course || ''}</p>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3 bg-[var(--brand-surface)]">
                {thread.map((m) => {
                  const mine = m.receiver_id === active;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md px-4 py-2.5 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] ${
                        mine ? 'bg-[var(--brand-accent)] text-white' : 'bg-white text-[var(--brand-ink)]'
                      }`}>
                        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                        <p className={`text-xs mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {active === botInfo?.id && botTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-md px-4 py-2.5 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] bg-white text-slate-400 text-sm italic">
                      IHES Assistant is typing…
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={send} className="p-4 border-t-[2.5px] border-[var(--brand-ink)] flex gap-2">
                <Input placeholder="Type a message..." value={body} onChange={(e) => setBody(e.target.value)} />
                <Button type="submit" className="px-4">
                  <Send size={18} />
                </Button>
              </form>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
```

Add to the top-of-file imports:
```jsx
import { Panel, Button, Input, Badge, Avatar } from '../components/ui';
```

- [ ] **Step 2: Rewrite `Groups.jsx`**

Keep state/effects (lines 1–48) unchanged; replace the return (lines 50–132):

```jsx
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
            <UsersRound className="text-[var(--brand-accent)]" /> Groups
          </h1>
          <p className="text-slate-500 mt-1">Batch, course, interest & mentorship communities</p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus size={16} /> New Group
        </Button>
      </div>

      {showCreate && (
        <Panel className="p-5 mb-6 grid md:grid-cols-4 gap-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input className="md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input as="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="interest">Interest</option>
            <option value="batch">Batch</option>
            <option value="course">Course</option>
            <option value="mentorship">Mentorship</option>
          </Input>
          <Button className="md:col-span-4" onClick={create}>Create</Button>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-3">
          {groups.length === 0 && <Panel className="p-6 text-slate-500">No groups yet.</Panel>}
          {groups.map((g) => (
            <Panel
              key={g.id}
              onClick={() => open(g)}
              className={`cursor-pointer p-4 transition-all ${selected?.id === g.id ? 'shadow-[4px_4px_0_var(--brand-accent)] border-[var(--brand-accent)]' : ''}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[var(--brand-ink)]">{g.name}</h3>
                <Badge tone="neutral" className="capitalize">{g.kind}</Badge>
              </div>
              {g.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description}</p>}
              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>{g.member_count} members</span>
                {user && (g.is_member ? (
                  <button onClick={(e) => { e.stopPropagation(); leave(g.id); }} className="inline-flex items-center gap-1 text-[var(--brand-danger)] hover:underline font-semibold"><LogOut size={12} /> Leave</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); join(g.id); }} className="inline-flex items-center gap-1 text-[var(--brand-accent)] hover:underline font-semibold"><LogIn size={12} /> Join</button>
                ))}
              </div>
            </Panel>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selected && <Panel className="p-8 text-center text-slate-500">Select a group to view posts.</Panel>}
          {selected && detail && (
            <Panel>
              <div className="p-5 border-b-[2.5px] border-[var(--brand-ink)]">
                <h2 className="font-display text-xl text-[var(--brand-ink)]">{detail.group.name}</h2>
                <p className="text-sm text-slate-500">{detail.members.length} members · {detail.group.kind}</p>
              </div>
              {detail.isMember && (
                <div className="p-5 border-b border-slate-200 flex gap-2">
                  <Input placeholder="Share something with the group..." value={postBody} onChange={(e) => setPostBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} />
                  <Button onClick={post} className="px-4"><Send size={16} /></Button>
                </div>
              )}
              <div className="p-5 space-y-3 max-h-[500px] overflow-y-auto">
                {posts.length === 0 && <p className="text-slate-500 text-center">No posts yet.</p>}
                {posts.map((p) => (
                  <div key={p.id} className="border-l-2 border-[var(--brand-accent)] pl-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[var(--brand-ink)]">{p.author_name || p.author_email}</span>
                      <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{p.body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
```

Add to the top-of-file imports:
```jsx
import { Panel, Button, Input, Badge } from '../components/ui';
```

- [ ] **Step 3: Rewrite `Notifications.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';
import { Panel, Button } from '../components/ui';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    const { data } = await api.get('/notifications');
    setItems(data.notifications);
    setUnread(data.unread);
  };

  const markAll = async () => {
    await api.patch('/notifications', {});
    load();
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNewNotification = () => load();
    socket.on('notification:new', onNewNotification);
    return () => socket.off('notification:new', onNewNotification);
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
            <Bell className="text-[var(--brand-accent)]" /> Notifications
          </h1>
          <p className="text-slate-500 mt-1">{unread} unread</p>
        </div>
        {unread > 0 && (
          <Button onClick={markAll} className="text-sm">
            <CheckCheck size={16} /> Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <Panel className="p-8 text-center text-slate-500">
            No notifications yet.
          </Panel>
        )}
        {items.map((n) => (
          <Link key={n.id} to={n.link || '#'}>
            <Panel className={`p-5 transition-all ${n.read_at ? '' : 'shadow-[4px_4px_0_var(--brand-accent)] border-[var(--brand-accent)]'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.read_at ? 'bg-slate-300' : 'bg-[var(--brand-accent)]'}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--brand-ink)]">{n.title}</h3>
                    <span className="text-xs text-slate-400 capitalize">{n.type}</span>
                  </div>
                  {n.body && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint` — expect 0 errors.
Run: `npm run dev`. Visit `/messages` (open a thread, send a message, search for a new recipient), `/groups` (create a group, join/leave, post in a group you're a member of), `/notifications` (mark all read, click through a notification link).

- [ ] **Step 5: Commit**

```bash
git add alumni-frontend/src/pages/Messages.jsx alumni-frontend/src/pages/Groups.jsx alumni-frontend/src/pages/Notifications.jsx
git commit -m "style: restyle Messages, Groups, Notifications to brutalist system"
```

---

## Task 12: ScanRedirect and final verification pass

**Files:**
- Modify: `alumni-frontend/src/pages/ScanRedirect.jsx` (full file, 63 lines)

**Interfaces:**
- Consumes: `Panel` from `../components/ui`.

- [ ] **Step 1: Rewrite `ScanRedirect.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Calendar } from 'lucide-react';
import { api } from '../api';
import { Panel } from '../components/ui';

export default function ScanRedirect() {
  const nav = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events').then((r) => {
      const now = new Date();
      const upcoming = r.data.events
        .filter((e) => new Date(e.event_date) >= new Date(now.getTime() - 24 * 3600 * 1000))
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
      setEvents(upcoming.length ? upcoming : r.data.events);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <QrCode className="text-[var(--brand-accent)]" /> Scan Check-in
        </h1>
        <p className="text-slate-500 mt-1">Pilia ang event nga inyo gi-man sa scanning.</p>
      </div>

      {loading && <div className="text-slate-500">Loading events...</div>}

      <div className="space-y-3">
        {events.map((ev) => (
          <Panel
            key={ev.id}
            as="button"
            onClick={() => nav(`/events/${ev.id}/checkin`)}
            className="w-full text-left p-5 hover:shadow-[4px_4px_0_var(--brand-accent)] hover:border-[var(--brand-accent)] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-3 rounded-[var(--radius)]">
                <Calendar className="text-white" size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[var(--brand-ink)]">{ev.title}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(ev.event_date).toLocaleString()} {ev.location ? `· ${ev.location}` : ''}
                </p>
              </div>
              <QrCode className="text-slate-400" size={22} />
            </div>
          </Panel>
        ))}
        {!loading && events.length === 0 && (
          <Panel className="p-8 text-center text-slate-500">
            Walay event available.
          </Panel>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Full-app verification pass**

Run: `npm run lint` from `alumni-frontend/` — expect 0 errors across the entire package.
Run: `npm run build` — expect a clean production build with no errors (this also catches any stray reference to a removed token like `--brand-primary`/`--brand-cream` that lint alone might miss in a `style={{}}` string).
Run: `npm run dev` and click through every route once more end-to-end: `/` (logged out and in), `/login`, `/register`, `/dashboard`, `/directory`, `/events` + its two sub-routes, `/announcements`, `/jobs`, `/profile`, `/my-id`, `/messages`, `/groups`, `/notifications`, `/scan`, `/admin/users`, `/admin/postings`. Confirm at both desktop and a mobile viewport width (sidebar collapses to drawer correctly) that nothing still renders the old cream/serif/gradient look — a leftover reference would show up as unstyled/transparent (missing token) rather than silently falling back to the old palette, since Task 1 removed those tokens entirely.

- [ ] **Step 3: Commit**

```bash
git add alumni-frontend/src/pages/ScanRedirect.jsx
git commit -m "style: restyle ScanRedirect to brutalist system, complete redesign rollout"
```

---

## Post-plan cleanup

Two files predate this plan and aren't part of any task above — verify at the end that they don't need touching:
- `alumni-frontend/dashboard-restyled.png` and the repo-root `dashboard-restyled.png` — these are throwaway screenshots from the exploration that led to this plan, not part of the app. Safe to delete once this plan is complete, but confirm with whoever's driving before removing anything outside `alumni-frontend/src/`.

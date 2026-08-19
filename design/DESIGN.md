# Threadbase Design System

A design system for **Threadbase** — a cross-platform suite for browsing, searching, and resuming Claude Code conversation history. Threadbase ships as an Electron desktop app, a VS Code extension, an IntelliJ plugin, a CLI, and an Expo / React Native **mobile remote-control app** for Claude Code agent sessions running on a server.

This design system captures the brand's visual DNA — the midnight canvas, the cyan-blue "thread" lines, the warm amber "live / now" highlights, the IDE-grade density — so any future surface (mobile screens, marketing slides, settings panes, onboarding flows) lands inside the same world.

---

## Sources

This system was reverse-engineered from the publicly accessible parts of the Threadbase monorepo. **Treat link access as not assumed for the reader.**

- Root repo: `github.com/RonenMars/threadbase` — README, CLAUDE.md, IMPLEMENTATION-GUIDELINES.md, feature-comparison.md, status-mobile.md
- App icons: `threadbase/app-icon/threadbase-icon.svg` and `threadbase-icon-chat.svg` — copied into `assets/`
- The `mobile/` submodule (`RonenMars/threadbase-mobile`, private) and most app submodules (`electron`, `vscode`, `intellij`, `landing-page`) were **not directly readable** from this environment. The status doc (`status-mobile.md`) was the primary written reference for the mobile app's structure and feature set.

> ⚠️ **Caveat for the user.** Because the mobile, electron, vscode, intellij, and landing-page submodules were inaccessible, the colors/typography/spacing here are derived from the two SVG icons + Tailwind/NativeWind conventions called out in the docs. Any concrete tokens (exact hex values inside `theme.ts`, Tailwind `tailwind.config.js`, real font choices) should be reconciled against the source if/when the repos become accessible. Sections flagged "📌 derived" below are educated extrapolations.

---

## Index — what's where

| Path | What |
|---|---|
| `README.md` | This file. Brand overview, content fundamentals, visual foundations, iconography. |
| `SKILL.md` | Cross-compatible Agent Skill manifest — drop the folder into `.claude/skills/threadbase-design/` to use as a Claude Code skill. |
| `colors_and_type.css` | Single source of truth for color + typography CSS variables. Import it on every page. |
| `assets/` | Brand SVG icons (logo + "chat" mark variant). Copy from here, never link cross-project. |
| `preview/` | Small HTML cards that render in the Design System tab (palettes, type specimens, components, motifs). |
| `ui_kits/mobile/` | High-fidelity recreation of the Threadbase mobile (Expo / React Native) app. JSX components + an interactive `index.html`. |
| `slides/` | _Not included._ No deck template was provided. |

---

## Brand at a glance

Threadbase sits between two worlds: **the developer's terminal** (where Claude Code actually runs) and **a thoughtful, almost archival reading surface** (where past conversations get browsed, searched, and resumed). The brand splits the difference:

- **Dark, IDE-grade** — near-black canvas (`#070b11`), 32-px grid pattern, hairline dividers in deep navy.
- **Two-color signal** — cyan-blue (`#63b3ff`) is the "thread" / data / past, amber (`#f08a24`) is "live / now / running". Almost everything else is greyscale.
- **Soft glow** — both accent colors carry a Gaussian-blur halo when they signify state. Glow is the brand's primary expressive move.
- **No decorative gradients, no purple, no emoji-as-UI.** Color carries meaning; everything else is grey.

---

## CONTENT FUNDAMENTALS

### Voice — confident developer-tooling

Threadbase writes the way a senior engineer would write internal docs: dense, factual, lightly opinionated, occasionally dry. It assumes the reader knows what a JSONL file is and what `~/.claude/` contains. It does not over-explain.

- **Person.** Mostly third-person product voice ("Threadbase reads the same local JSONL files…", "All platforms enforce the same layered boundary…"). Second-person ("you") only in setup steps and CTAs. First-person plural ("we") is **avoided** — this is a tool, not a team blog.
- **Tone.** Plain, declarative, technical. No marketing throat-clearing. Sentences favor verbs over adjectives.
- **Casing.** Sentence case in UI ("Resume in terminal", not "Resume In Terminal"). Title Case is reserved for proper nouns and product names ("Claude Code", "VS Code", "IntelliJ Plugin"). UPPER CASE shows up only for status states (LIVE, RUNNING, FAILED) and lane labels in the kanban.
- **Punctuation.** Em-dashes are normal. Colons introduce specifics. Trailing periods on UI strings are dropped on buttons and labels, kept in body copy.
- **Code voice.** Backtick everything technical: `pnpm install`, `~/.claude/`, `feat(scanner): …`. Conventional Commits (`feat:`, `fix:`, `chore:`) are part of the brand voice.

### What it does, what it doesn't

✅ **Used:**
- Concrete platform/tech names: "Electron", "FlexSearch 0.7", "Lucene 9.x", "node-pty", "JCEF", "xterm.js", "Zustand", "React Query".
- Crisp feature framing: "Two-tier indexing", "Embedded xterm.js terminal", "Speed search overlay".
- Honest scope language: "Tier 1 / Tier 2 / Tier 3", "WIP", "deprecated", "v0.1.0", "Milestone 2".
- Quiet attribution: "MIT — not affiliated with Anthropic. Claude Code is a product of Anthropic." (Always present, never hidden.)

🚫 **Avoided:**
- Hype words: _seamless_, _powerful_, _supercharge_, _revolutionize_, _AI-powered_ (ironic given the subject — but the product *uses* AI history, it doesn't *sell* AI).
- Emoji in UI copy or marketing prose. The product uses an emoji **picker** (for user-defined profile avatars) but the system itself never speaks in emoji.
- Exclamation marks. There are essentially zero across the docs.
- Filler intros ("In today's fast-moving world…").

### Example phrases (lifted from the source)

- _"A cross-platform suite for browsing, searching, and resuming your Claude Code conversation history."_
- _"All platforms enforce the same layered boundary: pure domain logic → platform adapter → UI."_
- _"Sort sessions by recency, message count, or alphabetically from the terminal."_

### Marketing transform — feature → benefit

The IMPLEMENTATION-GUIDELINES doc spells this out and we follow it:

| Feature language (avoid) | Benefit language (use) |
|---|---|
| _Added --sort flag to tb-streamer list_ | _Sort sessions by recency, message count, or alphabetically from the terminal_ |
| _Implemented TaskToolCard component_ | _Task agent cards show AI planning context in-line with the conversation_ |

---

## VISUAL FOUNDATIONS

### The icon is the brand

Both app icons share one diagram: a **vertical "thread spine"** running down the left, with **horizontal capsule rows** branching off it. The top three capsules are cyan-blue (past messages / threads); the bottom one is amber (the active / live row). The whole thing sits on a dark grid. Every screen in this system is allowed — encouraged — to echo that diagram.

### Color

| Token | Hex | Role |
|---|---|---|
| `--tb-ink-1` | `#070b11` | Canvas. The base everything sits on. |
| `--tb-ink-2` | `#0b1220` | Card surface. |
| `--tb-ink-5` | `#1a2d47` | Hairlines, the 32-px grid. |
| `--tb-blue-400` | `#63b3ff` | Brand blue — threads, links, primary actions, focus. |
| `--tb-amber-400` | `#f08a24` | Brand amber — live / running / now. |
| `--tb-success-400` | `#4ade80` | Completed. |
| `--tb-danger-400` | `#ff6b6b` | Failed / errors / removed-line bars. |

**Rules.**
- One accent per surface. If amber is on screen, it means "this is the live one." Don't decorate with it.
- Never put blue on amber or vice versa as adjacent fills — they always sit on ink.
- Light-text-on-dark-surface only. The system has no light mode.
- Tints below 12% opacity over ink read as "soft" backgrounds for chips and lane headers.

### Typography 📌 derived

Real type stack on the source side is `font-sans` from Tailwind / NativeWind defaults — i.e. system sans plus emoji fallbacks. We lock to **Inter** (sans / display) and **JetBrains Mono** (code, terminal, kbd, message metadata) as a deliberate, brand-flattering substitute that matches the IDE aesthetic.

> 🔁 **Substitution flagged.** If the codebase ships a different sans (e.g. `SF Pro`, `Geist`, `Söhne`), drop the `.ttf`/`.woff2` into `fonts/` and update `colors_and_type.css`.

Scale (see `colors_and_type.css` for the full set):

| Role | Size / line-height | Family / weight |
|---|---|---|
| Display | 60 / 64 | Inter Semibold, tight tracking |
| H1 | 36 / 44 | Inter Semibold, tight tracking |
| H2 | 24 / 32 | Inter Semibold |
| H3 | 18 / 26 | Inter Semibold |
| Body | 14 / 20 | Inter Regular |
| Body sm | 13 / 18 | Inter Regular |
| Meta | 12 / 16 | Inter Medium, `--color-fg-subtle` |
| Eyebrow | 12 / 16 | Inter Semibold, UPPER, 0.08em tracking |
| Code / kbd / terminal | 13 / 18 | JetBrains Mono |

### Spacing

A 4-px base. Effective rhythm: **4 / 8 / 12 / 16 / 24 / 32 / 48 / 64**. Card interiors land on 16 or 20; section gutters on 24 or 32. Mobile screen padding is 16; desktop sidebar item padding is 12 / 8.

### Backgrounds

- **Canvas:** flat `--tb-ink-1`.
- **Marketing / hero / app-icon backgrounds:** the canvas + the 32-px grid (`--grid-bg` in CSS) + an optional radial glow centered slightly above middle (`bgGlow`: from `#0f1e35` core to `#070b11` edge).
- **Cards:** `--tb-ink-2` with a 1-px `--tb-ink-5` hairline. No drop shadows by default.
- **No imagery / illustrations / photos.** The product is data; the brand is structural. If imagery is needed, mock it as a placeholder.
- **No bluish-purple gradients. No textures. No grain.** The grid is the only repeating pattern.

### Animation

- Standard easing: `cubic-bezier(0.2, 0.7, 0.2, 1)` (`--ease-standard`) for almost everything.
- Out (entry): `cubic-bezier(0.16, 1, 0.3, 1)` for things appearing.
- Durations: 120 / 180 / 280 ms. Hover transitions stay at 120 ms.
- **No bounces.** Nothing overshoots. This is a tool, not a toy.
- Live / running indicators **pulse** the amber glow (opacity 0.4 → 1 → 0.4 over ~1.6 s) — that pulse is a brand signature.
- Streamed terminal output **does not animate** beyond the cursor blink (1 s, hard step). Don't fade in lines.

### Hover, focus, press

- **Hover** on bg surfaces: bump from `--tb-ink-2` → `--tb-ink-3`. On accent fills: shift to `--tb-blue-300`. On text-only links: underline + `--tb-blue-300`.
- **Focus:** 2 px outline using `--color-focus-ring` (rgba blue 0.55), 2 px offset, no rounding override.
- **Press:** color shifts to `--tb-blue-500` (one step darker). Buttons translate **0 px** (no scale-down). Cards shrink 1 px scale only when explicitly tappable on mobile.
- **Disabled:** `--color-fg-disabled` text on unchanged surface, `cursor: not-allowed`.

### Borders, dividers, hairlines

- Default border: 1 px `--color-border` (`--tb-ink-5`).
- Dividers between rows in lists: 1 px `--color-divider` (8% blue tint over ink). The blue tint is what makes them feel "Threadbase" rather than generic.
- The vertical **thread spine** in lists / chats / timelines is 2-3 px wide, `--tb-ink-7`, optionally with a single accent dot on the active row.

### Shadows & glows

| Use | Token |
|---|---|
| Resting card on dark canvas | `--shadow-md` (subtle, mostly inset hairline) |
| Floating sheet / popover | `--shadow-lg` |
| Active state on a brand-blue element | `--shadow-glow-blue` |
| Live / running / now indicator | `--shadow-glow-amber` |

The glow tokens are how the icons feel — **never** a hand-rolled `filter: drop-shadow(...)` — go through the token.

### Transparency, blur

- Sheet overlays use `rgba(4,7,11,0.72)` + `backdrop-filter: blur(12px)`.
- Bottom sheets and command palettes use the same.
- Inline content **does not** use translucency. No frosted cards, no glassmorphism beyond modal scrims.

### Color vibe of imagery

Cool, midnight, tinted slightly cyan. If a photo is ever introduced, run it through a `mix-blend-mode: luminosity` over the canvas so it doesn't fight the palette. (This is rare — the brand prefers diagrams to photos.)

### Corner radii

| Use | Radius |
|---|---|
| Inline chip / kbd | 4 / 6 px |
| Button, input, card | 8 px |
| Larger card / sheet | 12–16 px |
| Bottom sheet top edge | 20 px |
| Pill (status badge, lane chip) | 999 px |
| **App icon** | 22.5% (iOS-style superellipse) |

### Cards

A "card" in Threadbase is: `--tb-ink-2` background, 1 px `--tb-ink-5` border, `--radius-lg` (12 px) corners, no drop shadow at rest, optional 1-px inset top highlight at 4-5% blue. On hover, raise to `--tb-ink-3` and brighten the border one step.

### Layout rules (fixed elements)

- **Mobile.** 16-px screen gutter. Top safe area + 12-px header. Bottom tab bar 56 px tall, full-bleed `--tb-ink-2`, top hairline only. Bottom-sheet handle is 36×4 px, `--tb-ink-6`, 8 px above sheet content.
- **Desktop.** Resizable left sidebar (240–800 px, persisted). Top toolbar height 44 px, `--tb-ink-4`. Conversation viewer max content width **none** — code blocks need the room.

---

## ICONOGRAPHY

Threadbase has a **brand mark** (and a "chat" variant) that lives in `assets/`:

- `assets/threadbase-icon.svg` — primary mark. Vertical thread spine, three blue capsule rows, one amber row at the bottom.
- `assets/threadbase-icon-chat.svg` — variant that draws message bubbles instead of capsules. Use this for chat-specific surfaces (the terminal screen, conversation viewer empty state, etc).

Both are 512×512 with a 96-px corner radius (≈19% — close to the iOS superellipse target but rendered as `rx`).

### UI icons 📌 derived (CDN substitution flagged)

The Threadbase codebases (Tailwind / NativeWind on the mobile and electron sides) most likely lean on **Lucide** or **Heroicons** — both are stroke-based, 24×24 with a 1.5-2 px stroke, which match the icon aesthetic of the brand mark (thin, geometric, evenly-weighted).

> 🔁 **Substitution flagged.** Until the source codebases are readable, this system links **Lucide React** from CDN as the icon font. The closest match for stroke weight, line caps, and geometric clarity. If the real codebase uses Heroicons (or a custom set), swap the CDN line.

```html
<!-- in HTML cards / kits -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
```

```jsx
// in React components
import { MessageSquare, Search, Terminal, GitBranch } from 'lucide-react';
```

### Usage

- **Always** stroke icons at the same weight as the surrounding type (1.5 px next to body 14, 2 px next to h2+).
- Use brand blue for **interactive** icon controls; use `--color-fg-muted` for non-interactive metadata icons.
- Use amber-stroke icons **only** to mean "live" / "running" / "now". Never decorative.
- Status bullets (LIVE, RUNNING, FAILED, COMPLETED) are filled circles 8 px, NOT icons.
- **No emoji as icons** — except inside the user-controlled "profile emoji" feature, where the user picks one to label themselves. There the emoji is content, not chrome.
- **No PNGs.** Everything is SVG. Don't rasterize.
- Unicode arrows (`→`, `↗`) are fine in body copy but not as primary controls.

---

## Component cheatsheet

The richer reference is in `preview/` and `ui_kits/mobile/`. Inline summary:

- **Button** — 8-px radius, 36 px tall (sm) / 40 px (md) / 44 px (lg, hit target on mobile). Primary: amber fill on dark, OR blue fill on dark depending on whether it's a "live action" (start, run, resume) vs "navigate" (open, view). Secondary: `--tb-ink-3` fill, 1 px `--tb-ink-6` border. Ghost: text only, blue.
- **Input** — `--tb-ink-2` fill, 1 px `--tb-ink-5` border, focus = 2 px focus ring. Placeholder `--color-fg-disabled`. 40 px tall.
- **Status pill** — `--radius-pill`, 6-px H padding, 2-px V padding, 11/14 type, UPPER, 0.08em tracking. Background = 12% accent over ink; text = full accent.
- **Lane header (Kanban)** — eyebrow type + count badge. Coloring matches lane semantic.
- **Conversation row** — 12-px V padding, 16-px H. Title + project + timestamp + chips on right. Live chip is amber-pulsing.
- **Tool result card** — 12-px radius, monospace content, header row with tool name (mono) + status pill.

---

## License & attribution

This design system describes the look and feel of the Threadbase open-source project (MIT). It is **not** a Claude or Anthropic brand resource; the README explicitly notes "MIT — not affiliated with Anthropic. Claude Code is a product of Anthropic."

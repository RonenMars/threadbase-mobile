# Prompt — add /privacy page to threadbase.sh

Use this prompt in a fresh Claude Code session opened in `~/Desktop/dev/ai-tools/threadbase/landing-page` (the Next.js source for https://threadbase.sh).

---

## Why this exists

The Threadbase iOS app needs a Privacy Policy URL to submit to the App Store. The canonical source of truth is the **Privacy** section of `~/Desktop/dev/ai-tools/tb-mobile/README.md` — that text is derived from a code audit of what the app actually does, so do not invent new claims.

The chosen URL is `https://threadbase.sh/privacy-policy`. App Store Connect will be set to point at that URL once the page is live.

---

## What to do

1. **Read the source content** at `~/Desktop/dev/ai-tools/tb-mobile/README.md`, the `## Privacy` section between `## Push Notifications` and `## License`. Use it as the literal source of truth — do not paraphrase the data-table rows, do not soften the "we do not collect" wording, do not add boilerplate "we may share with affiliates" language that is not true.

2. **Add `app/privacy/page.tsx`** as a server component. Match the existing landing page's typography/spacing/dark-mode treatment — check `app/page.tsx`, `app/layout.tsx`, and `globals.css` first so the new page feels native. Reuse existing primitives in `components/` rather than adding new dependencies.

3. **Page structure** (port the README sections, do not add new ones):

   - H1: `Privacy`
   - Lede sentence: same as README ("Threadbase is a thin client for self-hosted Threadbase streamers…")
   - "What stays on your device" — bulleted list
   - "What leaves your device, and where it goes" — render the README table as an HTML table (Tailwind / shadcn `<Table>` if already used elsewhere in the codebase)
   - "What we do not collect" — paragraph
   - "Permissions used" — second table
   - "Your control" — bulleted list
   - Effective date footer: `Last updated: <today YYYY-MM-DD>` and contact `ronenmars@gmail.com`

4. **Metadata** — export a `metadata` const so the page has its own `<title>` (`Privacy — Threadbase`) and `description` ("How the Threadbase iOS and macOS apps handle your data."). Verify `app/layout.tsx` does not already set a conflicting title template, or use the existing template if there is one.

5. **Footer / sitemap** — if the landing page has a footer with legal links, add `Privacy` next to it. If there is no footer link slot, skip this step (don't invent a footer).

6. **Verify**:
   - `npm run build` succeeds
   - `npm run lint` / `tsc --noEmit` are clean
   - Visit `/privacy` in `npm run dev`, check both light and dark themes, confirm the data-handling table is readable on mobile
   - Run any existing tests (`vitest` based on the repo's `vitest.config.ts`)

7. **Do not deploy.** Stop after committing. The user will run their own deploy (Vercel/whatever the existing pipeline is) and confirm the live URL.

---

## Output expectations

- One new file: `app/privacy/page.tsx`
- Possibly one tiny edit to a footer component if a legal-links slot already exists
- One commit, conventional-commit title (e.g. `feat(privacy): add /privacy page for App Store submission`)
- No new npm dependencies unless absolutely required to match existing styling
- No marketing copy creep, no SEO keyword stuffing

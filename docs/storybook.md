# Storybook (laptop, Chrome, Vite)

`npm run storybook` opens classic Storybook at `http://localhost:6006` using
`@storybook/react-native-web-vite`. It mounts one component at a time in a browser
tab — no Expo Router, no notification/SecureStore/biometric bootstrap, no WebSocket.
Config lives in `.storybook/` (`main.ts`, `preview.tsx`).

This is **not** the same thing as `npx expo start --web`, which boots the full app
(`app/_layout.tsx` and everything it hydrates) inside the Expo web target. Storybook
here is a component catalog for isolated dev/design work on a laptop; Expo Web is a
separate, unrelated effort tracked in `docs/expo-web-support.md`.

On-device Storybook (`@storybook/react-native`, Metro `withStorybook`, an
`app/storybook.tsx` on-device UI) is **out of scope**. The same `*.stories.tsx` files
next to each component can feed that later without changes.

## Run it

```bash
npm run storybook          # dev server, http://localhost:6006
npm run storybook:build    # static build → storybook-static/
```

## Adding a story

Co-locate `Component.stories.tsx` next to `Component.tsx`, CSF3 style. Stories run
through the same `ThemeProvider` (`contexts/ThemeContext.tsx`) as the app — a global
theme toolbar in the Storybook UI switches between `dark`, `light`, `nord`, and
`catppuccin` by writing directly to the real `useSettingsStore` (no mocking layer).

Don't story screens, navigation, camera, SecureStore, biometrics, notifications, or
the bottom sheet — those need the full app shell and are unrelated to this catalog.

## Story coverage is enforced, not optional

`scripts/git-hooks/pre-commit` runs `scripts/check-story-coverage.js` on every commit:

- **New `components/**/*.tsx` file, no matching `*.stories.tsx` staged → the commit is
  blocked.** Add the story, or — for the rare component that genuinely can't be storied
  (native-API-only, a screen-sized composition) — list its path in
  `scripts/git-hooks/story-exempt.txt` with a reason.
- **Modified existing component, no story → a warning, not a block.** Add one anyway
  when it's genuinely small; the hook can't judge "small effort", so that call is
  whoever's making the change, not a reason to skip it by default.

Run the check by hand with `node scripts/check-story-coverage.js` against whatever's
currently staged.

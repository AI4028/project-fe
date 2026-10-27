# Frontend development

- This repository is a React Native + Expo app, using TypeScript and Expo Router.
- All routes belong in `src/app`. Shared components, providers, hooks and helpers
  belong outside that directory. Keep navigation visible in the directory tree.
- Use the installed React Native Reusables primitives in `src/components/ui`.
  Extend them deliberately instead of making new ad hoc buttons or modals.
  Use `src/lib/theme.ts` design tokens and preserve high contrast, font scaling,
  minimum 48-point touch targets and Korean accessibility labels.
- Start `pnpm check:watch` before editing. Keep it running throughout edits: it
  automatically runs `pnpm tsc --noEmit` and the full unit suite on each settled
  file change, and reruns if a change arrives during checks. `pnpm start`/`pnpm dev`
  start this feedback loop alongside Metro. Check `.checks/latest.json` for the
  latest results; `current` and `passed` must both be true. If a watcher cannot
  run, execute `pnpm verify` after every edit before continuing.
- Run `pnpm verify`, `pnpm exec expo install --check`, and `pnpm export:all`
  before handing off a migration or a change to platform dependencies.
- Keep API contracts in `src/lib/api.ts` and `src/lib/types.ts`. Backend prices
  are authoritative. Never create fake successful sessions/orders on API failure.
- Phone tokens and kiosk keys belong in `src/lib/storage.ts`, scoped to the API
  origin. Never put a kiosk secret into a public Expo environment variable or QR.
- Voice recognition needs an Expo development build. Do not claim Expo Go or
  native hardware was tested based only on a successful JS export.
- Work on `feature/*` branches based on `develop`. Do not merge to `develop` or
  `main` unless requested. Preserve unrelated local changes.

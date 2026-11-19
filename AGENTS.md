# Agent rules

React Native + Expo app, TypeScript, Expo Router.

## Start and finish

- **Before you start:** read [docs/agent-log.md](docs/agent-log.md).
- **Before you finish:** add an entry there for anything that took more than one try.
- Name branches and commits as in [docs/conventions.md](docs/conventions.md).
  Branch from `develop`. Never merge to `develop` or `main` unless asked.
- Preserve unrelated local changes.

## Structure

- Routes live only in `src/app`. Shared components, providers, hooks and helpers live
  outside it. Keep navigation visible in the directory tree.
- Use the React Native Reusables primitives in `src/components/ui`. Extend them
  deliberately; don't make ad hoc buttons or modals.
- Use the design tokens in `src/lib/theme.ts`. Keep high contrast, font scaling,
  48-point minimum touch targets and Korean accessibility labels.

## Checks

- Run `pnpm check:watch` before editing and keep it running. It runs `tsc --noEmit`
  and the full test suite on each settled change. `pnpm start` / `pnpm dev` start it
  alongside Metro.
- Read `.checks/latest.json`: `current` and `passed` must both be `true`.
  If the watcher can't run, run `pnpm verify` after every edit.
- For dependency, native config or migration changes, also run `pnpm deps:check`
  and `pnpm export:all` before handing off.

## API and secrets

- API contracts live in `src/lib/api.ts` and `src/lib/types.ts`. Backend prices are
  authoritative. Never fake a successful session or order when the API fails.
- Phone tokens and kiosk keys live in `src/lib/storage.ts`, scoped to the API origin.
  Never put a kiosk secret in a public `EXPO_PUBLIC_*` variable or a QR code.

## Voice and hardware

- Speech recognition needs a development build. A successful JS export does not
  mean Expo Go or native hardware was tested; don't claim it was.

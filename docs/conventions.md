# Conventions

## Branches

```text
<type>/<what-it-does>
```

| Type       | Use for                    | Example                   |
| ---------- | -------------------------- | ------------------------- |
| `feature/` | a new screen or behavior   | `feature/kakao-map`       |
| `fix/`     | a bug                      | `fix/cart-total-rounding` |
| `chore/`   | deps, config, CI, clean-up | `chore/expo-sdk-patch`    |
| `docs/`    | docs only                  | `docs/setup-guide`        |

- lowercase, kebab-case, 2–4 words
- branch from `develop`, one topic per branch
- delete the branch after it merges

```text
feature/* ──PR──▶ develop ──release PR──▶ main
```

## Commits

```text
<type>: <what changed>
```

Types: `feat` `fix` `refactor` `test` `docs` `chore`

- imperative and lowercase: `fix: keep cart when session expires`
- under 72 characters, no period
- one logical change per commit; dependency bumps get their own commit
- add a body only to explain **why**

## Pull requests

- open a draft PR early; CI runs on every PR
- title follows the commit format
- merge with **Create a merge commit** so the small commits stay readable
- green checks before merge; an "Expo packages are behind" warning means run `pnpm deps:fix`

## Files

| Thing             | Style                       | Example                         |
| ----------------- | --------------------------- | ------------------------------- |
| files and folders | kebab-case                  | `voice-controls.tsx`            |
| route params      | Expo Router                 | `orders/[orderId].tsx`          |
| platform variants | `.web` / `.native` suffix   | `store-map.web.tsx`             |
| components        | PascalCase named export     | `export function VoiceControls` |
| hooks             | `use-*.ts`, `useThing`      | `use-location.ts`               |
| tests             | `tests/<module>.test.ts(x)` | `tests/cart.test.ts`            |
| assets            | kebab-case                  | `assets/menu/cafe-latte.jpg`    |

- import across folders with `@/`, within a folder with `./`
- routes only in `src/app`; everything shared lives outside it
- UI text and accessibility labels in Korean

## Before you push

```sh
pnpm verify           # typecheck + tests
pnpm deps:check       # only when you touched dependencies
pnpm export:all       # only when you touched dependencies or native config
```

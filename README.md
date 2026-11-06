<div align="center">

# 갈지도 · Galjido

**Accessible kiosk ordering by voice and touch, on iOS, Android and web.**

[![Checks](https://github.com/AI4028/project-fe/actions/workflows/checks.yml/badge.svg?branch=develop)](https://github.com/AI4028/project-fe/actions/workflows/checks.yml)
![Expo SDK 58](https://img.shields.io/badge/Expo-SDK_58-000020?logo=expo)
![React Native 0.88](https://img.shields.io/badge/React_Native-0.88-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)

</div>

Customers find an accessible store, pair with its kiosk and order by voice or touch.
Staff manage orders from the kiosk screen. Backend: [project-be](https://github.com/AI4028/project-be).

## Quick start

```sh
nvm use && corepack enable
pnpm install --frozen-lockfile
cp .env.example .env        # set EXPO_PUBLIC_API_URL
pnpm start                  # Metro + check watcher, press w for web
```

> Voice ordering needs a **development build** (`pnpm ios` / `pnpm android`).
> Expo Go runs the touch flow only.

## Scripts

| Command            | What it does                                   |
| ------------------ | ---------------------------------------------- |
| `pnpm start`       | Metro and the check watcher together           |
| `pnpm verify`      | Typecheck and tests, the same as CI            |
| `pnpm check:watch` | Re-runs checks on save → `.checks/latest.json` |
| `pnpm deps:fix`    | Aligns Expo packages with the installed SDK    |
| `pnpm export:all`  | Builds web, Android and iOS bundles            |
| `pnpm format`      | Formats with Prettier                          |

## Layout

```text
src/
  app/          routes (Expo Router), one file per screen
  components/   shared components; ui/ holds React Native Reusables
  providers/    session, cart and order state
  lib/          API client, types, storage, theme tokens
tests/          Jest tests, one file per module
scripts/        dev tooling
assets/         images
docs/           guides and team rules
```

## Docs

| Doc                                | Read it when                              |
| ---------------------------------- | ----------------------------------------- |
| [Setup](docs/setup.md)             | configuring env, maps, demo mode, deploys |
| [App flow](docs/app-flow.md)       | you need the screens and voice commands   |
| [Conventions](docs/conventions.md) | naming a branch, commit or file           |
| [Agent log](docs/agent-log.md)     | before you start; something broke before  |
| [AGENTS.md](AGENTS.md)             | you run a coding agent here               |

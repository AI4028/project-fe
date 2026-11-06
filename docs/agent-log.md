# Agent log

Things that cost us a retry, so nobody pays for them twice.

**Read it** before you start. **Add to it** before you finish, when something failed
in a way the next person or agent could hit again. Skip typos and one-off slips.

## How to write an entry

Newest first, four lines, no stories:

```md
### YYYY-MM-DD · short title

- **Hit:** what failed, with the exact error
- **Why:** the root cause
- **Fix:** what worked
- **Rule:** what to do next time
```

- If a rule should always apply, also add it to [AGENTS.md](../AGENTS.md).
- If an entry stops being true (tool upgraded, code removed), delete it.

---

### 2026-11-06 · Tools rewrite `tsconfig.json`

- **Hit:** removed redundant `include` entries; the next `expo export` put `nativewind-env.d.ts` back and reformatted the file.
- **Why:** NativeWind's Metro plugin makes sure its type file is listed.
- **Fix:** restored the original file.
- **Rule:** leave tool-managed entries alone. After editing `tsconfig.json`, run an export and check `git diff`.

### 2026-11-06 · Prettier flags every file on Windows

- **Hit:** `pnpm format:check` reported 52 files with style issues.
- **Why:** `core.autocrlf=true` checks files out with CRLF; Prettier expects LF.
- **Fix:** `.gitattributes` forces LF. Old clones, with a clean tree only: `git rm -r --cached . -q && git reset --hard`.
- **Rule:** before mass-formatting, run `prettier --check --end-of-line auto` to see real issues.

### 2026-11-06 · Stale peers survive `pnpm update`

- **Hit:** `unmet peer @expo/metro-runtime@^58.0.17: found 58.0.15`. `pnpm update <pkg>` bumped every direct dependency instead of fixing it.
- **Why:** auto-installed peers stay pinned in `pnpm-lock.yaml`.
- **Fix:** `pnpm add -D <pkg>@<version>`, then `pnpm remove <pkg>`. The peer stays locked at the new version.
- **Rule:** after any dependency command, check `git diff package.json` before going on.

### 2026-11-06 · CI red on `expo install --check`

- **Hit:** PR #4 failed CI with "Found outdated dependencies"; typecheck and tests were green.
- **Why:** Expo released SDK 58 patches after the branch was cut. The check compares against the latest patch, so it fails without any code change.
- **Fix:** `pnpm deps:fix`, then commit `package.json` and `pnpm-lock.yaml`. CI now reports this as a warning.
- **Rule:** when CI warns "Expo packages are behind", bump on a `chore/` branch, not inside a feature.

### 2026-11-03 · Every route crashes in Expo Go

- **Hit:** importing `expo-speech-recognition` threw in Expo Go.
- **Why:** Expo Go has no `ExpoSpeechRecognition` native module.
- **Fix:** load it only when `requireOptionalNativeModule` finds it; otherwise show touch-only controls.
- **Rule:** guard every native-only module the same way. Test voice in a development build only.

### 2026-10-27 · CI can't find `global.css` types

- **Hit:** `TS2882: Cannot find module or type declarations for side-effect import of '../../global.css'`, on CI only.
- **Why:** `expo-env.d.ts` is generated and git-ignored, so a fresh clone has no Expo types.
- **Fix:** add `"expo/types"` to `types` in `tsconfig.json`.
- **Rule:** CI must not depend on generated or ignored files. When unsure, test from a clean clone.

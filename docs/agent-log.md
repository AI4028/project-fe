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

### 2026-11-12 · Lucide's native export is ESM in Jest

- **Hit:** voice control tests failed with `Must use import to load ES Module` after adding Lucide icons.
- **Why:** the native export condition selects `.mjs`, which the existing Jest preset does not transform.
- **Fix:** mapped `lucide-react-native` to its supplied CommonJS build in Jest only; all 24 tests pass.
- **Rule:** use the package's CommonJS build for this Jest configuration, while Metro keeps the native export.

### 2026-11-12 · Windows hoisted dependency install needs repair

- **Hit:** `pnpm add` failed with `ERR_PNPM_ENOENT` while scanning `node_modules/*_tmp_*/node_modules` twice.
- **Why:** the existing hoisted dependency tree could not be reconciled incrementally after pulling updates.
- **Fix:** stopped Metro, retained the intended manifest/lockfile change, and ran `pnpm install --frozen-lockfile --offline --force` successfully.
- **Rule:** check the manifest diff after a failed add; repair the generated install from the lockfile before retrying builds.

### 2026-11-12 · Refresh generated routes after pulling new screens

- **Hit:** typecheck rejected `/help`, `/leave`, and `/review` even though their route files existed.
- **Why:** `.expo/types/router.d.ts` still described the pre-pull route tree.
- **Fix:** started Expo, which regenerated route types; the next watcher pass succeeded.
- **Rule:** start Expo after pulling route changes; do not patch the generated declarations by hand.

### 2026-11-12 · Check watcher can stop on a Windows file lock

- **Hit:** the watcher exited with `EPERM` when renaming `.checks/latest.tmp` to `.checks/latest.json`.
- **Why:** Windows temporarily denied replacement of the result file during concurrent tool activity.
- **Fix:** restarted `pnpm check:watch` and waited for a completed pass before reading the result.
- **Rule:** verify the watcher process is alive if the result remains `running`; a stale result is not a passing check.

### 2026-11-12 · Public Notion page ID needs UUID format

- **Hit:** `loadPageChunk` returned HTTP 400 with `Page ID is not valid` for the 32-character ID in a shared link.
- **Why:** the endpoint requires the ID in dashed UUID format.
- **Fix:** formatted the ID as `400e09a1-2c88-808a-8e51-d8c4bc1ecb46`; the anonymous request returned HTTP 200.
- **Rule:** format Notion page IDs as dashed UUIDs before querying public page chunks.

### 2026-11-06 · Async test race needs settled assertions

- **Hit:** new race test asserted `storeId` too early and used `act(async () => ...)` without awaiting, causing a warning and a flaky failure.
- **Why:** the delayed preview request and the connect flow settle in separate async steps, so immediate assertions can read stale state.
- **Fix:** started the preview request without `act`, then used `waitFor` around post-connect and post-settle assertions.
- **Rule:** for concurrent promise tests, avoid un-awaited `act` calls and assert state only after `waitFor` confirms updates.

### 2026-11-06 · Fresh clone has no pnpm deps

- **Hit:** `pnpm check:watch` failed with `pnpm: command not found`; typecheck/test then failed because `node_modules` was missing.
- **Why:** this runner clone started without dependencies installed, and pnpm must be invoked via Corepack here.
- **Fix:** ran `corepack pnpm install --frozen-lockfile`, then used `corepack pnpm ...` for checks.
- **Rule:** if pnpm commands fail in CI runners, use Corepack and install deps before running project scripts.

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

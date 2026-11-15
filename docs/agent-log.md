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

### 2026-11-15 · Station identifiers repeat across railway lines

- **Hit:** the imported station table produced three duplicate voice-guide result identifiers when keyed only by station ID.
- **Why:** station identifiers are not globally unique across railway lines.
- **Fix:** scoped result identifiers by station ID and line, and added a uniqueness assertion to the backend tests.
- **Rule:** use source-specific composite keys for public station records rather than assuming global ID uniqueness.

### 2026-11-15 · Dataset checksums require byte-preserving Git attributes

- **Hit:** Git warned that a pinned upstream JSON dataset would be converted from LF to CRLF on Windows checkout.
- **Why:** backend `core.autocrlf` can change imported data bytes and invalidate the snapshot manifest checksums.
- **Fix:** marked backend accessibility JSON datasets `-text` in `.gitattributes` before finalizing the feature commit.
- **Rule:** preserve original bytes for datasets whose integrity is tracked by SHA-256 manifests.

### 2026-11-15 · Feedback imports native dialog animation in screen tests

- **Hit:** accessibility screen tests failed on `loadUnpackersWithCode` while importing `react-native-worklets` through the shared feedback module.
- **Why:** the feedback module also exports animated dialogs, even when the screen only needs its plain error view.
- **Fix:** mocked the feedback error boundary for the record-rendering test, keeping the real text, cards and buttons under test.
- **Rule:** isolate unrelated native dialog/animation exports in focused screen tests rather than simulating native worklets.

### 2026-11-15 · Duplicate check watchers share a result file

- **Hit:** concurrent watchers failed with `ENOENT` or `EPERM` replacing `.checks/latest.tmp`, leaving a stale running result.
- **Why:** more than one watcher writes the same temporary and result filenames across continued sessions.
- **Fix:** stopped the duplicate processes, kept the passing standalone verification, and restarted one watcher for a fresh final pass.
- **Rule:** check for an existing `scripts/check-watch.mjs` process before starting another; keep only one per checkout.

### 2026-11-15 · Source ZIP inventory on Windows

- **Hit:** printing archive filenames raised `UnicodeEncodeError` after source extraction completed.
- **Why:** Python's Windows stdout used cp1252 for Korean filenames; generated `.next` files also overwhelmed the first inventory.
- **Fix:** excluded caches, dependencies and env files; extracted source into `.checks` with validated paths and inspected it with UTF-8 file tools.
- **Rule:** inventory source only and use UTF-8 stdout or ASCII-safe output for ZIP paths.

### 2026-11-15 · Preserve local edits across integration branches

- **Hit:** applying local disability-first edits onto current develop conflicted in settings imports and store-card state.
- **Why:** English support changed the same sections after the local branch diverged.
- **Fix:** retained the named stash and combined language and assistance controls explicitly, then ran typecheck and behavior tests.
- **Rule:** retain a recoverable snapshot before adapting local changes onto a newer base; resolve shared UI edits together.

### 2026-11-15 · Inline Node scripts and PowerShell quoting

- **Hit:** a `node -e` replacement script failed with `SyntaxError: Invalid or unexpected token` after PowerShell interpreted nested quote boundaries.
- **Why:** JavaScript containing import strings and escaped double quotes was passed through PowerShell's argument parser.
- **Fix:** wrote the script as a UTF-8 `.cjs` file using `apply_patch` and invoked Node with the file path.
- **Rule:** use a script file for multiline JavaScript or quote-heavy replacements on Windows.

### 2026-11-15 · Primitive slot package ships JSX to Jest

- **Hit:** discovery component tests failed with `SyntaxError: Unexpected token '<'` in `@rn-primitives/slot/dist/index.js`.
- **Why:** rendering the real Text primitive imports the slot package, whose JSX is excluded by Jest's dependency transform rules.
- **Fix:** mocked only the unused slot export in the discovery suite; the real Text and Button primitives still render.
- **Rule:** screen tests that never use Text's `asChild` can mock the slot boundary without changing production transforms.

### 2026-11-15 · Jest mock factories reject imported UI components

- **Hit:** discovery tests failed with `The module factory of jest.mock() is not allowed to reference any out-of-scope variables. Invalid variable access: View`.
- **Why:** Jest hoists mock factories before ordinary imports, so the transform guards imported component references.
- **Fix:** aliased the imported components with a `Mock` prefix and referenced them only inside lazily rendered mock components.
- **Rule:** require dependencies inside a mock factory, or use mock-prefixed bindings only when their access is safely deferred until rendering.

### 2026-11-15 · PowerShell pipelines can corrupt Korean source

- **Hit:** Korean JSX labels became literal `??` after piping a Python script through Windows PowerShell.
- **Why:** the shell's native-process pipeline encoding replaced non-ASCII characters before Python read them; CRLF also broke a later exact newline match.
- **Fix:** wrote Unicode content with `apply_patch`, then used an ASCII-only Python script with explicit UTF-8 reads and normalized newlines.
- **Rule:** use `apply_patch` for Korean source; avoid passing Unicode source through a PowerShell native-process pipeline.

### 2026-11-15 · Browser preview requires an available UI connection

- **Hit:** browser access returned `The browser access host is unavailable`; the Windows fallback ended because it could not determine the browser URL.
- **Why:** neither browser automation nor the fallback URL policy check could establish a usable target.
- **Fix:** stopped UI automation and used typecheck, behavior tests and exports; marked visual/device review as outstanding.
- **Rule:** do not report screenshot or device validation when browser access cannot establish a target.

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

### 2026-11-14 - Preserve Korean text when editing through PowerShell

- **Hit:** new Korean messages became question marks when a Python edit script was piped through PowerShell.
- **Why:** the shell's pipe encoding could not represent the new text.
- **Fix:** rewrote the affected messages with the Unicode-safe patch tool and checked for question-mark runs.
- **Rule:** use direct patches for Korean text; UTF-8 file reads alone do not fix lossy stdin encoding.

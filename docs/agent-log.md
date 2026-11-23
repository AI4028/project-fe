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

### 2026-11-23 · Browser compass needs a tap, even in Chromium

- **Hit:** simulated `deviceorientationabsolute` events never turned the direction arrow in Playwright.
- **Why:** current Chromium, like iOS Safari, has `DeviceOrientationEvent.requestPermission`, so `useHeading` waits for a tap; headless Chromium then denies it because there is no sensor.
- **Fix:** the direction screen shows "나침반 허용하고 화살표 보기"; tests override `requestPermission` to resolve `'granted'` before dispatching events.
- **Rule:** start compass/orientation from a user tap and keep the no-compass fallback (absolute direction words); in Playwright, stub `requestPermission` first.

### 2026-11-21 · Web speech and microphone status

- **Hit:** Automatic spoken guidance stayed silent in the web build.
- **Why:** React Native Web reports that a screen reader is enabled unconditionally. The web speech-recognition module also returns a placeholder microphone permission result.
- **Fix:** Use browser speech synthesis for requested readings and the browser Permissions API for microphone status. Keep native screen-reader handling on iOS and Android.
- **Rule:** Test disabled recognition and denied browser permissions independently.

### 2026-11-21 · Run the check watcher with polling when file watches are exhausted

- **Hit:** The watcher exited with `EMFILE: too many open files, watch`.
- **Why:** The host exhausted the native file watches available to Chokidar.
- **Fix:** Started it with `CHOKIDAR_USEPOLLING=true pnpm check:watch`.
- **Rule:** Use polling on affected hosts and verify the latest check completed for the current revision.

### 2026-11-20 · Include checkout subtitles in screen tests

The review-screen test double rendered the title and footer but omitted the subtitle.
It now renders the subtitle so tests verify the payment instructions seen by customers.

### 2026-11-21 · Check switch colors on the rendered badge

- **Hit:** The high-contrast On label inherited the outline button’s interaction colors.
- **Why:** The badge and its parent button use different foreground/background pairs.
- **Fix:** Isolated the badge’s text styles and verified the rendered colors in Chrome.
- **Rule:** Inspect the label and its background with the switch focused or hovered.

### 2026-11-21 · Measure the search field at the focus boundary

- **Hit:** Chrome reported no focus ring on the outer layout container.
- **Why:** The search field groups the microphone, input and actions inside that container.
- **Fix:** Measured the element enclosing those controls while the input had focus.
- **Rule:** At 390 px, check the ring on the 342 × 56 px field and verify opening suggestions preserves the first venue card’s position.

### 2026-11-20 · Reuse the pnpm store attached to the project

- **Hit:** Adding the Expo file picker stopped with `ERR_PNPM_UNEXPECTED_STORE`.
- **Why:** The shell selected a different store from the one linked to `node_modules`.
- **Fix:** Passed the linked store directory from pnpm's error to `pnpm add --store-dir`.
- **Rule:** Check the linked store path before rebuilding a working installation.

### 2026-11-19 · Use Corepack when local pnpm is unavailable

- **Hit:** `pnpm typecheck` failed with `/bin/bash: pnpm: command not found`; an appended `--runInBand` also made Jest report no tests.
- **Why:** this runner did not expose pnpm, and the test script already includes `--runInBand`.
- **Fix:** used `corepack pnpm` and ran the existing `pnpm test` script without extra arguments.
- **Rule:** use the Corepack fallback and do not append duplicate Jest flags to repository scripts.

### 2026-11-19 · Lucide `Map` icon hides the global `Map`

- **Hit:** `tsc` reported TS7009 and TS2345 on `new Map(...)` in `explore-screen.tsx`.
- **Why:** the file imports `Map` from `lucide-react-native`, which shadows the built-in constructor.
- **Fix:** used `new globalThis.Map(...)`.
- **Rule:** in files that import lucide's `Map`, reach the collection through `globalThis`.

### 2026-11-19 · Keep registered search when the venue provider rejects a request

- **Hit:** iPhone search showed a failure and the same queries returned `503 places-unavailable` directly from the backend.
- **Why:** Kakao returned `401 AccessDeniedError`, and the place endpoint kept only station matches during an upstream failure.
- **Fix:** search registered store and menu names independently, merge the results by store ID, and show a partial-results notice.
- **Rule:** test registered results under provider denial without revealing the server key or presenting external search as available.

### 2026-11-19 · Target the menu item after searching in Metro web

- **Hit:** the browser search check timed out waiting on a single startup screen, then matched both the previous search query and the menu item.
- **Why:** Metro can take longer to serve the first bundle, and Expo Router can keep the previous screen mounted.
- **Fix:** wait for onboarding or search, and match the menu item by its accessible button name after opening the result.
- **Rule:** use the visible route's controls when verifying search and navigation together.

### 2026-11-19 · Reuse Metro for an iPhone Expo Go preview

- **Hit:** a combined command to replace the running Metro process was blocked, and `qrcode-terminal` and `qr.js` were absent.
- **Why:** the existing server was already reachable on Wi-Fi and Expo's QR dependencies differ by SDK.
- **Fix:** verified `GET /_expo/open?platform=ios&runtime=expo` and the iOS manifest, then generated the phone QR with the installed `qrcode` package.
- **Rule:** confirm the Wi-Fi address in the manifest and reuse the running server before restarting Metro or adding tools.

### 2026-11-19 · Translate complete order-number labels

- **Hit:** `주문 번호 {order.orderNumber}` bypassed the English order-number pattern because React passed the label and number as separate children.
- **Why:** the Text primitive translates each string child independently and normalizes whitespace when matching messages.
- **Fix:** passed the complete order-number label as one string and used an explicit space between translated labels and separately formatted values.
- **Rule:** keep pattern-translated values in a single string and preserve spacing explicitly around independently localized children.

### 2026-11-19 · Set dialog sheet width from the viewport

- **Hit:** the mobile web option sheet measured about 244 px across on a 390 px viewport.
- **Why:** the Radix wrapper sizes itself to the content, so percentage width on the inner React Native view resolves against that wrapper.
- **Fix:** calculated the sheet or dialog width from the window and safe-area insets and passed it as a flattened style.
- **Rule:** inspect both the outer dialog and the inner panel on web and check the panel's width alongside its contents.

### 2026-11-19 · Discovery tests can be CPU-bound during Expo exports

- **Hit:** different discovery tests exceeded Jest's 5000 ms timeout during parallel exports, then passed on isolated reruns.
- **Why:** rendering the route and its children competes for CPU with Metro export workers.
- **Fix:** set a 15 second limit for the discovery suite while keeping the assertions and async boundaries unchanged.
- **Rule:** verify the failing assertion in isolation before changing an async state transition to address a timeout.

### 2026-11-19 · Type React Native refs from the component

- **Hit:** `tsc` reported `Property 'scrollTo' does not exist` and rejected passing a `View` ref to `sendAccessibilityEvent`.
- **Why:** Expo's React Native declarations expose `View` and `ScrollView` as components, while their refs point to host instances.
- **Fix:** typed the refs with `ComponentRef<typeof View>` and `ComponentRef<typeof ScrollView>`.
- **Rule:** infer native host ref types from the component when adding focus or scroll behavior.

### 2026-11-18 · Fixed bars crowd out content at 200% text

- **Hit:** at 200% text on a 390 px screen the bottom tab labels collided ("둘러보기" clipped) and header + footer + tabs took about half the screen.
- **Why:** every `Text` scales with `TextScaleContext`, including the fixed header and tab bar that never scroll.
- **Fix:** `LimitTextScale` caps the mobile header and bottom tabs at 1.3; page content and the footer action keep the full scale.
- **Rule:** check new fixed UI at 200% on a phone-width screen; cap only chrome that doesn't scroll, never content.

### 2026-11-15 · Scope nested route guards to their own screens

- **Hit:** review of the profile-specific Explore layout found that an unconditional pathname redirect would also redirect visits to Orders and Settings.
- **Why:** a stack layout can remain mounted while another section is active, and `usePathname` follows the active route.
- **Fix:** scoped the guard to `/explore`, reset its navigator when the profile changes, and covered leaving Explore and returning after a profile change.
- **Rule:** nested route guards must ignore routes outside their subtree; test navigation away as well as direct entry.

### 2026-11-15 · Hidden controls can conceal missing accessibility labels

- **Hit:** after removing the hidden map from the list experience, `getByLabelText('내 주변에서 찾기')` could no longer find the list's location action.
- **Why:** the old test matched the hidden map control; the visible list action relied only on its child text.
- **Fix:** gave the list action its own Korean accessibility label and busy state, and tested list and map searches separately.
- **Rule:** mount only the chosen experience and give shared actions explicit accessible names in every presentation.

### 2026-11-15 · A stale saved order wiped the cart on web reload

- **Hit:** on dev.galjido.shop, refreshing mid-order showed an empty cart and `Order not found.` while the kiosk still held the cart and stayed busy.
- **Why:** `order:` lives in localStorage (survives tabs) but the web device token lives in sessionStorage (ends with the tab). The old order 404'd for the new device, and the restore `catch` cleared the session it had just restored.
- **Fix:** look up the remembered order in its own `try`; on 403/404 forget only that order (`src/providers/app-provider.tsx`). Test in `tests/app-provider.test.tsx`.
- **Rule:** a failing optional lookup during restore must not clear state restored before it. Test web reloads with leftovers from an earlier tab.

### 2026-11-15 · Verify the frontend address as well as backend readiness

- **Hit:** the Explore screen reported connection failures although backend readiness and direct place searches passed.
- **Why:** the local frontend environment targeted port 8001 while the backend listened on 8000; saved app settings can override that environment too.
- **Fix:** corrected the local API URL, restarted Metro, verified the LAN readiness endpoint and real nearby venue results, and exposed connection settings in search recovery.
- **Rule:** compare the frontend environment and saved server address with the listening backend port before treating a successful readiness check as an app connection check.

### 2026-11-15 · Restart the complete backend worker tree after changing credentials

- **Hit:** place search still returned `generalSearch: not-configured` after restarting Uvicorn with `--env-file .env`.
- **Why:** an orphaned Windows `multiprocessing.spawn` worker from the previous reloader still served requests without the updated environment.
- **Fix:** stopped the observed old worker, restarted with the env file, then verified real venue results; backed up the local SQLite database and applied the existing migration for its missing `sessions.submission` column.
- **Rule:** inspect the port owner and reloader workers when configuration appears stale; verify schema readiness before restarting against an older local database.

### 2026-11-15 · Confirm dialogs blank the web app

- **Hit:** tapping 주문 취소 요청 on dev.galjido.shop turned the page white: `TypeError: Failed to set an indexed property [0] on 'CSSStyleDeclaration'`. Typecheck and Jest were green.
- **Why:** on web, `@rn-primitives/dialog` renders `Title`/`Description` as plain DOM elements; `DialogTitle`/`DialogDescription` passed them a style array, which React DOM can't apply. Jest runs the native renderer, so it never saw it.
- **Fix:** pass `StyleSheet.flatten([...])` instead of an array (`src/components/ui/dialog.tsx`); `tests/dialog.test.tsx` guards it.
- **Rule:** never pass a style array to an `@rn-primitives` element that renders DOM on web; flatten it. Click through a dialog on the web export before merging UI-primitive changes.

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

### 2026-11-19 · Open voice search from the first microphone tap

The web speech recognizer needs to start during the tap. Keep the listener mounted while discovery is visible, start it in the microphone handler, and abort on leaving the voice screen. Discovery tests cover the first tap and denied permissions. The web gesture test leaves speech playback shutdown pending.

### 2026-11-21 · Check bookmarks at normal text size

The onboarding button reads “Save settings and start” at normal text size and “Get started” in the compact layout. Browser checks that start with onboarding should allow both labels before testing bookmarks.

### 2026-11-21 · Check quoted prices across checkout screens

Expo Router can retain the cart in the web DOM while the final review is visible. Scope browser assertions to the visible screen when checking the same option summary on both routes.

### 2026-11-21 · Verify the return from kiosk pairing

Directions can stay mounted while the customer opens Help and enters a kiosk code. Carry the venue ID, origin and expanded access section through the pairing redirect so the return action also works after a reload.

### 2026-11-21 · Recover checkout after a lost response

A replay can return a definite rejection if a venue pauses orders or removes an item. Release the pending submission and retain the cart in that case. An unreadable success response can mean the order was committed. Keep its recovery data and look up the order before allowing another submission.

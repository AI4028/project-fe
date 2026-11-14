# 갈지도 · Galjido

Accessible kiosk ordering for iOS, Android and web, built with **React Native,
Expo SDK 58, TypeScript and Expo Router**. Customer and staff screens share the
same backend contracts from [project-be](https://github.com/AI4028/project-be).

## Run

Use Node 22.16+ (see `.nvmrc`) and pnpm 10.11:

```sh
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm start
```

`pnpm start` / `pnpm dev` run Metro and the automatic typecheck/test watcher
alongside it. Press `w` for web. For native, build once with `pnpm ios` or
`pnpm android` (Xcode or Android Studio required), then open the development
build from Metro. **Use a development build, not Expo Go:** the installed
`expo-speech-recognition` module needs native microphone/speech permissions.
Expo Go can preview the touch flow with speech recognition disabled.

Set `EXPO_PUBLIC_API_URL` to the backend address. A physical phone needs your
computer's LAN IP or a reachable HTTPS URL; `127.0.0.1` points to the phone itself.
The in-app settings can change the API address. Backend `CORS_ORIGINS` must allow
the web origin. Use HTTPS for deployed web microphone/location access and native
production APIs. Native release builds may reject cleartext HTTP.

Start the backend as documented in its README. Seed the cafe and create a kiosk
key locally; enter the key in `/kiosk`. **Never commit the key.** Native tokens use
Keychain/Keystore. Web credentials last for the browser session. Credentials are
scoped to the configured API URL; changing servers does not forward old tokens.

## Customer and kiosk flow

The UX follows the [Service Diagram / Flowchart](https://app.notion.com/p/Service-Diagram-Flowchart-3f3e09a12c88809ebef5ccaa8a0235b5)
reviewed on **2026-11-05**. It is a design proposal, not a claim that all optional
services exist. This branch targets backend `feature/backend-readiness` through migration `0002`.
See [backend integration](docs/backend-readiness.md) before running it.

1. **Discover or order directly.** The home screen starts with an accessible store
   list and name/address search. Users already at a store can enter a connection
   code immediately. No disability category, location permission, or map gesture
   is required. Map and foreground location are optional; denial/failure leaves
   the list usable. Distances are approximate straight-line distances, not routes.
2. **Review the store.** Details show branch/address, registered access information,
   ordering methods, and indoor descriptions. Missing facts, provenance, contact,
   and availability remain unknown. Store details can be opened with
   `/store?storeId=...`; menus can be previewed before connecting.
3. **Confirm the connection.** Code/link input first uses `GET /kiosks/{id}` and
   `GET /stores/{id}` to show the actual store. A code for a different selected
   store is blocked. The user confirms before a session is created. Busy/expired
   codes offer retry, another code, leaving, and direct staff assistance. No queue
   position or response time is invented. QR is optional, never the only entry.
4. **Browse and correct.** The menu begins with category/item counts. Options show
   required choices and extra charges. Cart editing replaces the existing line,
   including options and quantity; it does not add a duplicate. Failed updates
   preserve the last confirmed cart. Removing a line requires confirmation.
5. **Review and submit.** `/review` displays the store, options, quantities, total,
   payment location and note. Going back retains selections within the session.
   Prices are refreshed before review and again before submission. A changed
   price requires another review. Voice commands never submit an order directly.
6. **Recover uncertain submissions.** Before POST, the session ID is persisted as
   pending. A lost response blocks another submission, cart changes and session
   termination until the user checks `GET /sessions/{id}` and, if present,
   `GET /orders/{orderId}`. Reload also attempts recovery. No POST is automatically
   retried. Safe recovery replays the persisted request with its original quote and idempotency key.
7. **Track distinct outcomes.** Sending, submitted, accepted, preparing, ready,
   picked up and cancelled are different states. Order status shows the last
   successful check and retains it with an error notice when offline. Cancellation
   requires confirmation and refreshes after races with staff acceptance. Payment
   is at the counter/kiosk; the app never claims payment or refund completion.
8. **Leave or ask for help.** `/leave` offers keeping the cart in its current
   session or explicitly discarding it and ending the connection. Session expiry
   still applies. `/help` distinguishes request sent from an explicit staff event.
   Before connection/after submission it offers direct staff guidance because the
   current API only accepts help for active sessions. Pickup remains a staff action.

Settings are independent preferences: contrast, text size, extra speech, and
optional voice input. New users start with extra speech/voice input off. Existing
preferences are preserved. Screen reader announcements do not additionally play
TTS when a screen reader is enabled. Final VoiceOver/TalkBack usability still needs
real-device testing; automated tests are not an accessibility certification.

### Maps, optional voice, and hardware

- Web uses Kakao Maps with `EXPO_PUBLIC_KAKAO_MAP_KEY`; register the origin and enable
  Maps in Kakao. iOS uses Apple Maps. Android uses Google Maps with a restricted
  `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and a native rebuild. The list works without keys.
- The current location feature uses foreground coordinates and server/local radius
  comparisons. It is not background geofencing or indoor navigation. A nearby
  store is not automatically selected or connected.
- Direct BLE scanning/broadcasting is not implemented. No RSSI-based meter/floor
  claim is shown. The old Arduino demo transport is not proof of phone-side BLE.
- `EXPO_PUBLIC_DEMO_MODE=true` plus backend `DEMO_MODE=1` enables a clearly labelled
  demo code fetch. Both default off. The customer UX no longer uses the shared
  `/ws/proximity` demo feed as a real location measurement.
- Speech recognition requires a native development build. Expo Go falls back to
  touch controls if the native module is absent. Browser recognition support varies.
- Open separate customer and `/kiosk` windows for the demo. Online payment,
  background alerts and live indoor positioning are not enabled by this UX update.

## Routes and shared code

```text
src/app/
  _layout.tsx             # providers, theme, Stack and PortalHost
  index.tsx               # list/search, direct order entry, optional map
  onboarding.tsx          # optional preference introduction
  store.tsx               # store details
  connect.tsx             # code/link, branch confirmation, retry/alternatives
  guide.tsx               # indoor/accessibility guidance
  menu/index.tsx          # categories, menu and availability
  menu/[itemId].tsx        # options and quantity
  cart.tsx                # server-priced cart, edit/remove
  review.tsx              # final review, submission and recovery
  leave.tsx               # keep cart or confirm ending session
  help.tsx                # session help and direct-contact fallback
  orders/[orderId].tsx     # status, payment/pickup guidance, cancel confirmation
  kiosk.tsx               # authenticated staff console
  settings.tsx            # accessibility and API address
  +not-found.tsx
src/components/ui/        # React Native Reusables, source owned by this app
src/providers/            # customer session/cart/order state
src/lib/                  # typed API, storage, live events, domain rules/tokens
```

The old DOM prototype was replaced; its sources remain in Git history.
The migration includes upstream frontend `0a782e6` (map/profile feature).
The sibling backend repository is not modified.

## Checks and agent feedback

```sh
pnpm tsc --noEmit     # direct typechecker access
pnpm test            # unit and React integration tests
pnpm verify          # typecheck + unit tests, exits nonzero on failure
pnpm check:watch     # both checks after edits, also runs immediately
pnpm export:all      # Metro/Hermes bundles for web, Android and iOS
```

The watcher serializes runs, coalesces rapid writes, and queues another complete
run when files change during a check. `.checks/latest.json` records success and
whether that run covers the current revision. Generated output and dependencies
are excluded. `AGENTS.md` makes this loop part of future agent edits. CI repeats
the checks and all-platform export on pushes and pull requests.

## Web deployment

`pnpm export:web` writes `dist/`. Serve it at the **root of a dedicated web
origin**, with unknown routes rewritten to `index.html` (SPA routing). Do not
point the backend's old `/app/` static mount at the source directory: it no
longer contains a standalone HTML app. Native binaries are built separately
using Expo's development/release build workflow.

## UI source and maintenance

The installed Button, Text, Input, Card and Dialog components are from
[React Native Reusables](https://reactnativereusables.com/), backed by
`@rn-primitives` and NativeWind. `components.json` configures future additions:

```sh
pnpm dlx @react-native-reusables/cli@latest add <component>
```

All app design tokens live in `src/lib/theme.ts`; see `THIRD_PARTY_NOTICES.md`
for upstream attribution. Navigation follows the
[Expo Router file conventions](https://docs.expo.dev/router/installation/).

## Backend handoff: API gaps and proposed contracts

**No nonexistent endpoint is called by this frontend.** The table below separates
working integrations from missing data/endpoints required to complete the UX.
Proposals are for backend review; they are not deployed routes. Keep device/store
ownership checks on every private operation. Never put a kiosk secret in a link.

### Existing endpoints used by the new UX

| UX operation             | Existing contract                                                                          | Current limitation                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| List/search/nearby       | `GET /stores`, `GET /stores/nearby?lat=&lng=&radiusM=3000`                                 | Search is client-side over the returned list; no pagination/search endpoint needed for this pilot.            |
| Store/menu preview       | `GET /stores/{storeId}`                                                                    | No verification/contact/operational metadata.                                                                 |
| Confirm branch           | `GET /kiosks/{kioskId}` → `kioskId, storeId, name`; then store GET                         | Code cannot be discovered from a store ID alone.                                                              |
| Connect                  | `POST /devices`; `POST /sessions` with `kioskId, token` and device bearer                  | `kiosk-busy` means busy, not queued.                                                                          |
| Edit/remove/reprice cart | `PUT /sessions/{id}/cart` with complete `items` array                                      | Existing API supports replacement and empty array; no new edit endpoint is needed.                            |
| Submit/recover           | `POST /sessions/{id}/order`; `GET /sessions/{id}` → optional `orderId`; `GET /orders/{id}` | Recovery depends on retained session ID and device credential.                                                |
| Cancel                   | `POST /orders/{id}/cancel`, then order GET                                                 | Allowed only while `status=submitted`; acceptance race can return `too-late-to-cancel`.                       |
| Active-session help      | `POST /sessions/{id}/help`, `help_resolved` websocket event                                | `helpRequested=false` after reload does not establish acknowledgement; no durable acknowledged state exposed. |
| Status/pickup            | order GET and session WebSocket; staff `POST /kiosk/orders/{id}/status`                    | `ready` and `picked_up` are separate; frontend never marks pickup automatically.                              |

### Backend integration and remaining proposals

| Priority                        | Backend change to agree                                                                              | Minimum response/behavior                                                                                                                                                                                                                                                                 | Frontend fallback today                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Done: safe order retry | `Idempotency-Key` on order POST | Same device/session/key and body returns the original result; changed body returns 409. | The client persists the body before POST and replays it during recovery. |
| Done: exact price confirmation | Cart `quoteId` sent on order POST | Changed quote, items or prices return `409 price-changed`; sold-out choices retain availability errors. | New confirmation is required; checkout refuses a server without quotes. |
| P1: help outside active session | `POST /orders/{orderId}/help`, `GET /orders/{orderId}/help`; staff acknowledgement endpoint          | Return `requestId`, `status: requested                                                                                                                                                                                                                                                    | acknowledged                                                                                                                                                                                           | resolved`, timestamps; require order ownership, prevent duplicate active requests; emit separate events. Extend session GET with the same durable state. | After submission, direct staff guidance and order number; no disabled or fake help POST. Acknowledged does not mean assistance delivered. |
| P1: verified store/support data | Extend `GET /stores/{storeId}`                                                                       | Proposed nullable fields: `contactPhone`, `staffLocationInstructions`, `pickupInstructions`, `accessibilitySource`, `accessibilityVerifiedAt`, `phoneOrderingAvailable`, `connectionMethods`, `paymentLocations`, `operatingStatus` + `operatingStatusUpdatedAt`. Define null as unknown. | Show registered details and unknowns; current counter/kiosk choices reflect backend enum, not verified per-store availability. No fabricated phone, pickup point or opening state.                     |
| P1: connection instructions     | Extend store response with supported entry instructions; optionally `GET /stores/{id}/ordering-info` | Public kiosk IDs, supported code/link methods, human-readable instructions and temporary-unavailability reason. Do not return secret keys or make rotating tokens public outside explicit demo mode.                                                                                      | User obtains code/link from the store, then public kiosk lookup verifies branch. No queue position or estimated wait shown.                                                                            |
| P1: cancellation explanation    | Extend order GET with `cancelledBy`, `cancellationReason`, `canCancel`                               | Return current server-authoritative eligibility, nullable reason, timestamps. Keep direct cancel race-safe.                                                                                                                                                                               | Only submitted orders offer cancellation; absent reasons refer user to staff.                                                                                                                          |
| Optional: online payment        | Define payment create/status/cancel/refund contracts separately before exposing a payment action     | Provider-confirmed state, payment/order correlation, webhook verification and idempotency; distinguish paid-but-order-failed and refund pending/completed.                                                                                                                                | No online payment button. Choosing counter/kiosk is not payment confirmation.                                                                                                                          |
| Optional: background alerts     | Device push registration/revocation endpoint and delivery policy                                     | Per-device consent, current order linkage, token rotation, no claim of delivery without evidence.                                                                                                                                                                                         | Explicit order-status route and foreground refresh.                                                                                                                                                    |

Implemented quote response example:

```json
{
  "quoteId": "server-issued-session-quote",
  "total": 3000,
  "lines": [{ "itemId": "americano", "qty": 1, "lineTotal": 3000, "options": [] }],
  "summary": "아메리카노 1개"
}
```

Order POST carries the existing `items`, `paymentMethod`, `note`, plus
`quoteId`, and an `Idempotency-Key` header. This branch sends both fields. Deploy the matching backend and apply migration `0002` first.

### Acceptance checks for this branch

- No onboarding or map gate; direct code entry and searchable list work without permissions.
- Wrong branch is caught before session POST; busy/expired codes have a way out.
- Editing options replaces one line; a failed edit retains the confirmed cart.
- Changed totals stop submission; unknown POST results block another POST until recovery.
- Cancel has a confirmation step; an acceptance race retains access to current order.
- Ready, collected, submitted, accepted and paid are never conflated.
- Missing contact/pickup/verification data and unsupported help remain explicit.
- Run typechecking/unit tests and web smoke tests; repeat VoiceOver/TalkBack and
  microphone/location checks on actual devices before claiming native validation.

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

1. Choose 시각 / 지체 / 휠체어 by voice or touch. The preference persists locally;
   유형 변경 lets you change it. As in the upstream map feature, the three profiles
   currently share a map layout while their visual distinctions are being designed.
2. Request foreground location to see nearby stores and arrival announcements.
   Permission denial leaves the full accessible store list available. The map uses
   `/stores/nearby`; an older backend without that endpoint falls back to local
   distance filtering of `/stores`. Unknown access information says 확인 필요.
3. Read store access/indoor details, then connect using the kiosk ID and rotating
   8-character pairing code or its QR link. QR links ask the user to connect; they
   never include a kiosk secret. The phone and kiosk must use the same API server.
4. Select menu options/quantity, edit the cart, request help, and confirm the order.
   Cart totals come from the server. Payment happens at the counter or kiosk.
5. Follow live order status; cancel before staff accepts. The kiosk sees the live
   cart/help requests, handles order progression, and marks menu items sold out.

Korean speech commands include menu names and quantities (아메리카노 아이스 두 잔),
option selection, 담기, 장바구니, 직원 호출, 메뉴 읽어줘, 다시 듣기 and 연결 종료.
Ordering always opens a review dialog before submission. Touch and OS screen
readers remain available when speech recognition is unsupported or denied.
High contrast, larger text and spoken guidance are available in settings.

### Maps and demo hardware

- Web uses Kakao Maps when `EXPO_PUBLIC_KAKAO_MAP_KEY` is configured. Register the
  web origin in Kakao's JavaScript SDK domains and enable the Maps product. Without
  a key, the accessible store list is fully usable.
- iOS uses Apple Maps. Android uses Google Maps; set a restricted
  `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and rebuild the native app.
- For a demo without receiving a hardware token, explicitly set
  `EXPO_PUBLIC_DEMO_MODE=true` and backend `DEMO_MODE=1`. This enables the demo
  token endpoint, demo location button, and `/ws/proximity` bridge readings.
  Keep both flags off in production.
- Direct Bluetooth scanning/broadcasting is not implemented in this migration.
  The existing Arduino bridge can still publish proximity readings. Native BLE
  integration needs the team's final advertisement/transport specification;
  current pairing works with QR or manual codes.
- Desktop split-screen demonstration is replaced by separate customer/kiosk
  routes. Open two windows (or a phone plus kiosk) for simultaneous use.

## Routes and shared code

```text
src/app/
  _layout.tsx             # providers, theme, Stack and PortalHost
  index.tsx               # nearby-store map and accessible list
  onboarding.tsx          # remembered accessibility profile
  store.tsx               # store details
  connect.tsx             # pairing code, QR target and demo proximity
  guide.tsx               # indoor/accessibility guidance
  menu/index.tsx          # categories, menu and availability
  menu/[itemId].tsx        # options and quantity
  cart.tsx                # server-priced cart and confirmation dialog
  orders/[orderId].tsx     # order tracking/cancellation
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

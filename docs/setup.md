# Setup

## Requirements

- Node 22 (exact version in `.nvmrc`) and pnpm 10 via `corepack enable`
- Xcode or Android Studio for native builds
- A running [backend](https://github.com/AI4028/project-be), seeded with a cafe and a kiosk key

## Environment

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable                          | Notes                                                        |
| --------------------------------- | ------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL`             | Backend address. On a phone use your LAN IP, not `127.0.0.1` |
| `EXPO_PUBLIC_DEMO_MODE`           | `true` only with backend `DEMO_MODE=1`. Off in production    |
| `EXPO_PUBLIC_KAKAO_MAP_KEY`       | Web map. Register the web origin in Kakao and enable Maps    |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Android map. Restricted key, rebuild the app after changing  |

- The API address can also be changed in the app's settings screen.
- Backend `CORS_ORIGINS` must allow the web origin.
- Use HTTPS for deployed web (microphone and location) and for native release builds.
- Kiosk keys are entered on `/kiosk` at runtime. **Never put one in `.env` or a QR code.**
- Tokens are stored per API address (Keychain/Keystore on native, session storage on web).
  Switching servers does not carry old tokens over.

## Native builds

```sh
pnpm ios        # or: pnpm android
```

Build once, then open the development build from Metro. Expo Go works for the touch
flow, but it has no speech recognition module.

### Android kiosk scanning

Rebuild the Android development client after adding the local BLE module. With
both demo flags off, open a store and choose **Connect to a kiosk to order**, then
choose **Find nearby kiosks** (주변 키오스크 검색).
Android 12 and later ask for Nearby Devices access. Android 11 and earlier need
location permission and Location Services for BLE scanning. The app scans for six
seconds, then lets the customer confirm a discovered store. QR and manual codes
are available when Bluetooth is off or the scan finds nothing. Web and iOS use
the code flow or the browser-compatible demo scan when demo mode is enabled.

## Maps

- **iOS** uses Apple Maps, **Android** uses Google Maps, **web** uses Kakao Maps.
- Without a map key, the accessible store list still works.

## Demo mode

Start the backend with `DEMO_MODE=1` and run Expo with `EXPO_PUBLIC_DEMO_MODE=true`.
Open `/connect` and choose **Simulate nearby kiosk scan** (주변 데모 기기 검색).
The scan simulates advertisements for provisioned demo kiosks (`GK01`, `OR01`,
`MB01`, `CB01`) using real pairing tokens from the demo backend. Select a kiosk,
verify its store, and connect to open the normal ordering session. Search again
if the token expires. QR and manual code entry also work without BLE hardware.

## Web deploy

```sh
pnpm export:web     # writes dist/
```

Serve `dist/` from the **root of its own origin** and rewrite unknown routes to
`index.html`. Do not use the backend's old `/app/` static mount.

## UI components

`src/components/ui` holds [React Native Reusables](https://reactnativereusables.com/)
(Button, Text, Input, Card, Dialog, Icon), owned and adapted by this app.
Add more with:

```sh
pnpm dlx @react-native-reusables/cli@latest add <component>
```

Design tokens live in `src/lib/theme.ts`. Attribution is in
[THIRD_PARTY_NOTICES.md](../src/components/ui/THIRD_PARTY_NOTICES.md).
